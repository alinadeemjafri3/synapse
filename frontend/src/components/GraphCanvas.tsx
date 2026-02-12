import { useRef, useCallback, useEffect, useState } from 'react'
import ForceGraph2D from 'react-force-graph-2d'
import { GraphData, GraphNode, GraphEdge } from '../types/graph'

interface Props {
  graphData: GraphData
  onNodeClick: (node: GraphNode) => void
  highlightedNodeIds: Set<string>
  retrievedNodeIds: Set<string>
  traversedEdgeIds: Set<string>
  nodeScores: Record<string, number>
  activeTraversal: { from: string; to: string } | null
}

const ENTITY_COLORS: Record<string, string> = {
  CONCEPT: '#3a7bd5',
  PERSON: '#e8676b',
  ORG: '#f5a623',
  DATE: '#7bed9f',
  LOCATION: '#a29bfe',
  TERM: '#fd79a8',
  EVENT: '#fdcb6e',
}

export default function GraphCanvas({
  graphData,
  onNodeClick,
  highlightedNodeIds,
  retrievedNodeIds,
  traversedEdgeIds,
  nodeScores,
  activeTraversal,
}: Props) {
  const fgRef = useRef<any>(null)
  const [dimensions, setDimensions] = useState({ width: window.innerWidth, height: window.innerHeight })

  useEffect(() => {
    const handleResize = () => {
      setDimensions({ width: window.innerWidth, height: window.innerHeight })
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Auto-zoom to fit and set repulsion when nodes arrive
  useEffect(() => {
    if (fgRef.current && graphData.nodes.length > 0) {
      fgRef.current.d3Force('charge')?.strength(-100)
      setTimeout(() => fgRef.current?.zoomToFit(400, 80), 500)
    }
  }, [graphData.nodes.length])

  const paintNode = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      const gNode = node as GraphNode
      const isRetrieved = retrievedNodeIds.has(gNode.id)
      const isHighlighted = highlightedNodeIds.has(gNode.id)
      const score = nodeScores[gNode.id] || 0
      const baseColor = ENTITY_COLORS[gNode.type] || '#3a7bd5'

      const baseR = Math.max(4, Math.min(14, 4 + (gNode.connection_count || 0) * 1.2))
      const r = isRetrieved ? baseR * 1.5 : isHighlighted ? baseR * 1.2 : baseR

      // Glow effect
      if (isRetrieved) {
        ctx.shadowBlur = 24
        ctx.shadowColor = '#f5a623'
      } else if (isHighlighted) {
        const intensity = Math.min(score * 30, 20)
        ctx.shadowBlur = intensity
        ctx.shadowColor = '#ffffff'
      } else if (score > 0.1) {
        ctx.shadowBlur = score * 15
        ctx.shadowColor = baseColor
      } else {
        ctx.shadowBlur = 0
      }

      // Node circle
      ctx.beginPath()
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)

      if (isRetrieved) {
        ctx.fillStyle = '#f5a623'
      } else if (isHighlighted) {
        const alpha = 0.4 + score * 0.6
        ctx.fillStyle = `rgba(255,255,255,${alpha})`
      } else {
        ctx.fillStyle = baseColor
      }
      ctx.fill()

      // Outer ring for traversed/retrieved nodes
      if (isRetrieved || isHighlighted) {
        ctx.beginPath()
        ctx.arc(node.x, node.y, r + 2, 0, 2 * Math.PI, false)
        ctx.strokeStyle = isRetrieved ? 'rgba(245,166,35,0.5)' : 'rgba(255,255,255,0.3)'
        ctx.lineWidth = 1
        ctx.stroke()
      }

      // Expanding pulse ring for active traversal hop
      const isActiveHop = activeTraversal && (gNode.id === activeTraversal.from || gNode.id === activeTraversal.to)
      if (isActiveHop) {
        const pulse = (Math.sin(Date.now() / 120) + 1) / 2
        const ringR = r + 4 + pulse * 10
        ctx.beginPath()
        ctx.arc(node.x, node.y, ringR, 0, 2 * Math.PI, false)
        ctx.strokeStyle = `rgba(0, 212, 255, ${0.9 - pulse * 0.7})`
        ctx.lineWidth = 2.5
        ctx.stroke()
        // Second outer ring
        ctx.beginPath()
        ctx.arc(node.x, node.y, ringR + 6, 0, 2 * Math.PI, false)
        ctx.strokeStyle = `rgba(0, 212, 255, ${0.4 - pulse * 0.35})`
        ctx.lineWidth = 1.5
        ctx.stroke()
      }

      // Pulsing glow for retrieved nodes
      if (isRetrieved) {
        const pulse = (Math.sin(Date.now() / 350) + 1) / 2
        ctx.shadowBlur = 18 + pulse * 18
        ctx.shadowColor = '#f5a623'
        ctx.beginPath()
        ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false)
        ctx.fillStyle = '#f5a623'
        ctx.fill()
      }

      // Reset shadow
      ctx.shadowBlur = 0

      // Label — only render when meaningful to reduce clutter
      const showLabel =
        isRetrieved ||
        isHighlighted ||
        (globalScale > 0.55 && (gNode.connection_count || 0) >= 3) ||
        globalScale > 1.1

      if (showLabel) {
        const fontSize = Math.max(9, Math.min(13, 11 / globalScale))
        ctx.font = `${fontSize}px Inter, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillStyle = isRetrieved ? '#ffffff' : isHighlighted ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.6)'
        ctx.fillText(gNode.label, node.x, node.y + r + fontSize * 0.8)
      }
    },
    [retrievedNodeIds, highlightedNodeIds, nodeScores]
  )

  const getLinkColor = useCallback(
    (link: any) => {
      const edge = link as GraphEdge
      const srcId = typeof edge.source === 'string' ? edge.source : edge.source?.id
      const tgtId = typeof edge.target === 'string' ? edge.target : edge.target?.id
      const edgeKey = `${srcId}-${tgtId}`
      const edgeKeyRev = `${tgtId}-${srcId}`

      if (traversedEdgeIds.has(edgeKey) || traversedEdgeIds.has(edgeKeyRev)) {
        return '#00d4ff'
      }
      return 'rgba(255,255,255,0.35)'
    },
    [traversedEdgeIds]
  )

  const getLinkParticles = useCallback(
    (link: any) => {
      const edge = link as GraphEdge
      const srcId = typeof edge.source === 'string' ? edge.source : edge.source?.id
      const tgtId = typeof edge.target === 'string' ? edge.target : edge.target?.id
      const edgeKey = `${srcId}-${tgtId}`
      const edgeKeyRev = `${tgtId}-${srcId}`

      if (traversedEdgeIds.has(edgeKey) || traversedEdgeIds.has(edgeKeyRev)) {
        return 10
      }
      return 0
    },
    [traversedEdgeIds]
  )

  return (
    <ForceGraph2D
      ref={fgRef}
      width={dimensions.width}
      height={dimensions.height}
      graphData={graphData}
      backgroundColor="#0a0a0f"
      nodeCanvasObject={paintNode}
      nodeCanvasObjectMode={() => 'replace'}
      linkColor={getLinkColor}
      linkWidth={(link: any) => {
        const edge = link as GraphEdge
        const srcId = typeof edge.source === 'string' ? edge.source : edge.source?.id
        const tgtId = typeof edge.target === 'string' ? edge.target : edge.target?.id
        const edgeKey = `${srcId}-${tgtId}`
        const edgeKeyRev = `${tgtId}-${srcId}`
        return traversedEdgeIds.has(edgeKey) || traversedEdgeIds.has(edgeKeyRev) ? 2 : 1
      }}
      linkDirectionalParticles={getLinkParticles}
      linkDirectionalParticleWidth={5}
      linkDirectionalParticleSpeed={0.025}
      linkDirectionalParticleColor={() => '#00d4ff'}
      linkLabel={(link: any) => (link as GraphEdge).label || ''}
      linkHoverPrecision={6}
      linkCurvature={0.1}
      onNodeClick={(node: any) => onNodeClick(node as GraphNode)}
      enableNodeDrag={true}
      enableZoomInteraction={true}
      enablePanInteraction={true}
      nodeRelSize={1}
      cooldownTicks={200}
      d3AlphaDecay={0.015}
      d3VelocityDecay={0.25}
    />
  )
}
