import { useEffect, useRef, useCallback } from 'react'
import { SynapseEvent } from '../types/graph'

const WS_URL = `ws://${window.location.host}/ws`

export function useWebSocket(
  sessionId: string | null,
  onEvent: (event: SynapseEvent) => void
) {
  const wsRef = useRef<WebSocket | null>(null)
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!sessionId) return

    const ws = new WebSocket(`${WS_URL}/${sessionId}`)
    wsRef.current = ws

    ws.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data) as SynapseEvent
        onEventRef.current(data)
      } catch {
        // ignore malformed messages
      }
    }

    ws.onopen = () => {
      // Connection ready
    }

    ws.onerror = () => {
      // Will reconnect on next sessionId change
    }

    // Keep alive ping
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send('ping')
      }
    }, 20000)

    return () => {
      clearInterval(pingInterval)
      ws.close()
    }
  }, [sessionId])

  const send = useCallback((data: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(data)
    }
  }, [])

  return { send }
}
