import { NotesMainPanel } from '@/features/notes/components/NotesMainPanel'
import { NotesSidebar } from '@/features/notes/components/NotesSidebar'

export function NotesPage() {
  return (
    <div className="flex h-full w-full overflow-hidden">
      <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r">
        <NotesSidebar />
      </aside>
      <main className="flex flex-1 overflow-hidden">
        <NotesMainPanel />
      </main>
    </div>
  )
}
