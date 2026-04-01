import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadNote, useDeleteNote, useNote } from '@/features/notes/api/notes.api'
import { NoteAnalysisDialog } from '@/features/notes/components/NoteAnalysisDialog'
import { useNotesStore } from '@/features/notes/store/notes.store'
import { Download, Edit, Trash2 } from 'lucide-react'
import ReactMarkdown from 'react-markdown'
import { toast } from 'sonner'

export function NoteViewer() {
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId)
  const selectNote = useNotesStore((s) => s.selectNote)
  const setEditing = useNotesStore((s) => s.setEditing)
  const deleteNote = useDeleteNote()
  const { data: note, isLoading } = useNote(selectedNoteId)

  if (isLoading) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-4/6" />
      </div>
    )
  }

  if (!note) return null

  const frontmatterEntries = note.frontmatter
    ? Object.entries(note.frontmatter).filter(
        (entry): entry is [string, string | number] =>
          typeof entry[1] === 'string' || typeof entry[1] === 'number'
      )
    : []

  const handleDelete = () => {
    deleteNote.mutate(note.id, {
      onSuccess: () => {
        selectNote(null)
        toast.success('Заметка удалена')
      },
      onError: () => toast.error('Не удалось удалить заметку'),
    })
  }

  return (
    <div className="flex h-full w-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <h2 className="truncate text-lg font-semibold">{note.filename}</h2>
        <div className="flex shrink-0 items-center gap-1">
          <NoteAnalysisDialog noteId={note.id} />
          <Button
            variant="ghost"
            size="icon"
            onClick={() =>
              void downloadNote(note.id, note.filename).catch(() =>
                toast.error('Не удалось скачать заметку')
              )
            }
          >
            <Download className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setEditing(true)}>
            <Edit className="h-4 w-4" />
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="ghost" size="icon">
                <Trash2 className="h-4 w-4 text-destructive" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Удалить заметку?</AlertDialogTitle>
                <AlertDialogDescription>
                  &ldquo;{note.filename}&rdquo; будет удалена без возможности восстановления.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Отмена</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Удалить
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {frontmatterEntries.length > 0 && (
        <div className="flex shrink-0 flex-wrap gap-2 border-b px-6 py-2">
          {frontmatterEntries.map(([k, v]) => (
            <Badge key={k} variant="secondary" className="text-xs">
              {k}: {String(v)}
            </Badge>
          ))}
        </div>
      )}

      <div className="flex-1 overflow-auto">
        <div className="px-8 py-6">
          <div
            className="prose prose-sm dark:prose-invert max-w-none
              prose-headings:font-semibold prose-headings:tracking-tight
              prose-h1:text-2xl prose-h2:text-xl prose-h3:text-lg
              prose-code:rounded prose-code:bg-muted prose-code:px-1 prose-code:py-0.5
              prose-pre:bg-muted prose-pre:rounded-lg
              prose-blockquote:border-l-primary"
          >
            <ReactMarkdown>{note.content}</ReactMarkdown>
          </div>
        </div>
      </div>
    </div>
  )
}
