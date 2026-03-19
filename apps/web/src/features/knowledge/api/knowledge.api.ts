import { api } from '@/shared/lib/api'
import {
  generatedWorkoutSchema,
  knowledgeEntrySchema,
  knowledgeEntryWithContentSchema,
} from '@/shared/schemas/knowledge.schema'
import type {
  GeneratedWorkout,
  KnowledgeEntry,
  KnowledgeEntryWithContent,
} from '@/shared/schemas/knowledge.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const knowledgeApi = {
  list: (): Promise<KnowledgeEntry[]> =>
    api.get<KnowledgeEntry[]>('/knowledge').then((r) => knowledgeEntrySchema.array().parse(r.data)),

  get: (id: string): Promise<KnowledgeEntryWithContent> =>
    api
      .get<KnowledgeEntryWithContent>(`/knowledge/${id}`)
      .then((r) => knowledgeEntryWithContentSchema.parse(r.data)),

  upload: (files: File[]): Promise<KnowledgeEntry[]> => {
    const form = new FormData()
    for (const f of files) form.append('file', f)
    return api
      .post<KnowledgeEntry[]>('/knowledge/upload', form)
      .then((r) => knowledgeEntrySchema.array().parse(r.data))
  },

  delete: (id: string): Promise<void> => api.delete(`/knowledge/${id}`).then(() => undefined),

  generate: (prompt: string): Promise<GeneratedWorkout> =>
    api
      .post<GeneratedWorkout>('/workouts/generate', { prompt })
      .then((r) => generatedWorkoutSchema.parse(r.data)),
}

export function useKnowledgeList() {
  return useQuery({
    queryKey: ['knowledge', 'list'],
    queryFn: knowledgeApi.list,
    staleTime: 30_000,
  })
}

export function useKnowledgeEntry(id: string | null) {
  return useQuery({
    queryKey: ['knowledge', 'detail', id],
    queryFn: () => knowledgeApi.get(id ?? ''),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useUploadKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: knowledgeApi.upload,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge'] }),
  })
}

export function useDeleteKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: knowledgeApi.delete,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['knowledge'] }),
  })
}

export function useGenerateWorkout() {
  return useMutation({
    mutationFn: knowledgeApi.generate,
  })
}

export { knowledgeApi }
