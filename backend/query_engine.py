import asyncio
from typing import List, Dict, Tuple
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from openai import AsyncOpenAI

from models import GraphSession, Node
from session import store

XAI_BASE_URL = "https://api.x.ai/v1"
GROK_MODEL = "grok-4"

ANSWER_SYSTEM = """You are a precise knowledge assistant. Answer questions based ONLY on the provided context extracted from a knowledge graph.

Rules:
- Be concise but complete
- Cite specific concepts from the context using [Node Name] notation
- If the context doesn't contain enough information, say so
- Do not make up information not present in the context
"""


def score_nodes(query: str, session: GraphSession) -> Dict[str, float]:
    """Score nodes using the same vectorizer fitted during ingestion."""
    if not session.nodes or session.vectorizer is None:
        return {}

    node_ids = list(session.nodes.keys())
    node_embeddings = np.array([session.nodes[nid].embedding for nid in node_ids])

    # Transform query into the same feature space as the stored node embeddings
    query_vec = session.vectorizer.transform([query]).toarray()[0].reshape(1, -1)
    scores = cosine_similarity(query_vec, node_embeddings)[0]

    return {node_ids[i]: float(scores[i]) for i in range(len(node_ids))}


def bfs_traverse(
    session: GraphSession,
    seed_node_ids: List[str],
    scores: Dict[str, float],
    max_hops: int = 2,
    min_score: float = 0.05,
) -> Tuple[List[str], List[Tuple[str, str]]]:
    adjacency: Dict[str, List[str]] = {nid: [] for nid in session.nodes}
    for edge in session.edges:
        adjacency[edge.source_id].append(edge.target_id)
        adjacency[edge.target_id].append(edge.source_id)

    visited = set(seed_node_ids)
    traversal_path: List[Tuple[str, str]] = []
    context_nodes = list(seed_node_ids)
    frontier = list(seed_node_ids)

    for hop in range(max_hops):
        next_frontier = []
        for node_id in frontier:
            neighbors = adjacency.get(node_id, [])
            neighbors_scored = [
                (n, scores.get(n, 0)) for n in neighbors if n not in visited
            ]
            neighbors_scored.sort(key=lambda x: x[1], reverse=True)

            for neighbor_id, score in neighbors_scored[:3]:
                if score >= min_score:
                    visited.add(neighbor_id)
                    traversal_path.append((node_id, neighbor_id))
                    context_nodes.append(neighbor_id)
                    next_frontier.append(neighbor_id)

        frontier = next_frontier
        if not frontier:
            break

    return context_nodes, traversal_path


def build_context(session: GraphSession, node_ids: List[str]) -> str:
    parts = []
    for nid in node_ids:
        node = session.nodes.get(nid)
        if node:
            parts.append(f"[{node.label}] ({node.type.value}): {node.description}")
    return "\n\n".join(parts)


async def run_query(session_id: str, query: str, api_key: str):
    session = store.get(session_id)
    if not session:
        await store.broadcast(session_id, {"event": "error", "message": "Session not found"})
        return

    if not session.nodes:
        await store.broadcast(session_id, {"event": "error", "message": "No graph loaded. Please upload a document first."})
        return

    client = AsyncOpenAI(api_key=api_key, base_url=XAI_BASE_URL)

    await store.broadcast(session_id, {
        "event": "query_received",
        "query": query,
        "tokens": query.split(),
    })

    # Score all nodes using the stored vectorizer (correct feature space)
    scores = score_nodes(query, session)
    sorted_nodes = sorted(scores.items(), key=lambda x: x[1], reverse=True)

    # Broadcast all node scores at once
    for node_id, score in sorted_nodes:
        if score > 0.01:
            await store.broadcast(session_id, {
                "event": "node_scored",
                "node_id": node_id,
                "score": round(score, 4),
            })

    # Select top-5 seed nodes
    top_nodes = [nid for nid, _ in sorted_nodes[:5] if scores[nid] > 0.05]
    if not top_nodes:
        top_nodes = [nid for nid, _ in sorted_nodes[:3]]

    # BFS traversal with short delay for visual effect
    context_nodes, traversal_path = bfs_traverse(session, top_nodes, scores)

    for from_id, to_id in traversal_path:
        await store.broadcast(session_id, {
            "event": "traversal_hop",
            "from_id": from_id,
            "to_id": to_id,
        })
        await asyncio.sleep(0.12)

    # Mark retrieved nodes
    for node_id in context_nodes:
        node = session.nodes.get(node_id)
        if node:
            await store.broadcast(session_id, {
                "event": "node_retrieved",
                "node_id": node_id,
                "context": node.description,
            })

    # Build context and stream answer
    context = build_context(session, context_nodes)

    await store.broadcast(session_id, {"event": "answer_start"})

    full_answer = ""
    try:
        stream = await client.chat.completions.create(
            model=GROK_MODEL,
            messages=[
                {"role": "system", "content": ANSWER_SYSTEM},
                {"role": "user", "content": f"Context from knowledge graph:\n\n{context}\n\nQuestion: {query}"},
            ],
            stream=True,
            temperature=0.3,
            max_tokens=800,
        )

        async for chunk in stream:
            token = chunk.choices[0].delta.content or ""
            if token:
                full_answer += token
                await store.broadcast(session_id, {
                    "event": "answer_token",
                    "token": token,
                })

    except Exception as e:
        await store.broadcast(session_id, {
            "event": "error",
            "message": f"Answer generation failed: {str(e)}",
        })
        return

    await store.broadcast(session_id, {
        "event": "query_complete",
        "answer": full_answer,
        "retrieved_node_ids": context_nodes,
        "traversal_path": [{"from": f, "to": t} for f, t in traversal_path],
    })
