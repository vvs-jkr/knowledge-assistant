import { api } from '@/shared/lib/api'
import { downloadBlob } from '@/shared/lib/download'
import {
  type HealthConsultResponse,
  type HealthLabBatchDetail,
  type HealthLabBatchSummary,
  type HealthMetric,
  type HealthRecordDetail,
  type HealthRecordKind,
  type HealthRecordMeta,
  type MetricsQuery,
  type UploadHealthResponse,
  healthConsultResponseSchema,
  healthLabBatchDetailSchema,
  healthLabBatchSummarySchema,
  healthMetricSchema,
  healthRecordDetailSchema,
  healthRecordMetaSchema,
  uploadHealthResponseSchema,
} from '@/shared/schemas/health.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const healthApi = {
  upload: (files: File[], labDate?: string, labName?: string) => {
    const form = new FormData()
    for (const file of files) {
      form.append('file', file)
    }
    if (labDate) form.append('lab_date', labDate)
    if (labName) form.append('lab_name', labName)
    return api
      .post<UploadHealthResponse>('/health/upload', form)
      .then((r) => uploadHealthResponseSchema.parse(r.data))
  },

  records: (kind?: HealthRecordKind) =>
    api
      .get<HealthRecordMeta[]>('/health/records', { params: kind ? { kind } : undefined })
      .then((r) => healthRecordMetaSchema.array().parse(r.data)),

  record: (id: string) =>
    api
      .get<HealthRecordDetail>(`/health/records/${id}`)
      .then((r) => healthRecordDetailSchema.parse(r.data)),

  recordFile: (id: string): Promise<Blob> =>
    api
      .get(`/health/records/${id}/file`, { responseType: 'blob' })
      .then((r) => r.data as Blob),

  labBatches: () =>
    api
      .get<HealthLabBatchSummary[]>('/health/lab-batches')
      .then((r) => healthLabBatchSummarySchema.array().parse(r.data)),

  labBatch: (id: string) =>
    api
      .get<HealthLabBatchDetail>(`/health/lab-batches/${id}`)
      .then((r) => healthLabBatchDetailSchema.parse(r.data)),

  consultLabBatch: (id: string, question: string) =>
    api
      .post<HealthConsultResponse>(`/health/lab-batches/${id}/consult`, { question })
      .then((r) => healthConsultResponseSchema.parse(r.data)),

  deleteRecord: (id: string) => api.delete(`/health/records/${id}`),

  metrics: (params?: MetricsQuery) =>
    api
      .get<HealthMetric[]>('/health/metrics', { params })
      .then((r) => healthMetricSchema.array().parse(r.data)),

  export: (params?: MetricsQuery): Promise<Blob> =>
    api.get('/health/export', { params, responseType: 'blob' }).then((r) => r.data as Blob),
}

export function useHealthRecords(kind?: HealthRecordKind) {
  return useQuery({
    queryKey: ['health', 'records', kind ?? null],
    queryFn: () => healthApi.records(kind),
    staleTime: 30_000,
  })
}

export function useHealthMetrics(params?: MetricsQuery) {
  return useQuery({
    queryKey: ['health', 'metrics', params],
    queryFn: () => healthApi.metrics(params),
    staleTime: 30_000,
  })
}

export function useHealthRecord(id: string | null) {
  return useQuery({
    queryKey: ['health', 'record', id],
    queryFn: () => healthApi.record(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useHealthLabBatches() {
  return useQuery({
    queryKey: ['health', 'lab-batches'],
    queryFn: healthApi.labBatches,
    staleTime: 30_000,
  })
}

export function useHealthLabBatch(id: string | null) {
  return useQuery({
    queryKey: ['health', 'lab-batch', id],
    queryFn: () => healthApi.labBatch(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useConsultLabBatch(id: string | null) {
  return useMutation({
    mutationFn: (question: string) => healthApi.consultLabBatch(id as string, question),
  })
}

export function useHealthRecordFile(id: string | null) {
  return useQuery({
    queryKey: ['health', 'record-file', id],
    queryFn: () => healthApi.recordFile(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useUploadHealth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      files,
      labDate,
      labName,
    }: {
      files: File[]
      labDate?: string
      labName?: string
    }) => healthApi.upload(files, labDate, labName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health', 'records'] })
      qc.invalidateQueries({ queryKey: ['health', 'lab-batches'] })
      qc.invalidateQueries({ queryKey: ['health', 'metrics'] })
    },
  })
}

export function useDeleteHealthRecord() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: healthApi.deleteRecord,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health', 'records'] })
      qc.invalidateQueries({ queryKey: ['health', 'lab-batches'] })
      qc.invalidateQueries({ queryKey: ['health', 'metrics'] })
    },
  })
}

export async function exportHealthMarkdown(params?: MetricsQuery): Promise<void> {
  const blob = await healthApi.export(params)
  const today = new Date().toISOString().slice(0, 10)
  downloadBlob(blob, `health-export-${today}.md`)
}

export { healthApi }
