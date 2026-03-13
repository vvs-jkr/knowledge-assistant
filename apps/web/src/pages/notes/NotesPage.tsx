import { NotesMainPanel } from '@/features/notes/components/NotesMainPanel'
import { NotesSidebar } from '@/features/notes/components/NotesSidebar'
import { SidebarLayout } from '@/shared/ui/SidebarLayout'

export function NotesPage() {
  return (
    <SidebarLayout sidebar={<NotesSidebar />}>
      <NotesMainPanel />
    </SidebarLayout>
  )
}
