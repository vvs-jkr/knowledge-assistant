import { api } from '@/shared/lib/api'
import type {
  HealthMetric,
  HealthRecordMeta,
  MetricsQuery,
  UploadHealthResponse,
} from '@/shared/schemas/health.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const healthApi = {
  upload: (file: File, labDate: string, labName?: string) => {
    const form = new FormData()
    form.append('file', file)
    form.append('lab_date', labDate)
    if (labName) form.append('lab_name', labName)
    return api.post<UploadHealthResponse>('/health/upload', form).then((r) => r.data)
  },

  records: () => api.get<HealthRecordMeta[]>('/health/records').then((r) => r.data),

  deleteRecord: (id: string) => api.delete(`/health/records/${id}`),

  metrics: (params?: MetricsQuery) =>
    api.get<HealthMetric[]>('/health/metrics', { params }).then((r) => r.data),

  export: (params?: MetricsQuery): Promise<Blob> =>
    api.get('/health/export', { params, responseType: 'blob' }).then((r) => r.data as Blob),
}

export function useHealthRecords() {
  return useQuery({
    queryKey: ['health', 'records'],
    queryFn: healthApi.records,
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

export function useUploadHealth() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({
      file,
      labDate,
      labName,
    }: {
      file: File
      labDate: string
      labName?: string
    }) => healthApi.upload(file, labDate, labName),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['health', 'records'] })
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
      qc.invalidateQueries({ queryKey: ['health', 'metrics'] })
    },
  })
}

export async function exportHealthMarkdown(params?: MetricsQuery): Promise<void> {
  const blob = await healthApi.export(params)
  const today = new Date().toISOString().slice(0, 10)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `health-export-${today}.md`
  a.click()
  URL.revokeObjectURL(url)
}

export { healthApi }
