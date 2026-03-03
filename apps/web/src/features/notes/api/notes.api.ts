import { api } from '@/shared/lib/api'
import type {
  AnalyzeResponse,
  NoteMetadata,
  NoteWithContent,
  SearchResult,
  UpdateNoteInput,
} from '@/shared/schemas/notes.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const notesApi = {
  upload: (files: File[]) => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    return api.post<NoteMetadata[]>('/notes/upload', form).then((r) => r.data)
  },

  list: () => api.get<NoteMetadata[]>('/notes').then((r) => r.data),

  get: (id: string) => api.get<NoteWithContent>(`/notes/${id}`).then((r) => r.data),

  update: (id: string, body: UpdateNoteInput) =>
    api.put<NoteMetadata>(`/notes/${id}`, body).then((r) => r.data),

  delete: (id: string) => api.delete(`/notes/${id}`),

  download: (id: string) =>
    api.get(`/notes/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),

  search: (query: string, limit?: number) =>
    api.post<SearchResult[]>('/notes/search', { query, limit }).then((r) => r.data),

  analyze: (noteId: string) =>
    api.post<AnalyzeResponse>(`/notes/${noteId}/analyze`).then((r) => r.data),
}

export function useNotes() {
  return useQuery({
    queryKey: ['notes'],
    queryFn: notesApi.list,
    staleTime: 30_000,
  })
}

export function useNote(id: string | null) {
  return useQuery({
    queryKey: ['notes', id],
    queryFn: () => notesApi.get(id ?? ''),
    enabled: id !== null,
  })
}

export function useUploadNotes() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.upload,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useUpdateNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UpdateNoteInput }) => notesApi.update(id, body),
    onSuccess: (_data, { id }) => {
      qc.invalidateQueries({ queryKey: ['notes'] })
      qc.invalidateQueries({ queryKey: ['notes', id] })
    },
  })
}

export function useDeleteNote() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: notesApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notes'] }),
  })
}

export function useSearchNotes() {
  return useMutation({
    mutationFn: ({ query, limit }: { query: string; limit?: number }) =>
      notesApi.search(query, limit),
  })
}

export function useAnalyzeNote() {
  return useMutation({
    mutationFn: (noteId: string) => notesApi.analyze(noteId),
  })
}

export async function downloadNote(id: string, filename: string): Promise<void> {
  const blob = await notesApi.download(id)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export { notesApi }
