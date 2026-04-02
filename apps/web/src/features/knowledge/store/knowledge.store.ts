import { create } from 'zustand'
import type { KnowledgeDocType } from '@/shared/schemas/knowledge.schema'

interface KnowledgeState {
  selectedEntryId: string | null
  docTypeFilter: KnowledgeDocType | 'all'
  selectEntry: (id: string | null) => void
  setDocTypeFilter: (value: KnowledgeDocType | 'all') => void
}

export const useKnowledgeStore = create<KnowledgeState>((set) => ({
  selectedEntryId: null,
  docTypeFilter: 'all',
  selectEntry: (id) => set({ selectedEntryId: id }),
  setDocTypeFilter: (value) => set({ docTypeFilter: value }),
}))
