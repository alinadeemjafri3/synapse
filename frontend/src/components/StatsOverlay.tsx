import { AppPhase } from '../types/graph'

interface Props {
  phase: AppPhase
  docName: string
  entityCount: number
  edgeCount: number
  chunkProgress: { current: number; total: number } | null
}

export default function StatsOverlay({ phase, docName, entityCount, edgeCount, chunkProgress }: Props) {
  if (phase === 'idle') return null

  return (
    <div className="fixed top-4 right-4 z-50">
      {/* Ingesting */}
      {phase === 'ingesting' && (
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3 flex items-center gap-3 min-w-[240px]">
          <div className="relative w-2 h-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-400" />
          </div>
          <div className="flex-1">
            <p className="text-xs text-white/50 truncate max-w-[180px]">{docName}</p>
            <p className="text-sm text-white font-medium">
              {chunkProgress
                ? `Processing chunk ${chunkProgress.current}/${chunkProgress.total}`
                : 'Building graph...'}
            </p>
            {entityCount > 0 && (
              <p className="text-xs text-cyan-400 mt-0.5">
                {entityCount} entities · {edgeCount} relationships
              </p>
            )}
          </div>
        </div>
      )}

      {/* Ready */}
      {(phase === 'ready' || phase === 'querying' || phase === 'answered') && (
        <div className="bg-black/60 backdrop-blur-xl border border-white/10 rounded-xl px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-emerald-400" />
            <div>
              <p className="text-xs text-white/50 truncate max-w-[180px]">{docName}</p>
              <p className="text-xs text-white/60">
                <span className="text-white font-medium">{entityCount}</span> entities ·{' '}
                <span className="text-white font-medium">{edgeCount}</span> relationships
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
