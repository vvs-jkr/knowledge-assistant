import { create } from 'zustand'

interface NotesState {
  selectedNoteId: string | null
  isEditing: boolean
  selectNote: (id: string | null) => void
  setEditing: (editing: boolean) => void
}

export const useNotesStore = create<NotesState>((set) => ({
  selectedNoteId: null,
  isEditing: false,
  selectNote: (id) => set({ selectedNoteId: id, isEditing: false }),
  setEditing: (editing) => set({ isEditing: editing }),
}))
