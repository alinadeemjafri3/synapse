import json
import re
import uuid
import asyncio
from typing import List, Tuple, Dict, Any
from openai import AsyncOpenAI
from sklearn.feature_extraction.text import TfidfVectorizer
import numpy as np

from models import Node, Edge, EntityType, GraphSession
from session import store

XAI_BASE_URL = "https://api.x.ai/v1"
GROK_MODEL = "grok-4"

EXTRACTION_PROMPT = """Extract all entities and relationships from the text below.

Return ONLY valid JSON with this exact structure:
{
  "entities": [
    {
      "label": "entity name (short, 1-4 words)",
      "type": "CONCEPT|PERSON|ORG|DATE|LOCATION|TERM|EVENT",
      "description": "one sentence description from the text"
    }
  ],
  "relationships": [
    {
      "source": "entity label (must match an entity above)",
      "target": "entity label (must match an entity above)",
      "label": "short relationship verb (e.g. defines, references, contains, modifies, uses)",
      "sentence": "the exact sentence this relationship came from"
    }
  ]
}

Rules:
- Extract 5-25 entities per chunk
- Extract meaningful relationships only
- All relationship source/target must match entity labels exactly
- Labels must be concise (no full sentences)
- Return ONLY the JSON, no other text

Text:
"""


def extract_text_from_file(content: bytes, filename: str) -> str:
    ext = filename.lower().rsplit(".", 1)[-1]

    if ext == "pdf":
        import fitz
        doc = fitz.open(stream=content, filetype="pdf")
        return "\n\n".join(page.get_text() for page in doc)

    elif ext == "docx":
        import io
        from docx import Document
        doc = Document(io.BytesIO(content))
        return "\n\n".join(p.text for p in doc.paragraphs if p.text.strip())

    else:
        return content.decode("utf-8", errors="ignore")


def chunk_text(text: str, chunk_size: int = 3000, overlap: int = 300) -> List[str]:
    """Larger chunks = fewer API calls = faster ingestion."""
    text = re.sub(r'\n{3,}', '\n\n', text).strip()
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        if end < len(text):
            last_period = text.rfind('.', start, end)
            if last_period > start + chunk_size // 2:
                end = last_period + 1
        chunks.append(text[start:end])
        start = end - overlap if end < len(text) else len(text)
    return [c for c in chunks if len(c.strip()) > 100]


def compute_embeddings(session: GraphSession):
    if not session.nodes:
        return
    texts = [f"{n.label} {n.description}" for n in session.nodes.values()]
    node_ids = list(session.nodes.keys())

    vectorizer = TfidfVectorizer(max_features=512, stop_words='english')
    matrix = vectorizer.fit_transform(texts).toarray()

    session.vectorizer = vectorizer
    for i, node_id in enumerate(node_ids):
        session.nodes[node_id].embedding = matrix[i].tolist()


async def _extract_chunk(
    client: AsyncOpenAI,
    chunk: str,
    chunk_idx: int,
) -> Tuple[int, Dict[str, Any] | None]:
    """No semaphore — all chunks fire in parallel. Grok's rate limiter will
    queue them server-side; we just don't add extra artificial latency."""
    try:
        response = await client.chat.completions.create(
            model=GROK_MODEL,
            messages=[{"role": "user", "content": EXTRACTION_PROMPT + chunk}],
            temperature=0.1,
            max_tokens=2500,
        )
        raw = response.choices[0].message.content.strip()
        raw = re.sub(r'^```json\s*', '', raw)
        raw = re.sub(r'^```\s*', '', raw)
        raw = re.sub(r'\s*```$', '', raw)
        return chunk_idx, json.loads(raw)
    except Exception:
        return chunk_idx, None


async def ingest_document(
    session_id: str,
    content: bytes,
    filename: str,
    api_key: str,
):
    session = store.get_or_create(session_id)
    # Reset session state for fresh ingestion
    session.nodes.clear()
    session.edges.clear()
    session.documents.clear()
    session.label_to_id.clear()
    session.vectorizer = None

    client = AsyncOpenAI(api_key=api_key, base_url=XAI_BASE_URL)

    await store.broadcast(session_id, {
        "event": "ingestion_started",
        "doc_name": filename,
    })

    text = extract_text_from_file(content, filename)
    chunks = chunk_text(text)
    session.documents.append(filename)

    total_chunks = len(chunks)
    await store.broadcast(session_id, {
        "event": "ingestion_progress",
        "message": f"Processing {total_chunks} chunks in parallel",
        "total_chunks": total_chunks,
    })

    completed = 0

    async def tracked_extract(chunk, idx):
        nonlocal completed
        result = await _extract_chunk(client, chunk, idx)
        completed += 1
        await store.broadcast(session_id, {
            "event": "chunk_processing",
            "chunk": completed,
            "total": total_chunks,
        })
        return result

    # Fire ALL chunks simultaneously — no artificial rate limiting
    results = await asyncio.gather(*[
        tracked_extract(chunk, i) for i, chunk in enumerate(chunks)
    ])

    results.sort(key=lambda x: x[0])

    total_entities = 0
    total_edges = 0

    for chunk_idx, data in results:
        if data is None:
            continue

        chunk_node_ids = {}
        for entity in data.get("entities", []):
            label = entity.get("label", "").strip()
            if not label:
                continue

            label_key = label.lower()
            if label_key in session.label_to_id:
                chunk_node_ids[label] = session.label_to_id[label_key]
                continue

            node_id = str(uuid.uuid4())
            try:
                entity_type = EntityType(entity.get("type", "CONCEPT"))
            except ValueError:
                entity_type = EntityType.CONCEPT

            node = Node(
                id=node_id,
                label=label,
                type=entity_type,
                description=entity.get("description", ""),
                source_doc=filename,
            )
            session.nodes[node_id] = node
            session.label_to_id[label_key] = node_id
            chunk_node_ids[label] = node_id
            total_entities += 1

        for rel in data.get("relationships", []):
            src_label = rel.get("source", "").strip()
            tgt_label = rel.get("target", "").strip()

            src_id = chunk_node_ids.get(src_label) or session.label_to_id.get(src_label.lower())
            tgt_id = chunk_node_ids.get(tgt_label) or session.label_to_id.get(tgt_label.lower())

            if not src_id or not tgt_id or src_id == tgt_id:
                continue

            existing = any(
                e.source_id == src_id and e.target_id == tgt_id
                for e in session.edges
            )
            if existing:
                continue

            edge = Edge(
                id=str(uuid.uuid4()),
                source_id=src_id,
                target_id=tgt_id,
                label=rel.get("label", "relates to"),
                source_sentence=rel.get("sentence", ""),
            )
            session.edges.append(edge)
            session.nodes[src_id].connection_count += 1
            session.nodes[tgt_id].connection_count += 1
            total_edges += 1

    compute_embeddings(session)

    await store.broadcast(session_id, {
        "event": "ingestion_complete",
        "stats": {
            "entities": total_entities,
            "relationships": total_edges,
            "chunks_processed": total_chunks,
        },
        "nodes": [n.to_dict() for n in session.nodes.values()],
        "edges": [e.to_dict() for e in session.edges],
    })
