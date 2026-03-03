import { Separator } from '@/components/ui/separator'
import { NoteList } from '@/features/notes/components/NoteList'
import { NoteSearch } from '@/features/notes/components/NoteSearch'
import { NoteUpload } from '@/features/notes/components/NoteUpload'
import { useNotesStore } from '@/features/notes/store/notes.store'

export function NotesSidebar() {
  const isSearching = useNotesStore((s) => s.isSearching)

  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3">
        <NoteUpload />
      </div>
      <Separator />
      <div className="shrink-0 p-3">
        <NoteSearch />
      </div>
      <Separator />
      {isSearching ? null : <NoteList />}
    </div>
  )
}
