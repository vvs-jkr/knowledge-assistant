import { NotesMainPanel } from '@/features/notes/components/NotesMainPanel'
import { NotesSidebar } from '@/features/notes/components/NotesSidebar'
import { AppHeader } from '@/shared/ui/AppHeader'

export function NotesPage() {
  return (
    <div className="flex h-screen flex-col">
      <AppHeader />
      <div className="flex flex-1 overflow-hidden">
        <aside className="flex w-80 shrink-0 flex-col overflow-hidden border-r">
          <NotesSidebar />
        </aside>
        <main className="flex flex-1 overflow-hidden">
          <NotesMainPanel />
        </main>
      </div>
    </div>
  )
}
