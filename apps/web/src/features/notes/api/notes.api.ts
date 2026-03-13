import { api } from '@/shared/lib/api'
import { downloadBlob } from '@/shared/lib/download'
import {
  type AnalyzeResponse,
  type NoteMetadata,
  type NoteWithContent,
  type SearchResult,
  type UpdateNoteInput,
  analyzeResponseSchema,
  noteMetadataSchema,
  noteWithContentSchema,
  searchResultSchema,
} from '@/shared/schemas/notes.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const notesApi = {
  upload: (files: File[]) => {
    const form = new FormData()
    for (const file of files) form.append('files', file)
    return api
      .post<NoteMetadata[]>('/notes/upload', form)
      .then((r) => noteMetadataSchema.array().parse(r.data))
  },

  list: (limit = 100, offset = 0) =>
    api
      .get<NoteMetadata[]>('/notes', { params: { limit, offset } })
      .then((r) => noteMetadataSchema.array().parse(r.data)),

  get: (id: string) =>
    api.get<NoteWithContent>(`/notes/${id}`).then((r) => noteWithContentSchema.parse(r.data)),

  update: (id: string, body: UpdateNoteInput) =>
    api.put<NoteMetadata>(`/notes/${id}`, body).then((r) => noteMetadataSchema.parse(r.data)),

  delete: (id: string) => api.delete(`/notes/${id}`),

  download: (id: string) =>
    api.get(`/notes/${id}/download`, { responseType: 'blob' }).then((r) => r.data as Blob),

  search: (query: string, limit?: number) =>
    api
      .post<SearchResult[]>('/notes/search', { query, limit })
      .then((r) => searchResultSchema.array().parse(r.data)),

  analyze: (noteId: string) =>
    api
      .post<AnalyzeResponse>(`/notes/${noteId}/analyze`)
      .then((r) => analyzeResponseSchema.parse(r.data)),
}

export function useNotes(limit = 100, offset = 0) {
  return useQuery({
    queryKey: ['notes', { limit, offset }],
    queryFn: () => notesApi.list(limit, offset),
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
  downloadBlob(blob, filename)
}

export { notesApi }
