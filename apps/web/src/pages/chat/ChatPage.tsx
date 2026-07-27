import { useChatSessions } from '@/features/chat/api/chat.api'
import { ChatSessionList } from '@/features/chat/components/ChatSessionList'
import { ChatWindow } from '@/features/chat/components/ChatWindow'
import { TrainingGoals } from '@/features/chat/components/TrainingGoals'
import { useCallback, useEffect, useRef, useState } from 'react'

const MIN_WIDTH = 160
const MAX_WIDTH = 400
const DEFAULT_WIDTH = 224

export function ChatPage() {
  const { data: sessions = [] } = useChatSessions()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [sidebarWidth, setSidebarWidth] = useState(DEFAULT_WIDTH)
  const dragging = useRef(false)
  const startX = useRef(0)
  const startWidth = useRef(DEFAULT_WIDTH)

  useEffect(() => {
    if (activeSessionId === null) return
    const stillExists = sessions.some((s) => s.id === activeSessionId)
    if (!stillExists) {
      setActiveSessionId(sessions[0]?.id ?? null)
    }
  }, [sessions, activeSessionId])

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      dragging.current = true
      startX.current = e.clientX
      startWidth.current = sidebarWidth
      document.body.style.cursor = 'col-resize'
      document.body.style.userSelect = 'none'
    },
    [sidebarWidth]
  )

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const delta = e.clientX - startX.current
      setSidebarWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, startWidth.current + delta)))
    }
    const onMouseUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
    return () => {
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }
  }, [])

  return (
    <div className="flex h-full w-full overflow-hidden bg-card">
      <aside
        className="relative flex shrink-0 flex-col border-r bg-secondary/35"
        style={{ width: sidebarWidth }}
      >
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatSessionList
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={setActiveSessionId}
          />
        </div>
        <TrainingGoals />
        <div
          className="absolute -right-1 top-0 z-10 h-full w-2 cursor-col-resize transition-colors hover:bg-primary/15 active:bg-primary/25"
          onMouseDown={onMouseDown}
        />
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden bg-card">
        {activeSessionId !== null ? (
          <ChatWindow sessionId={activeSessionId} />
        ) : (
          <div className="chat-texture flex flex-1 items-center justify-center p-8 text-center">
            <div>
              <p className="font-display text-lg font-semibold">Нет открытого диалога</p>
              <p className="mt-1 text-sm text-muted-foreground">Выбери чат слева или создай новый</p>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
