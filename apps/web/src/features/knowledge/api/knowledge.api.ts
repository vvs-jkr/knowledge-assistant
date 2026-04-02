import { api } from '@/shared/lib/api'
import {
  generatedWorkoutSchema,
  knowledgeEntrySchema,
  knowledgeEntryWithContentSchema,
} from '@/shared/schemas/knowledge.schema'
import type {
  GeneratedWorkout,
  KnowledgeDocType,
  KnowledgeEntry,
  KnowledgeEntryWithContent,
} from '@/shared/schemas/knowledge.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

export interface CreateKnowledgeInput {
  title: string
  content: string
  source?: string
  doc_type?: KnowledgeDocType
  tags?: string[]
  review_status?: 'draft' | 'reviewed' | 'needs_review'
  use_for_generation?: boolean
  metadata?: Record<string, unknown>
}

export interface KnowledgeListFilters {
  doc_type?: KnowledgeDocType | 'all'
  use_for_generation?: boolean
}

const knowledgeApi = {
  list: (filters?: KnowledgeListFilters): Promise<KnowledgeEntry[]> =>
    api
      .get<KnowledgeEntry[]>('/knowledge', {
        params: {
          doc_type: filters?.doc_type && filters.doc_type !== 'all' ? filters.doc_type : undefined,
          use_for_generation: filters?.use_for_generation,
        },
      })
      .then((r) => knowledgeEntrySchema.array().parse(r.data)),

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

  create: (payload: CreateKnowledgeInput): Promise<KnowledgeEntryWithContent> =>
    api
      .post<KnowledgeEntryWithContent>('/knowledge', payload)
      .then((r) => knowledgeEntryWithContentSchema.parse(r.data)),

  delete: (id: string): Promise<void> => api.delete(`/knowledge/${id}`).then(() => undefined),

  generate: (prompt: string): Promise<GeneratedWorkout> =>
    api
      .post<GeneratedWorkout>('/workouts/generate', { prompt })
      .then((r) => generatedWorkoutSchema.parse(r.data)),
}

export function useKnowledgeList(filters?: KnowledgeListFilters) {
  return useQuery({
    queryKey: ['knowledge', 'list', filters ?? {}],
    queryFn: () => knowledgeApi.list(filters),
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

export function useCreateKnowledge() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: knowledgeApi.create,
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
