import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useNote, useUpdateNote } from '@/features/notes/api/notes.api'
import { MarkdownEditor } from '@/features/notes/components/MarkdownEditor'
import { useNotesStore } from '@/features/notes/store/notes.store'
import type { NoteWithContent } from '@/shared/schemas/notes.schema'
import { useState } from 'react'
import { toast } from 'sonner'

interface NoteEditorFormProps {
  note: NoteWithContent
  onCancel: () => void
}

function NoteEditorForm({ note, onCancel }: NoteEditorFormProps) {
  const updateNote = useUpdateNote()
  const [content, setContent] = useState(note.content)

  const handleSave = () => {
    updateNote.mutate(
      { id: note.id, body: { content } },
      {
        onSuccess: () => {
          toast.success('Note saved')
          onCancel()
        },
        onError: () => toast.error('Failed to save note'),
      }
    )
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex shrink-0 items-center justify-between border-b px-6 py-3">
        <h2 className="truncate text-lg font-semibold">{note.filename}</h2>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={onCancel} disabled={updateNote.isPending}>
            Cancel
          </Button>
          <Button size="sm" onClick={handleSave} disabled={updateNote.isPending}>
            {updateNote.isPending ? 'Saving…' : 'Save'}
          </Button>
        </div>
      </div>
      <div className="flex-1 overflow-hidden">
        <MarkdownEditor value={content} onChange={setContent} />
      </div>
    </div>
  )
}

function EditorSkeleton() {
  return (
    <div className="space-y-4 p-6">
      <Skeleton className="h-8 w-64" />
      <Skeleton className="h-[400px] w-full" />
    </div>
  )
}

export function NoteEditor() {
  const selectedNoteId = useNotesStore((s) => s.selectedNoteId)
  const setEditing = useNotesStore((s) => s.setEditing)
  const { data: note, isLoading } = useNote(selectedNoteId)

  if (isLoading || !note) return <EditorSkeleton />

  return <NoteEditorForm note={note} onCancel={() => setEditing(false)} />
}
