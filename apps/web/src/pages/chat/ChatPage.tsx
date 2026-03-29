import { useChatSessions } from '@/features/chat/api/chat.api'
import { ChatSessionList } from '@/features/chat/components/ChatSessionList'
import { ChatWindow } from '@/features/chat/components/ChatWindow'
import { TrainingGoals } from '@/features/chat/components/TrainingGoals'
import { useEffect, useState } from 'react'

export function ChatPage() {
  const { data: sessions = [] } = useChatSessions()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  useEffect(() => {
    if (activeSessionId === null) return
    const stillExists = sessions.some((s) => s.id === activeSessionId)
    if (!stillExists) {
      setActiveSessionId(sessions[0]?.id ?? null)
    }
  }, [sessions, activeSessionId])

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-56 shrink-0 flex-col border-r">
        <div className="min-h-0 flex-1 overflow-hidden">
          <ChatSessionList
            sessions={sessions}
            activeId={activeSessionId}
            onSelect={setActiveSessionId}
          />
        </div>
        <TrainingGoals />
      </aside>

      <main className="flex flex-1 flex-col overflow-hidden">
        {activeSessionId !== null ? (
          <ChatWindow sessionId={activeSessionId} />
        ) : (
          <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
            Выбери чат или создай новый
          </div>
        )}
      </main>
    </div>
  )
}
