import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadNote, useDeleteNote, useNotes } from '@/features/notes/api/notes.api'
import { useNotesStore } from '@/features/notes/store/notes.store'
import { cn } from '@/lib/utils'
import { Download, Edit, MoreHorizontal, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatRelativeDate(dateStr: string): string {
  const date = new Date(dateStr)
  const diffMs = Date.now() - date.getTime()
  const diffMins = Math.floor(diffMs / 60_000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)
  if (diffDays > 30) return date.toLocaleDateString()
  if (diffDays > 0) return `${diffDays}d ago`
  if (diffHours > 0) return `${diffHours}h ago`
  if (diffMins > 0) return `${diffMins}m ago`
  return 'just now'
}

export function NoteList() {
  const { data: notes, isLoading } = useNotes()
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId)
  const selectNote = useNotesStore((s) => s.selectNote)
  const setEditing = useNotesStore((s) => s.setEditing)
  const deleteNote = useDeleteNote()

  if (isLoading) {
    return (
      <div className="space-y-2 p-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-14 w-full rounded-md" />
        ))}
      </div>
    )
  }

  if (!notes?.length) {
    return (
      <div className="flex flex-col items-center justify-center gap-1 p-8 text-center text-sm text-muted-foreground">
        <p>No notes yet</p>
        <p>Upload .md files above</p>
      </div>
    )
  }

  return (
    <ScrollArea className="flex-1">
      <div className="space-y-0.5 p-2">
        {notes.map((note) => (
          <div
            key={note.id}
            className={cn(
              'group flex items-center rounded-md text-sm',
              selectedNoteId === note.id
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-accent hover:text-accent-foreground'
            )}
          >
            <button
              type="button"
              className="min-w-0 flex-1 px-2 py-2 text-left"
              onClick={() => selectNote(note.id)}
            >
              <p className="truncate font-medium">{note.filename}</p>
              <p className="text-xs text-muted-foreground">
                {formatBytes(note.size_bytes)} · {formatRelativeDate(note.updated_at)}
              </p>
            </button>

            <div className="shrink-0 pr-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 opacity-0 group-hover:opacity-100"
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      selectNote(note.id)
                      setEditing(true)
                    }}
                  >
                    <Edit className="h-4 w-4" />
                    Edit
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    onClick={(e) => {
                      e.stopPropagation()
                      void downloadNote(note.id, note.filename).catch(() =>
                        toast.error('Download failed')
                      )
                    }}
                  >
                    <Download className="h-4 w-4" />
                    Download
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation()
                      deleteNote.mutate(note.id, {
                        onSuccess: () => {
                          if (selectedNoteId === note.id) selectNote(null)
                          toast.success('Note deleted')
                        },
                        onError: () => toast.error('Failed to delete note'),
                      })
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        ))}
      </div>
    </ScrollArea>
  )
}
