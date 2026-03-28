import { Button } from '@/components/ui/button'
import { useCreateSession, useDeleteSession, useRenameSession } from '@/features/chat/api/chat.api'
import { cn } from '@/lib/utils'
import type { ChatSession } from '@/shared/schemas/chat.schema'
import { MessageSquarePlus, Pencil, Trash2 } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

interface Props {
  sessions: ChatSession[]
  activeId: string | null
  onSelect: (id: string) => void
}

export function ChatSessionList({ sessions, activeId, onSelect }: Props) {
  const createSession = useCreateSession()
  const deleteSession = useDeleteSession()
  const renameSession = useRenameSession()
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')
  const editInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId !== null) {
      editInputRef.current?.focus()
    }
  }, [editingId])

  const handleCreate = () => {
    createSession.mutate(undefined, {
      onSuccess: (s) => onSelect(s.id),
    })
  }

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    deleteSession.mutate(id)
  }

  const handleEditStart = (e: React.MouseEvent, session: ChatSession) => {
    e.stopPropagation()
    setEditingId(session.id)
    setEditTitle(session.title)
  }

  const handleEditCommit = (id: string) => {
    if (editTitle.trim()) {
      renameSession.mutate({ id, title: editTitle.trim() })
    }
    setEditingId(null)
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b px-3 py-2">
        <span className="text-sm font-medium">Чаты</span>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={handleCreate}
          disabled={createSession.isPending}
          title="Новый чат"
        >
          <MessageSquarePlus className="h-4 w-4" />
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-1">
        {sessions.length === 0 && (
          <p className="px-2 py-4 text-center text-xs text-muted-foreground">
            Нет чатов. Создай первый!
          </p>
        )}

        {sessions.map((s) => (
          <div
            key={s.id}
            className={cn(
              'group flex items-center gap-1 rounded-md px-2 py-1.5 text-sm',
              activeId === s.id
                ? 'bg-primary/10 text-primary'
                : 'text-muted-foreground hover:bg-muted hover:text-foreground'
            )}
          >
            {editingId === s.id ? (
              <input
                ref={editInputRef}
                value={editTitle}
                onChange={(e) => setEditTitle(e.target.value)}
                onBlur={() => handleEditCommit(s.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleEditCommit(s.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                className="min-w-0 flex-1 bg-transparent text-sm outline-none"
                onClick={(e) => e.stopPropagation()}
              />
            ) : (
              <button
                type="button"
                className="min-w-0 flex-1 truncate text-left"
                onClick={() => onSelect(s.id)}
              >
                {s.title}
              </button>
            )}

            <div className="flex shrink-0 gap-0.5 opacity-0 group-hover:opacity-100">
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={(e) => handleEditStart(e, s)}
                title="Переименовать"
              >
                <Pencil className="h-3 w-3" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-destructive hover:text-destructive"
                onClick={(e) => handleDelete(e, s.id)}
                title="Удалить"
              >
                <Trash2 className="h-3 w-3" />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
