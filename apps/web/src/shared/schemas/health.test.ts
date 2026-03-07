import { describe, expect, it } from 'vitest'
import {
  healthMetricSchema,
  healthRecordMetaSchema,
  uploadHealthResponseSchema,
} from './health.schema'

const baseMetric = {
  id: 'metric-1',
  record_id: 'record-1',
  metric_name: 'glucose',
  recorded_date: '2026-01-15',
  value: 5.1,
  unit: 'mmol/L',
  reference_min: 3.9,
  reference_max: 6.1,
  status: 'normal' as const,
}

const baseRecord = {
  id: 'record-1',
  filename: 'lab.pdf',
  lab_date: '2026-01-15',
  lab_name: 'City Lab',
  pdf_size_bytes: 204800,
  metrics_count: 3,
  created_at: '2026-01-15T12:00:00Z',
}

describe('healthMetricSchema', () => {
  it('accepts valid metric', () => {
    expect(healthMetricSchema.safeParse(baseMetric).success).toBe(true)
  })

  it('accepts null reference ranges', () => {
    const data = { ...baseMetric, reference_min: null, reference_max: null }
    expect(healthMetricSchema.safeParse(data).success).toBe(true)
  })

  it('accepts all valid statuses', () => {
    for (const status of ['normal', 'low', 'high'] as const) {
      expect(healthMetricSchema.safeParse({ ...baseMetric, status }).success).toBe(true)
    }
  })

  it('rejects invalid status', () => {
    expect(healthMetricSchema.safeParse({ ...baseMetric, status: 'unknown' }).success).toBe(false)
  })

  it('rejects non-number value', () => {
    expect(healthMetricSchema.safeParse({ ...baseMetric, value: 'high' }).success).toBe(false)
  })

  it('rejects missing required fields', () => {
    const { id: _id, ...without } = baseMetric
    expect(healthMetricSchema.safeParse(without).success).toBe(false)
  })
})

describe('healthRecordMetaSchema', () => {
  it('accepts valid record meta', () => {
    expect(healthRecordMetaSchema.safeParse(baseRecord).success).toBe(true)
  })

  it('accepts empty lab_name', () => {
    const data = { ...baseRecord, lab_name: '' }
    expect(healthRecordMetaSchema.safeParse(data).success).toBe(true)
  })

  it('rejects non-number pdf_size_bytes', () => {
    expect(
      healthRecordMetaSchema.safeParse({ ...baseRecord, pdf_size_bytes: '200kb' }).success
    ).toBe(false)
  })

  it('rejects missing lab_date', () => {
    const { lab_date: _ld, ...without } = baseRecord
    expect(healthRecordMetaSchema.safeParse(without).success).toBe(false)
  })
})

describe('uploadHealthResponseSchema', () => {
  it('accepts valid upload response', () => {
    const data = { record: baseRecord, metrics: [baseMetric] }
    expect(uploadHealthResponseSchema.safeParse(data).success).toBe(true)
  })

  it('accepts empty metrics array', () => {
    const data = { record: baseRecord, metrics: [] }
    expect(uploadHealthResponseSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing record', () => {
    expect(uploadHealthResponseSchema.safeParse({ metrics: [] }).success).toBe(false)
  })

  it('rejects invalid metric in metrics array', () => {
    const data = { record: baseRecord, metrics: [{ ...baseMetric, status: 'bad' }] }
    expect(uploadHealthResponseSchema.safeParse(data).success).toBe(false)
  })
})
