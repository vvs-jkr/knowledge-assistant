import { z } from 'zod'

export const healthMetricSchema = z.object({
  id: z.string(),
  record_id: z.string(),
  metric_name: z.string(),
  recorded_date: z.string(),
  value: z.number(),
  unit: z.string(),
  reference_min: z.number().nullable(),
  reference_max: z.number().nullable(),
  status: z.enum(['normal', 'low', 'high']),
})

export const healthRecordMetaSchema = z.object({
  id: z.string(),
  filename: z.string(),
  lab_date: z.string(),
  lab_name: z.string(),
  pdf_size_bytes: z.number(),
  metrics_count: z.number(),
  created_at: z.string(),
})

export const uploadHealthResponseSchema = z.object({
  record: healthRecordMetaSchema,
  metrics: z.array(healthMetricSchema),
})

export const metricsQuerySchema = z.object({
  metric_name: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
})

export type HealthMetric = z.infer<typeof healthMetricSchema>
export type HealthRecordMeta = z.infer<typeof healthRecordMetaSchema>
export type UploadHealthResponse = z.infer<typeof uploadHealthResponseSchema>
export type MetricsQuery = z.infer<typeof metricsQuerySchema>
