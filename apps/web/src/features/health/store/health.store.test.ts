import { beforeEach, describe, expect, it } from 'vitest'
import { useHealthStore } from './health.store'

beforeEach(() => {
  useHealthStore.setState({
    selectedRecordId: null,
    selectedMetric: null,
    dateRange: null,
  })
})

describe('useHealthStore', () => {
  it('starts with null state', () => {
    const state = useHealthStore.getState()
    expect(state.selectedRecordId).toBeNull()
    expect(state.selectedMetric).toBeNull()
    expect(state.dateRange).toBeNull()
  })

  it('selectRecord sets selectedRecordId', () => {
    useHealthStore.getState().selectRecord('record-1')
    expect(useHealthStore.getState().selectedRecordId).toBe('record-1')
  })

  it('selectRecord with null clears selection', () => {
    useHealthStore.getState().selectRecord('record-1')
    useHealthStore.getState().selectRecord(null)
    expect(useHealthStore.getState().selectedRecordId).toBeNull()
  })

  it('setSelectedMetric updates selectedMetric', () => {
    useHealthStore.getState().setSelectedMetric('glucose')
    expect(useHealthStore.getState().selectedMetric).toBe('glucose')
  })

  it('setSelectedMetric null clears metric', () => {
    useHealthStore.getState().setSelectedMetric('glucose')
    useHealthStore.getState().setSelectedMetric(null)
    expect(useHealthStore.getState().selectedMetric).toBeNull()
  })

  it('setDateRange updates date range', () => {
    const range = { from: '2026-01-01', to: '2026-03-01' }
    useHealthStore.getState().setDateRange(range)
    expect(useHealthStore.getState().dateRange).toEqual(range)
  })

  it('setDateRange null clears range', () => {
    useHealthStore.getState().setDateRange({ from: '2026-01-01', to: '2026-03-01' })
    useHealthStore.getState().setDateRange(null)
    expect(useHealthStore.getState().dateRange).toBeNull()
  })
})
