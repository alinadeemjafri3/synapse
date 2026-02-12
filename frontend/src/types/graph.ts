export type EntityType = 'CONCEPT' | 'PERSON' | 'ORG' | 'DATE' | 'LOCATION' | 'TERM' | 'EVENT'

export interface GraphNode {
  id: string
  label: string
  type: EntityType
  description: string
  color: string
  source_doc: string
  connection_count: number
  // Runtime visual state
  score?: number
  isTraversed?: boolean
  isRetrieved?: boolean
  glowIntensity?: number
  // force-graph positioning
  x?: number
  y?: number
  vx?: number
  vy?: number
  fx?: number
  fy?: number
}

export interface GraphEdge {
  id: string
  source: string | GraphNode
  target: string | GraphNode
  label: string
  source_sentence: string
  // Runtime visual state
  isTraversed?: boolean
  particleCount?: number
}

export interface GraphData {
  nodes: GraphNode[]
  links: GraphEdge[]
}

export type SynapseEvent =
  | { event: 'ingestion_started'; doc_name: string }
  | { event: 'ingestion_progress'; message: string; total_chunks: number }
  | { event: 'chunk_processing'; chunk: number; total: number }
  | { event: 'entity_extracted'; node: Omit<GraphNode, 'score' | 'isTraversed' | 'isRetrieved' | 'glowIntensity'> }
  | { event: 'edge_extracted'; edge: { id: string; source: string; target: string; label: string; source_sentence: string } }
  | { event: 'ingestion_complete'; stats: { entities: number; relationships: number; chunks_processed: number }; nodes: Omit<GraphNode, 'score' | 'isTraversed' | 'isRetrieved' | 'glowIntensity'>[]; edges: { id: string; source: string; target: string; label: string; source_sentence: string }[] }
  | { event: 'query_received'; query: string; tokens: string[] }
  | { event: 'node_scored'; node_id: string; score: number }
  | { event: 'traversal_hop'; from_id: string; to_id: string }
  | { event: 'node_retrieved'; node_id: string; context: string }
  | { event: 'answer_start' }
  | { event: 'answer_token'; token: string }
  | { event: 'query_complete'; answer: string; retrieved_node_ids: string[]; traversal_path: { from: string; to: string }[] }
  | { event: 'graph_state'; graph: { nodes: GraphNode[]; links: GraphEdge[] } }
  | { event: 'error'; message: string }
  | { event: 'heartbeat' }
  | { event: 'pong' }
  | { event: 'chunk_error'; chunk: number; error: string }

export type AppPhase = 'idle' | 'ingesting' | 'ready' | 'querying' | 'answered'
