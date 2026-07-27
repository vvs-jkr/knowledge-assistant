import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  useChatMessages,
  useEditMessage,
  useRegenerateMessage,
  useSendMessage,
} from '@/features/chat/api/chat.api'
import { cn } from '@/lib/utils'
import type { ChatMessage } from '@/shared/schemas/chat.schema'
import { Bot, Check, Pencil, RotateCcw, Send, Sparkles, X } from 'lucide-react'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import ReactMarkdown from 'react-markdown'

interface Props {
  sessionId: string
}

export function ChatWindow({ sessionId }: Props) {
  const { data: messages = [], isLoading } = useChatMessages(sessionId)
  const sendMessage = useSendMessage(sessionId)
  const editMessage = useEditMessage(sessionId)
  const regenerateMessage = useRegenerateMessage(sessionId)
  const [input, setInput] = useState('')
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editContent, setEditContent] = useState('')
  const bottomRef = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const lastMessageId = messages[messages.length - 1]?.id
  const isGenerating =
    sendMessage.isPending || editMessage.isPending || regenerateMessage.isPending
  useEffect(() => {
    if (lastMessageId !== undefined) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [lastMessageId])

  const handleResize = (el: HTMLTextAreaElement) => {
    el.style.height = 'auto'
    const maxHeight = 220
    el.style.height = `${Math.min(el.scrollHeight, maxHeight)}px`
    el.style.overflowY = el.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }

  useLayoutEffect(() => {
    if (textareaRef.current) {
      handleResize(textareaRef.current)
    }
  }, [input])

  const handleSend = () => {
    const content = input.trim()
    if (!content || isGenerating) return
    setInput('')
    sendMessage.mutate(content)
  }

  const handleStartEdit = (message: ChatMessage) => {
    setEditingMessageId(message.id)
    setEditContent(message.content)
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditContent('')
  }

  const handleSaveEdit = () => {
    const content = editContent.trim()
    if (!editingMessageId || !content || isGenerating) return
    editMessage.mutate(
      { messageId: editingMessageId, content },
      { onSuccess: handleCancelEdit }
    )
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
    <div className="flex h-full flex-col bg-card">
      <ScrollArea className="chat-texture flex-1">
        <div className="mx-auto flex min-h-full w-full max-w-5xl flex-col px-4 py-6 md:px-8">
          {messages.length === 0 && !isGenerating && (
            <div className="fade-rise my-auto flex flex-col items-center py-12 text-center">
              <div className="mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-[0_16px_38px_-18px_hsl(var(--primary)/0.9)]">
                <Sparkles className="h-6 w-6" />
              </div>
              <h2 className="font-display text-2xl font-semibold tracking-tight">С чего начнём?</h2>
              <p className="mt-2 max-w-md text-sm leading-6 text-muted-foreground">
                Спроси о тренировках, восстановлении, показателях здоровья или материалах из базы.
              </p>
              <div className="mt-6 flex max-w-2xl flex-wrap justify-center gap-2">
                {[
                  'Составь тренировку на сегодня',
                  'Разбери мою последнюю тренировку',
                  'Что изменилось в показателях здоровья?',
                ].map((suggestion) => (
                  <button
                    key={suggestion}
                    type="button"
                    onClick={() => setInput(suggestion)}
                    className="rounded-full border bg-card px-3.5 py-2 text-xs text-muted-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:border-primary/35 hover:text-foreground hover:shadow-md"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4">
          {messages.map((msg, index) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              isEditing={editingMessageId === msg.id}
              editContent={editContent}
              hasFollowingMessages={index < messages.length - 1}
              canRegenerate={msg.role === 'assistant' && msg.id === lastMessageId}
              disabled={isGenerating}
              onStartEdit={() => handleStartEdit(msg)}
              onEditContentChange={setEditContent}
              onCancelEdit={handleCancelEdit}
              onSaveEdit={handleSaveEdit}
              onRegenerate={() => regenerateMessage.mutate(msg.id)}
            />
          ))}

          {isGenerating && (
            <div className="fade-rise flex items-center gap-2.5">
              <div className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground">
                <Bot className="h-4 w-4" />
              </div>
              <div className="rounded-2xl rounded-bl-md border bg-card px-4 py-2.5 text-sm shadow-sm">
                <span className="animate-pulse text-muted-foreground">Формирую ответ...</span>
              </div>
            </div>
          )}

          {(sendMessage.isError || editMessage.isError || regenerateMessage.isError) && (
            <p className="text-center text-xs text-destructive">Ошибка. Попробуй ещё раз.</p>
          )}
          </div>

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      <div className="bg-gradient-to-t from-card via-card to-card/0 px-3 pb-3 pt-2 md:px-8 md:pb-5">
        <div className="mx-auto max-w-5xl rounded-2xl border bg-background/90 p-2.5 shadow-[0_16px_50px_-28px_hsl(var(--foreground)/0.55)] backdrop-blur-md focus-within:border-primary/45 focus-within:ring-2 focus-within:ring-primary/10">
          <TokenCounter messages={messages} />
          <div className="flex items-end gap-2">
            <textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Напиши сообщение..."
              rows={3}
              disabled={isGenerating}
              className="min-h-[84px] max-h-[220px] flex-1 resize-none bg-transparent px-2 py-2 text-sm leading-6 placeholder:text-muted-foreground focus-visible:outline-none disabled:opacity-50"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!input.trim() || isGenerating}
              className="h-11 w-11 shrink-0 rounded-xl shadow-sm"
              title="Отправить"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
          <p className="px-2 pb-0.5 pt-1 text-[10px] text-muted-foreground">
            Enter — отправить · Shift+Enter — новая строка
          </p>
        </div>
      </div>
    </div>
  )
}

const CONTEXT_LIMIT = 180_000 // ~200k tokens, leave buffer

function TokenCounter({ messages }: { messages: ChatMessage[] }) {
  if (messages.length === 0) return null
  const approx = Math.round(messages.reduce((sum, m) => sum + m.content.length, 0) / 4)
  const pct = Math.min(100, (approx / CONTEXT_LIMIT) * 100)
  const isWarn = pct > 60
  const isCrit = pct > 85

  return (
    <div className="mb-1.5 flex items-center gap-2 px-2">
      <div className="h-1 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            'h-full rounded-full transition-all',
            isCrit ? 'bg-destructive' : isWarn ? 'bg-orange-500' : 'bg-success'
          )}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span
        className={cn(
          'shrink-0 text-xs tabular-nums text-muted-foreground',
          isCrit && 'text-destructive',
          isWarn && 'text-orange-500'
        )}
      >
        ~{approx.toLocaleString()} / {CONTEXT_LIMIT.toLocaleString()} токенов
      </span>
    </div>
  )
}

interface MessageBubbleProps {
  message: ChatMessage
  isEditing: boolean
  editContent: string
  hasFollowingMessages: boolean
  canRegenerate: boolean
  disabled: boolean
  onStartEdit: () => void
  onEditContentChange: (value: string) => void
  onCancelEdit: () => void
  onSaveEdit: () => void
  onRegenerate: () => void
}

function MessageBubble({
  message,
  isEditing,
  editContent,
  hasFollowingMessages,
  canRegenerate,
  disabled,
  onStartEdit,
  onEditContentChange,
  onCancelEdit,
  onSaveEdit,
  onRegenerate,
}: MessageBubbleProps) {
  const isUser = message.role === 'user'
  return (
    <div
      className={cn(
        'group fade-rise flex w-full flex-col',
        isUser ? 'items-end' : 'items-start'
      )}
    >
      {!isUser && (
        <div className="mb-1.5 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
          <span className="grid h-6 w-6 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Bot className="h-3.5 w-3.5" />
          </span>
          Ассистент
        </div>
      )}
      <div
        className={cn(
          'max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-6 md:max-w-[78%]',
          isUser
            ? 'rounded-br-md bg-primary text-primary-foreground shadow-[0_12px_28px_-20px_hsl(var(--primary)/0.9)]'
            : 'rounded-bl-md border bg-card text-foreground shadow-sm'
        )}
      >
        {isEditing ? (
          <div className="min-w-[min(34rem,70vw)] space-y-2">
            <textarea
              autoFocus
              value={editContent}
              onChange={(event) => onEditContentChange(event.target.value)}
              rows={Math.min(10, Math.max(3, editContent.split('\n').length))}
              disabled={disabled}
              className="max-h-64 min-h-24 w-full resize-y rounded-md border border-border bg-background px-3 py-2 text-sm leading-5 text-foreground outline-none focus:ring-2 focus:ring-ring"
            />
            {hasFollowingMessages && (
              <p className="text-xs text-primary-foreground/75">
                Ответы после этого сообщения будут заменены.
              </p>
            )}
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={onCancelEdit}
                disabled={disabled}
                className="h-8 text-primary-foreground hover:bg-primary-foreground/10 hover:text-primary-foreground"
              >
                <X className="mr-1 h-3.5 w-3.5" />
                Отмена
              </Button>
              <Button
                type="button"
                size="sm"
                variant="secondary"
                onClick={onSaveEdit}
                disabled={!editContent.trim() || disabled}
                className="h-8"
              >
                <Check className="mr-1 h-3.5 w-3.5" />
                Сохранить и отправить
              </Button>
            </div>
          </div>
        ) : isUser ? (
          <span className="whitespace-pre-wrap">{message.content}</span>
        ) : (
          <div className="prose prose-sm max-w-none prose-headings:font-display prose-a:text-primary dark:prose-invert">
            <ReactMarkdown>{message.content}</ReactMarkdown>
          </div>
        )}
      </div>
      {!isEditing && (isUser || canRegenerate) && (
        <div className="mt-0.5 flex min-h-7 items-center opacity-70 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100">
          {isUser && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onStartEdit}
              disabled={disabled}
              className="h-7 px-2 text-xs text-muted-foreground"
              title="Редактировать сообщение и получить новый ответ"
            >
              <Pencil className="mr-1 h-3.5 w-3.5" />
              Редактировать
            </Button>
          )}
          {canRegenerate && (
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={onRegenerate}
              disabled={disabled}
              className="h-7 px-2 text-xs text-muted-foreground"
              title="Получить другой ответ на тот же запрос"
            >
              <RotateCcw className="mr-1 h-3.5 w-3.5" />
              Повторить ответ
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
