import { NoteEditor } from '@/features/notes/components/NoteEditor'
import { NoteViewer } from '@/features/notes/components/NoteViewer'
import { useNotesStore } from '@/features/notes/store/notes.store'

export function NotesMainPanel() {
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId)
  const isEditing = useNotesStore((s) => s.isEditing)

  if (!selectedNoteId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Select a note to view
      </div>
    )
  }

  if (isEditing) {
    return <NoteEditor key={selectedNoteId} />
  }

  return <NoteViewer key={selectedNoteId} />
}
