import { useChatSessions } from '@/features/chat/api/chat.api'
import { ChatSessionList } from '@/features/chat/components/ChatSessionList'
import { ChatWindow } from '@/features/chat/components/ChatWindow'
import { useState } from 'react'

export function ChatPage() {
  const { data: sessions = [] } = useChatSessions()
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId) ?? null

  // If active session was deleted, reset.
  if (activeSessionId !== null && activeSession === null && sessions.length > 0) {
    setActiveSessionId(sessions[0].id)
  }

  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="w-56 shrink-0 border-r">
        <ChatSessionList
          sessions={sessions}
          activeId={activeSessionId}
          onSelect={setActiveSessionId}
        />
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
