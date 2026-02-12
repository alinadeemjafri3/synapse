import { useState, useCallback, useEffect, useRef } from 'react'
import { GraphData, GraphNode, GraphEdge, SynapseEvent, AppPhase } from './types/graph'
import { useWebSocket } from './hooks/useWebSocket'
import GraphCanvas from './components/GraphCanvas'
import UploadZone from './components/UploadZone'
import QueryBar from './components/QueryBar'
import AnswerPanel from './components/AnswerPanel'
import NodeDetailPanel from './components/NodeDetailPanel'
import StatsOverlay from './components/StatsOverlay'

const API = ''

export default function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [phase, setPhase] = useState<AppPhase>('idle')
  const [docName, setDocName] = useState('')

  // Graph data
  const [graphData, setGraphData] = useState<GraphData>({ nodes: [], links: [] })

  // Visual state
  const [nodeScores, setNodeScores] = useState<Record<string, number>>({})
  const [highlightedNodeIds, setHighlightedNodeIds] = useState<Set<string>>(new Set())
  const [retrievedNodeIds, setRetrievedNodeIds] = useState<Set<string>>(new Set())
  const [traversedEdgeIds, setTraversedEdgeIds] = useState<Set<string>>(new Set())
  const [activeTraversal, setActiveTraversal] = useState<{ from: string; to: string } | null>(null)

  // Answer
  const [currentQuery, setCurrentQuery] = useState('')
  const [answerText, setAnswerText] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [showAnswer, setShowAnswer] = useState(false)

  // Node detail
  const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null)

  // Stats
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null)
  const entityCount = graphData.nodes.length
  const edgeCount = graphData.links.length

  // Initialise session
  useEffect(() => {
    fetch(`${API}/session`, { method: 'POST' })
      .then(r => r.json())
      .then(d => setSessionId(d.session_id))
  }, [])

  // Handle all websocket events
  const handleEvent = useCallback((event: SynapseEvent) => {
    switch (event.event) {
      case 'ingestion_started':
        setPhase('ingesting')
        setDocName(event.doc_name)
        setGraphData({ nodes: [], links: [] })
        setNodeScores({})
        setHighlightedNodeIds(new Set())
        setRetrievedNodeIds(new Set())
        setTraversedEdgeIds(new Set())
        break

      case 'chunk_processing':
        setChunkProgress({ current: event.chunk, total: event.total })
        break

      case 'ingestion_complete': {
        setChunkProgress(null)
        const rawNodes: GraphNode[] = event.nodes.map(n => ({
          ...n,
          score: 0,
          isTraversed: false,
          isRetrieved: false,
          glowIntensity: 0,
        }))
        const rawEdges: GraphEdge[] = event.edges.map(e => ({
          ...e,
          isTraversed: false,
          particleCount: 0,
        }))
        // Cap total reveal animation: ~3s for nodes, ~1.5s for edges
        const nodeDelay = rawNodes.length > 0 ? Math.min(30, 3000 / rawNodes.length) : 20
        const edgeDelay = rawEdges.length > 0 ? Math.min(15, 1500 / rawEdges.length) : 10
        rawNodes.forEach((node, i) => {
          setTimeout(() => {
            setGraphData(prev => ({ ...prev, nodes: [...prev.nodes, node] }))
          }, i * nodeDelay)
        })
        const totalNodeTime = rawNodes.length * nodeDelay
        rawEdges.forEach((edge, i) => {
          setTimeout(() => {
            setGraphData(prev => ({ ...prev, links: [...prev.links, edge] }))
          }, totalNodeTime + i * edgeDelay)
        })
        setTimeout(() => setPhase('ready'), totalNodeTime + rawEdges.length * edgeDelay)
        break
      }

      case 'query_received':
        setPhase('querying')
        setCurrentQuery(event.query)
        setAnswerText('')
        setIsStreaming(false)
        setShowAnswer(false)
        // Reset visual state
        setNodeScores({})
        setHighlightedNodeIds(new Set())
        setRetrievedNodeIds(new Set())
        setTraversedEdgeIds(new Set())
        break

      case 'node_scored': {
        const score = event.score
        setNodeScores(prev => ({ ...prev, [event.node_id]: score }))
        if (score > 0.1) {
          setHighlightedNodeIds(prev => new Set([...prev, event.node_id]))
        }
        break
      }

      case 'traversal_hop': {
        const key = `${event.from_id}-${event.to_id}`
        setTraversedEdgeIds(prev => new Set([...prev, key]))
        setHighlightedNodeIds(prev => new Set([...prev, event.from_id, event.to_id]))
        setActiveTraversal({ from: event.from_id, to: event.to_id })
        setTimeout(() => setActiveTraversal(null), 600)
        break
      }

      case 'node_retrieved':
        setRetrievedNodeIds(prev => new Set([...prev, event.node_id]))
        break

      case 'answer_start':
        setIsStreaming(true)
        setShowAnswer(true)
        break

      case 'answer_token':
        setAnswerText(prev => prev + event.token)
        break

      case 'query_complete':
        setIsStreaming(false)
        setPhase('answered')
        break

      case 'graph_state': {
        // Reconnect with existing graph
        const nodes: GraphNode[] = event.graph.nodes.map((n: any) => ({
          ...n,
          score: 0,
          isTraversed: false,
          isRetrieved: false,
          glowIntensity: 0,
        }))
        setGraphData({ nodes, links: (event.graph as any).edges as GraphEdge[] })
        setPhase('ready')
        break
      }

      case 'error':
        console.error('Synapse error:', event.message)
        if (phase === 'ingesting') setPhase('idle')
        if (phase === 'querying') setPhase('ready')
        break
    }
  }, [phase])

  useWebSocket(sessionId, handleEvent)

  const handleUploadStart = useCallback((filename: string) => {
    setDocName(filename)
  }, [])

  const handleQuerySubmit = useCallback((query: string) => {
    setCurrentQuery(query)
  }, [])

  const handleNodeClick = useCallback((node: GraphNode) => {
    setSelectedNode(prev => prev?.id === node.id ? null : node)
  }, [])

  const showGraph = phase !== 'idle'

  return (
    <div className="w-screen h-screen bg-[#0a0a0f] overflow-hidden relative">

      {/* Graph canvas — always rendered when we have data */}
      {showGraph && sessionId && (
        <GraphCanvas
          graphData={graphData}
          onNodeClick={handleNodeClick}
          highlightedNodeIds={highlightedNodeIds}
          retrievedNodeIds={retrievedNodeIds}
          traversedEdgeIds={traversedEdgeIds}
          nodeScores={nodeScores}
          activeTraversal={activeTraversal}
        />
      )}

      {/* Upload screen overlay */}
      {phase === 'idle' && sessionId && (
        <div className="absolute inset-0 flex items-center justify-center">
          <UploadZone sessionId={sessionId} onUploadStart={handleUploadStart} />
        </div>
      )}

      {/* Status overlay */}
      <StatsOverlay
        phase={phase}
        docName={docName}
        entityCount={entityCount}
        edgeCount={edgeCount}
        chunkProgress={chunkProgress}
      />

      {/* Query bar */}
      {sessionId && (
        <QueryBar
          sessionId={sessionId}
          phase={phase}
          onQuerySubmit={handleQuerySubmit}
        />
      )}

      {/* Answer panel */}
      {showAnswer && (
        <AnswerPanel
          query={currentQuery}
          answer={answerText}
          isStreaming={isStreaming}
          onClose={() => setShowAnswer(false)}
        />
      )}

      {/* Node detail panel */}
      <NodeDetailPanel
        node={selectedNode}
        score={selectedNode ? nodeScores[selectedNode.id] : undefined}
        isRetrieved={selectedNode ? retrievedNodeIds.has(selectedNode.id) : false}
        onClose={() => setSelectedNode(null)}
      />
    </div>
  )
}
