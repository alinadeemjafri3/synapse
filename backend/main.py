import os
import uuid
import asyncio
from pathlib import Path
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

# Load .env from project root (one level up from backend/)
load_dotenv(Path(__file__).parent.parent / ".env")

from session import store
from ingestion import ingest_document
from query_engine import run_query

app = FastAPI(title="Synapse API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

FRONTEND_DIST = Path(__file__).parent.parent / "frontend" / "dist"

def get_api_key() -> str:
    return os.environ.get("XAI_API_KEY", "")


@app.post("/session")
async def create_session():
    session_id = str(uuid.uuid4())
    store.create(session_id)
    return {"session_id": session_id}


@app.get("/session/{session_id}")
async def get_session(session_id: str):
    session = store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    return session.to_dict()


@app.post("/upload/{session_id}")
async def upload_document(
    session_id: str,
    file: UploadFile = File(...),
):
    session = store.get_or_create(session_id)
    content = await file.read()
    filename = file.filename or "document.txt"

    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="XAI_API_KEY not configured")

    # Run ingestion in background so HTTP response returns immediately
    asyncio.create_task(ingest_document(session_id, content, filename, api_key))

    return {"status": "ingestion_started", "filename": filename}


@app.post("/query/{session_id}")
async def query(session_id: str, body: dict):
    q = body.get("query", "").strip()
    if not q:
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    session = store.get(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")

    api_key = get_api_key()
    if not api_key:
        raise HTTPException(status_code=500, detail="XAI_API_KEY not configured")

    asyncio.create_task(run_query(session_id, q, api_key))

    return {"status": "query_started"}


@app.websocket("/ws/{session_id}")
async def websocket_endpoint(websocket: WebSocket, session_id: str):
    await websocket.accept()
    store.get_or_create(session_id)
    store.add_connection(session_id, websocket)

    try:
        # Send current graph state on connect
        session = store.get(session_id)
        if session and session.nodes:
            await websocket.send_json({
                "event": "graph_state",
                "graph": session.to_dict(),
            })

        # Keep alive
        while True:
            try:
                data = await asyncio.wait_for(websocket.receive_text(), timeout=30)
                # Client can send pings
                if data == "ping":
                    await websocket.send_json({"event": "pong"})
            except asyncio.TimeoutError:
                await websocket.send_json({"event": "heartbeat"})

    except WebSocketDisconnect:
        store.remove_connection(session_id, websocket)
    except Exception:
        store.remove_connection(session_id, websocket)


@app.get("/health")
async def health():
    return {"status": "ok"}


# Serve React frontend — must be last so API routes take priority
if FRONTEND_DIST.exists():
    app.mount("/assets", StaticFiles(directory=FRONTEND_DIST / "assets"), name="assets")

    @app.get("/{full_path:path}")
    async def serve_frontend(full_path: str):
        return FileResponse(FRONTEND_DIST / "index.html")


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 8000))
    uvicorn.run("main:app", host="0.0.0.0", port=port, reload=False)
