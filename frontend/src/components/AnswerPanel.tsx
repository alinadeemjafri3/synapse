import { useEffect, useRef } from 'react'
import { Sparkles, X } from 'lucide-react'

interface Props {
  query: string
  answer: string
  isStreaming: boolean
  onClose: () => void
}

export default function AnswerPanel({ query, answer, isStreaming, onClose }: Props) {
  const endRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [answer])

  if (!query && !answer) return null

  return (
    <div className="fixed left-4 top-1/2 -translate-y-1/2 w-80 z-50
      bg-black/70 backdrop-blur-xl border border-white/10 rounded-2xl
      shadow-2xl max-h-[70vh] flex flex-col">

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-amber-400" />
          <span className="text-xs font-medium text-white/60">Answer</span>
          {isStreaming && (
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1 h-1 rounded-full bg-cyan-400 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          )}
        </div>
        <button onClick={onClose} className="text-white/20 hover:text-white/60 transition-colors">
          <X size={14} />
        </button>
      </div>

      {/* Query */}
      <div className="px-4 py-2 border-b border-white/[0.05]">
        <p className="text-xs text-white/40 italic">&ldquo;{query}&rdquo;</p>
      </div>

      {/* Answer */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {answer ? (
          <p className="text-sm text-white/80 leading-relaxed whitespace-pre-wrap">
            {answer}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-cyan-400 ml-0.5 animate-pulse align-middle" />
            )}
          </p>
        ) : (
          <div className="flex items-center gap-2 text-white/30">
            <span className="text-sm">Thinking</span>
            <span className="flex gap-0.5">
              {[0, 1, 2].map(i => (
                <span
                  key={i}
                  className="w-1.5 h-1.5 rounded-full bg-white/30 animate-bounce"
                  style={{ animationDelay: `${i * 0.15}s` }}
                />
              ))}
            </span>
          </div>
        )}
        <div ref={endRef} />
      </div>
    </div>
  )
}
