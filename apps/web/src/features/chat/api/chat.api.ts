import { api } from '@/shared/lib/api'
import {
  type ChatMessage,
  type ChatSession,
  chatMessageSchema,
  chatSessionSchema,
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chat', 'sessions'] }),
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
    onSuccess: (newMessage) => {
      qc.setQueryData<ChatMessage[]>(['chat', 'messages', sessionId], (prev) => [
        ...(prev ?? []),
        newMessage,
      ])
      qc.invalidateQueries({ queryKey: ['chat', 'sessions'] })
    },
  })
}

export { chatApi }
