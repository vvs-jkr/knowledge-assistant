import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
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
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)
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

  const handleDeleteConfirm = () => {
    if (confirmDeleteId === null) return
    deleteSession.mutate(confirmDeleteId)
    setConfirmDeleteId(null)
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
    <>
      <div className="flex h-full flex-col">
        <div className="space-y-3 px-3 pb-3 pt-4">
          <div>
            <p className="font-display text-base font-semibold">Диалоги</p>
            <p className="text-[11px] text-muted-foreground">История работы с ассистентом</p>
          </div>
          <Button
            size="sm"
            className="h-9 w-full justify-start rounded-xl shadow-sm"
            onClick={handleCreate}
            disabled={createSession.isPending}
            title="Новый чат"
          >
            <MessageSquarePlus className="h-4 w-4" />
            Новый чат
          </Button>
        </div>

        <div className="flex-1 overflow-auto px-2 pb-3">
          {sessions.length === 0 && (
            <div className="mx-1 rounded-xl border border-dashed bg-card/40 px-3 py-6 text-center">
              <p className="text-xs text-muted-foreground">Здесь появится история диалогов</p>
            </div>
          )}

          {sessions.map((s) => (
            <div
              key={s.id}
              className={cn(
                'group mb-1 flex min-h-10 items-center gap-1 rounded-xl border border-transparent px-3 py-2 text-sm transition-all',
                activeId === s.id
                  ? 'border-border bg-card text-foreground shadow-sm'
                  : 'text-muted-foreground hover:bg-card/65 hover:text-foreground'
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

              <div className="flex shrink-0 gap-0.5 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
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
                  onClick={(e) => {
                    e.stopPropagation()
                    setConfirmDeleteId(s.id)
                  }}
                  title="Удалить"
                >
                  <Trash2 className="h-3 w-3" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <AlertDialog
        open={confirmDeleteId !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmDeleteId(null)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить чат?</AlertDialogTitle>
            <AlertDialogDescription>Это действие нельзя отменить.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
