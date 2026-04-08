import { create } from 'zustand'

type HealthSection = 'inbody' | 'labs'

interface DateRange {
  from: string
  to: string
}

interface HealthState {
  activeSection: HealthSection
  selectedRecordId: string | null
  selectedLabBatchId: string | null
  selectedMetric: string | null
  dateRange: DateRange | null
  setActiveSection: (section: HealthSection) => void
  selectRecord: (id: string | null) => void
  selectLabBatch: (id: string | null) => void
  setSelectedMetric: (metric: string | null) => void
  setDateRange: (range: DateRange | null) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  activeSection: 'inbody',
  selectedRecordId: null,
  selectedLabBatchId: null,
  selectedMetric: null,
  dateRange: null,
  setActiveSection: (section) =>
    set({
      activeSection: section,
      selectedRecordId: section === 'inbody' ? null : null,
      selectedLabBatchId: section === 'labs' ? null : null,
    }),
  selectRecord: (id) => set({ selectedRecordId: id }),
  selectLabBatch: (id) => set({ selectedLabBatchId: id }),
  setSelectedMetric: (metric) => set({ selectedMetric: metric }),
  setDateRange: (range) => set({ dateRange: range }),
}))
