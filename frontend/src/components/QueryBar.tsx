import { useState, useRef, useCallback } from 'react'
import { Search, Loader2 } from 'lucide-react'
import { AppPhase } from '../types/graph'

interface Props {
  sessionId: string
  phase: AppPhase
  onQuerySubmit: (query: string) => void
}

export default function QueryBar({ sessionId, phase, onQuerySubmit }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const isLoading = phase === 'querying'
  const isDisabled = phase === 'idle' || phase === 'ingesting' || isLoading

  const submit = useCallback(async () => {
    const q = query.trim()
    if (!q || isDisabled) return

    onQuerySubmit(q)

    await fetch(`/query/${sessionId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: q }),
    })

    setQuery('')
  }, [query, isDisabled, sessionId, onQuerySubmit])

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      submit()
    }
  }

  const placeholder =
    phase === 'idle' ? 'Upload a document to begin...' :
    phase === 'ingesting' ? 'Building your graph...' :
    'Ask anything about your document...'

  return (
    <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 w-full max-w-2xl px-4">
      <div className={`
        flex items-center gap-3 rounded-2xl px-4 py-3
        bg-black/70 backdrop-blur-xl border transition-all duration-300
        ${isDisabled ? 'border-white/10' : 'border-white/20 shadow-[0_0_40px_rgba(0,212,255,0.08)]'}
        ${!isDisabled && query ? 'shadow-[0_0_40px_rgba(0,212,255,0.15)]' : ''}
      `}>
        {isLoading ? (
          <Loader2 size={18} className="text-cyan-400 animate-spin shrink-0" />
        ) : (
          <Search size={18} className={`shrink-0 ${isDisabled ? 'text-white/20' : 'text-white/40'}`} />
        )}

        <input
          ref={inputRef}
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={handleKey}
          disabled={isDisabled}
          placeholder={placeholder}
          className={`
            flex-1 bg-transparent border-none outline-none text-sm
            ${isDisabled ? 'text-white/20 placeholder:text-white/15' : 'text-white placeholder:text-white/30'}
          `}
        />

        {!isDisabled && (
          <button
            onClick={submit}
            disabled={!query.trim()}
            className={`
              shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium transition-all duration-200
              ${query.trim()
                ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 hover:bg-cyan-500/30'
                : 'text-white/20 border border-white/10'}
            `}
          >
            ↵ Ask
          </button>
        )}
      </div>

      {phase === 'ready' && (
        <p className="text-center text-xs text-white/20 mt-2">
          Press Enter to explore the knowledge graph
        </p>
      )}
    </div>
  )
}
