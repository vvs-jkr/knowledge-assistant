import { z } from 'zod'

export const healthRecordKindSchema = z.enum(['inbody', 'lab_report'])

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
  source_kind: healthRecordKindSchema,
  upload_batch_id: z.string().nullable(),
  pdf_size_bytes: z.number(),
  metrics_count: z.number(),
  created_at: z.string(),
})

export const healthRecordDetailSchema = healthRecordMetaSchema.extend({
  metrics: z.array(healthMetricSchema),
})

export const uploadHealthResponseSchema = z.object({
  record: healthRecordMetaSchema.nullable(),
  records: z.array(healthRecordMetaSchema),
  metrics: z.array(healthMetricSchema),
  upload_batch_id: z.string().nullable(),
})

export const healthLabBatchSummarySchema = z.object({
  id: z.string(),
  lab_date: z.string(),
  lab_name: z.string(),
  file_count: z.number(),
  metrics_count: z.number(),
  created_at: z.string(),
})

export const healthLabBatchDetailSchema = healthLabBatchSummarySchema.extend({
  records: z.array(healthRecordMetaSchema),
  metrics: z.array(healthMetricSchema),
})

export const healthConsultResponseSchema = z.object({
  answer: z.string(),
})

export const metricsQuerySchema = z.object({
  metric_name: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
  kind: healthRecordKindSchema.optional(),
  batch_id: z.string().optional(),
})

export type HealthMetric = z.infer<typeof healthMetricSchema>
export type HealthRecordKind = z.infer<typeof healthRecordKindSchema>
export type HealthRecordMeta = z.infer<typeof healthRecordMetaSchema>
export type HealthRecordDetail = z.infer<typeof healthRecordDetailSchema>
export type UploadHealthResponse = z.infer<typeof uploadHealthResponseSchema>
export type HealthLabBatchSummary = z.infer<typeof healthLabBatchSummarySchema>
export type HealthLabBatchDetail = z.infer<typeof healthLabBatchDetailSchema>
export type HealthConsultResponse = z.infer<typeof healthConsultResponseSchema>
export type MetricsQuery = z.infer<typeof metricsQuerySchema>
