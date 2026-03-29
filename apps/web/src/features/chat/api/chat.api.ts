import { api } from '@/shared/lib/api'
import {
  type ChatMessage,
  type ChatSession,
  type TrainingGoals,
  chatMessageSchema,
  chatSessionSchema,
  trainingGoalsSchema,
} from '@/shared/schemas/chat.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

const chatApi = {
  listSessions: (): Promise<ChatSession[]> =>
    api.get<ChatSession[]>('/chat/sessions').then((r) => chatSessionSchema.array().parse(r.data)),

  createSession: (): Promise<ChatSession> =>
    api.post<ChatSession>('/chat/sessions').then((r) => chatSessionSchema.parse(r.data)),

  deleteSession: (id: string): Promise<void> =>
    api.delete(`/chat/sessions/${id}`).then(() => undefined),

  renameSession: (id: string, title: string): Promise<ChatSession> =>
    api
      .patch<ChatSession>(`/chat/sessions/${id}`, { title })
      .then((r) => chatSessionSchema.parse(r.data)),

  listMessages: (sessionId: string): Promise<ChatMessage[]> =>
    api
      .get<ChatMessage[]>(`/chat/sessions/${sessionId}/messages`)
      .then((r) => chatMessageSchema.array().parse(r.data)),

  sendMessage: (sessionId: string, content: string): Promise<ChatMessage> =>
    api
      .post<ChatMessage>(`/chat/sessions/${sessionId}/messages`, { content })
      .then((r) => chatMessageSchema.parse(r.data)),

  getTrainingGoals: (): Promise<TrainingGoals> =>
    api.get<TrainingGoals>('/training-goals').then((r) => trainingGoalsSchema.parse(r.data)),

  updateTrainingGoals: (body: { goals?: string; active?: boolean }): Promise<TrainingGoals> =>
    api.put<TrainingGoals>('/training-goals', body).then((r) => trainingGoalsSchema.parse(r.data)),
}

export function useChatSessions() {
  return useQuery({
    queryKey: ['chat', 'sessions'],
    queryFn: chatApi.listSessions,
    staleTime: 30_000,
  })
}

export function useChatMessages(sessionId: string | null) {
  return useQuery({
    queryKey: ['chat', 'messages', sessionId],
    queryFn: () => {
      if (sessionId === null) return Promise.resolve([])
      return chatApi.listMessages(sessionId)
    },
    enabled: sessionId !== null,
    staleTime: 0,
  })
}

export function useCreateSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: chatApi.createSession,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'sessions'] }),
  })
}

export function useDeleteSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => chatApi.deleteSession(id),
    onMutate: (id) => {
      qc.setQueryData<ChatSession[]>(['chat', 'sessions'], (prev) =>
        (prev ?? []).filter((s) => s.id !== id),
      )
    },
    onError: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })
}

export function useRenameSession() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, title }: { id: string; title: string }) => chatApi.renameSession(id, title),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'sessions'] }),
  })
}

export function useSendMessage(sessionId: string) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (content: string) => chatApi.sendMessage(sessionId, content),
    onMutate: (content) => {
      const userMsg: ChatMessage = {
        id: `temp-${Date.now()}`,
        session_id: sessionId,
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      }
      qc.setQueryData<ChatMessage[]>(['chat', 'messages', sessionId], (prev) => [
        ...(prev ?? []),
        userMsg,
      ])
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['chat', 'messages', sessionId] })
      qc.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
    onError: () => {
      qc.setQueryData<ChatMessage[]>(['chat', 'messages', sessionId], (prev) =>
        (prev ?? []).filter((m) => !m.id.startsWith('temp-'))
      )
    },
  })
}

export function useTrainingGoals() {
  return useQuery({
    queryKey: ['training-goals'],
    queryFn: chatApi.getTrainingGoals,
    staleTime: 60_000,
  })
}

export function useUpdateTrainingGoals() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: { goals?: string; active?: boolean }) =>
      chatApi.updateTrainingGoals(body),
    onSuccess: (updated) => {
      qc.setQueryData<TrainingGoals>(['training-goals'], updated)
    },
  })
}

export { chatApi }
