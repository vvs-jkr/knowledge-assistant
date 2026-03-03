import { create } from 'zustand'

interface NotesState {
  selectedNoteId: string | null
  isEditing: boolean
  searchQuery: string
  isSearching: boolean
  selectNote: (id: string | null) => void
  setEditing: (editing: boolean) => void
  setSearchQuery: (query: string) => void
  setIsSearching: (searching: boolean) => void
  clearSearch: () => void
}

export const useNotesStore = create<NotesState>((set) => ({
  selectedNoteId: null,
  isEditing: false,
  searchQuery: '',
  isSearching: false,
  selectNote: (id) => set({ selectedNoteId: id, isEditing: false }),
  setEditing: (editing) => set({ isEditing: editing }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  setIsSearching: (searching) => set({ isSearching: searching }),
  clearSearch: () => set({ searchQuery: '', isSearching: false }),
}))
