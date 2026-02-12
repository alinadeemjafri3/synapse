from typing import Dict, Set
from fastapi import WebSocket
from models import GraphSession


class SessionStore:
    def __init__(self):
        self._sessions: Dict[str, GraphSession] = {}
        self._connections: Dict[str, Set[WebSocket]] = {}

    def create(self, session_id: str) -> GraphSession:
        session = GraphSession(session_id=session_id)
        self._sessions[session_id] = session
        self._connections[session_id] = set()
        return session

    def get(self, session_id: str) -> GraphSession | None:
        return self._sessions.get(session_id)

    def get_or_create(self, session_id: str) -> GraphSession:
        if session_id not in self._sessions:
            return self.create(session_id)
        return self._sessions[session_id]

    def add_connection(self, session_id: str, ws: WebSocket):
        if session_id not in self._connections:
            self._connections[session_id] = set()
        self._connections[session_id].add(ws)

    def remove_connection(self, session_id: str, ws: WebSocket):
        if session_id in self._connections:
            self._connections[session_id].discard(ws)

    async def broadcast(self, session_id: str, data: dict):
        dead = set()
        for ws in self._connections.get(session_id, set()):
            try:
                await ws.send_json(data)
            except Exception:
                dead.add(ws)
        for ws in dead:
            self._connections[session_id].discard(ws)


store = SessionStore()
