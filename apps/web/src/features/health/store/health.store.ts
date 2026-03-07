import { create } from 'zustand'

interface DateRange {
  from: string
  to: string
}

interface HealthState {
  selectedRecordId: string | null
  selectedMetric: string | null
  dateRange: DateRange | null
  selectRecord: (id: string | null) => void
  setSelectedMetric: (metric: string | null) => void
  setDateRange: (range: DateRange | null) => void
}

export const useHealthStore = create<HealthState>((set) => ({
  selectedRecordId: null,
  selectedMetric: null,
  dateRange: null,
  selectRecord: (id) => set({ selectedRecordId: id }),
  setSelectedMetric: (metric) => set({ selectedMetric: metric }),
  setDateRange: (range) => set({ dateRange: range }),
}))
