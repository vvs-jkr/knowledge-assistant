import { create } from 'zustand'

interface KnowledgeState {
  selectedEntryId: string | null
  selectEntry: (id: string | null) => void
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  selectedEntryId: null,
  selectEntry: (id) => set({ selectedEntryId: id }),
}))
