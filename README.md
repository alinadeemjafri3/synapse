# Synapse — Visual Graph RAG Explorer

Upload a document. Watch AI build a knowledge graph in real time. Ask questions and see it traverse the graph like lightning.

## Stack

- **Frontend:** React + Vite + TypeScript + react-force-graph-2d + Tailwind
- **Backend:** FastAPI + WebSockets + NetworkX + scikit-learn
- **AI:** xAI Grok 4 (entity extraction + answer generation)

## Quick Start

### 1. Set up environment

Create a `.env` file in the project root (see `.env.example`):
```
XAI_API_KEY=your_xai_api_key_here
```
Get a key at [console.x.ai](https://console.x.ai)

### 2. Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
python main.py
```

### 3. Frontend

```bash
cd frontend
npm install
npm run build
```

Open **http://localhost:8000** (backend serves the built frontend)

## Deployment

Deploy to [Railway](https://railway.app):
1. Push this repo to GitHub
2. Connect repo in Railway → New Project → Deploy from GitHub
3. Add environment variable: `XAI_API_KEY=your_key`
4. Railway auto-deploys on every push

## How it works

1. Upload a PDF, TXT, DOCX, or Markdown file
2. The backend chunks the text and calls Grok 4 to extract entities and relationships
3. Each extracted entity/relationship streams to the frontend via WebSocket — you watch the graph build live
4. Ask a question — TF-IDF scores every node against your query
5. BFS traversal follows edges to find related context, animated as cyan lightning
6. Grok 4 generates an answer from the retrieved context, streamed token by token

## Project Structure

```
synapse/
├── backend/
│   ├── main.py          # FastAPI app + WebSocket + REST routes
│   ├── ingestion.py     # Document → knowledge graph pipeline
│   ├── query_engine.py  # Query → traversal → streamed answer
│   ├── models.py        # Node, Edge, GraphSession dataclasses
│   ├── session.py       # In-memory session + WebSocket broadcast
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx                    # Main state machine
│       ├── components/
│       │   ├── GraphCanvas.tsx        # react-force-graph-2d + glow effects
│       │   ├── UploadZone.tsx         # Drag & drop upload
│       │   ├── QueryBar.tsx           # Search input
│       │   ├── AnswerPanel.tsx        # Streaming answer display
│       │   ├── NodeDetailPanel.tsx    # Click a node to inspect it
│       │   └── StatsOverlay.tsx       # Live ingestion stats
│       ├── hooks/useWebSocket.ts      # WebSocket connection + keep-alive
│       └── types/graph.ts             # All TypeScript types + event schema
├── .env.example                       # Copy to .env and add your API key
└── Procfile                           # Railway deployment config
```
