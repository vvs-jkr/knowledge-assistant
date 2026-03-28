import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { useChatMessages, useSendMessage } from '@/features/chat/api/chat.api'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/shared/schemas/chat.schema'
import { Send } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  sessionId: string
}

export function ChatWindow({ sessionId }: Props) {
  const { data: messages = [], isLoading } = useChatMessages(sessionId)
  const sendMessage = useSendMessage(sessionId)
  const [input, setInput] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)

  const lastMessageId = messages[messages.length - 1]?.id
  useEffect(() => {
    if (lastMessageId !== undefined) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lastMessageId])

  const handleSend = () => {
    const content = input.trim()
    if (!content || sendMessage.isPending) return
    setInput('')
    sendMessage.mutate(content)
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  if (isLoading) {
    return (
      <div className="flex flex-1 items-center justify-center text-sm text-muted-foreground">
        Загрузка...
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      <ScrollArea className="flex-1 px-4 py-4">
        {messages.length === 0 && !sendMessage.isPending && (
          <p className="text-center text-sm text-muted-foreground">
            Задай вопрос о тренировках или здоровье
          </p>
        )}

        <div className="flex flex-col gap-3">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} />
          ))}

          {sendMessage.isPending && (
            <div className="flex justify-start">
              <div className="max-w-[75%] rounded-2xl rounded-tl-sm bg-muted px-4 py-2.5 text-sm">
                <span className="animate-pulse text-muted-foreground">Печатает...</span>
              </div>
            </div>
          )}

          {sendMessage.isError && (
            <p className="text-center text-xs text-destructive">Ошибка. Попробуй ещё раз.</p>
          )}
        </div>

        <div ref={bottomRef} />
      </ScrollArea>

      <div className="border-t px-4 py-3">
        <div className="flex gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Напиши вопрос... (Enter -- отправить, Shift+Enter -- новая строка)"
            rows={1}
            disabled={sendMessage.isPending}
            className="min-h-[38px] flex-1 resize-none rounded-md border border-input bg-transparent px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50"
          />
          <Button
            size="icon"
            onClick={handleSend}
            disabled={!input.trim() || sendMessage.isPending}
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  )
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div className={cn('flex', isUser ? 'justify-end' : 'justify-start')}>
      <div
        className={cn(
          'max-w-[75%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap',
          isUser
            ? 'rounded-tr-sm bg-primary text-primary-foreground'
            : 'rounded-tl-sm bg-muted text-foreground'
        )}
      >
        {message.content}
      </div>
    </div>
  )
}
