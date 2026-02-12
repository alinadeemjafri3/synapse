import { X } from 'lucide-react'
import { GraphNode } from '../types/graph'

const TYPE_COLORS: Record<string, string> = {
  CONCEPT: 'text-blue-400 border-blue-400/30 bg-blue-400/10',
  PERSON: 'text-red-400 border-red-400/30 bg-red-400/10',
  ORG: 'text-orange-400 border-orange-400/30 bg-orange-400/10',
  DATE: 'text-green-400 border-green-400/30 bg-green-400/10',
  LOCATION: 'text-purple-400 border-purple-400/30 bg-purple-400/10',
  TERM: 'text-pink-400 border-pink-400/30 bg-pink-400/10',
  EVENT: 'text-yellow-400 border-yellow-400/30 bg-yellow-400/10',
}

interface Props {
  node: GraphNode | null
  score?: number
  isRetrieved: boolean
  onClose: () => void
}

export default function NodeDetailPanel({ node, score, isRetrieved, onClose }: Props) {
  if (!node) return null

  const typeStyle = TYPE_COLORS[node.type] || 'text-white/60 border-white/20 bg-white/5'

  return (
    <div className="fixed right-4 top-1/2 -translate-y-1/2 w-72 z-50
      bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl p-5
      shadow-2xl animate-in slide-in-from-right duration-200">

      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 pr-2">
          <h3 className="text-white font-medium text-base leading-tight">{node.label}</h3>
          {isRetrieved && (
            <p className="text-xs text-amber-400 mt-0.5">Retrieved for this query</p>
          )}
        </div>
        <button onClick={onClose} className="text-white/30 hover:text-white/80 transition-colors mt-0.5">
          <X size={16} />
        </button>
      </div>

      {/* Type badge */}
      <span className={`inline-flex px-2 py-0.5 rounded-full text-xs border font-medium ${typeStyle}`}>
        {node.type}
      </span>

      {/* Description */}
      {node.description && (
        <p className="text-white/60 text-sm mt-3 leading-relaxed">{node.description}</p>
      )}

      {/* Stats */}
      <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between">
        <span className="text-xs text-white/30">
          {node.connection_count} connection{node.connection_count !== 1 ? 's' : ''}
        </span>
        {score !== undefined && score > 0 && (
          <span className="text-xs text-white/30">
            Relevance: <span className="text-cyan-400">{(score * 100).toFixed(0)}%</span>
          </span>
        )}
      </div>

      {/* Source */}
      {node.source_doc && (
        <p className="text-xs text-white/20 mt-2 truncate">From: {node.source_doc}</p>
      )}
    </div>
  )
}
