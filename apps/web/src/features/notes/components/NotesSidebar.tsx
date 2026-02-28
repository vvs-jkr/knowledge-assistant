import { Separator } from '@/components/ui/separator'
import { NoteList } from '@/features/notes/components/NoteList'
import { NoteUpload } from '@/features/notes/components/NoteUpload'

export function NotesSidebar() {
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 p-3">
        <NoteUpload />
      </div>
      <Separator />
      <NoteList />
    </div>
  )
}
