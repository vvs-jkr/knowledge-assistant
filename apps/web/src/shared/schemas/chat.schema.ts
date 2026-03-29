import { z } from 'zod'

export const chatSessionSchema = z.object({
  id: z.string(),
  title: z.string(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const chatMessageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  created_at: z.string(),
})

export const trainingGoalsSchema = z.object({
  goals: z.string(),
  active: z.boolean(),
  updated_at: z.string(),
})

export type ChatSession = z.infer<typeof chatSessionSchema>
export type ChatMessage = z.infer<typeof chatMessageSchema>
export type TrainingGoals = z.infer<typeof trainingGoalsSchema>
