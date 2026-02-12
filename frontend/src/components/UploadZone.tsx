import { useRef, useState, useCallback } from 'react'
import { Upload, FileText } from 'lucide-react'

interface Props {
  sessionId: string
  onUploadStart: (filename: string) => void
}

export default function UploadZone({ sessionId, onUploadStart }: Props) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const upload = useCallback(async (file: File) => {
    onUploadStart(file.name)
    const formData = new FormData()
    formData.append('file', file)
    await fetch(`/upload/${sessionId}`, {
      method: 'POST',
      body: formData,
    })
  }, [sessionId, onUploadStart])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) upload(file)
  }, [upload])

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) upload(file)
  }, [upload])

  return (
    <div className="flex flex-col items-center justify-center h-full gap-8">
      {/* Logo / title */}
      <div className="text-center">
        <h1 className="text-5xl font-light tracking-widest text-white mb-2">SYNAPSE</h1>
        <p className="text-sm text-white/40 tracking-wider">Visual Graph RAG Explorer</p>
      </div>

      {/* Drop zone */}
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative w-80 h-48 rounded-2xl border-2 border-dashed cursor-pointer
          flex flex-col items-center justify-center gap-3 transition-all duration-300
          ${dragging
            ? 'border-cyan-400 bg-cyan-400/10 shadow-[0_0_40px_rgba(0,212,255,0.15)]'
            : 'border-white/20 bg-white/[0.03] hover:border-white/40 hover:bg-white/[0.06]'
          }
        `}
      >
        <Upload
          size={32}
          className={`transition-colors ${dragging ? 'text-cyan-400' : 'text-white/40'}`}
        />
        <div className="text-center">
          <p className={`text-sm font-medium ${dragging ? 'text-cyan-400' : 'text-white/60'}`}>
            {dragging ? 'Drop to upload' : 'Drop a document here'}
          </p>
          <p className="text-xs text-white/30 mt-1">PDF, TXT, DOCX, Markdown</p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,.txt,.md,.docx"
          className="hidden"
          onChange={handleChange}
        />
      </div>

      {/* Supported formats */}
      <div className="flex gap-3">
        {['PDF', 'TXT', 'DOCX', 'MD'].map(fmt => (
          <span key={fmt} className="px-3 py-1 rounded-full text-xs text-white/40 border border-white/10">
            {fmt}
          </span>
        ))}
      </div>
    </div>
  )
}
