import { z } from 'zod'

export const knowledgeDocTypeSchema = z.enum([
  'general',
  'archive_workout',
  'book_excerpt',
  'programming_principle',
  'exercise_note',
  'coach_note',
  'user_preference',
])

export const knowledgeReviewStatusSchema = z.enum(['draft', 'reviewed', 'needs_review'])

export const knowledgeEntrySchema = z.object({
  id: z.string(),
  title: z.string(),
  source: z.string(),
  doc_type: knowledgeDocTypeSchema,
  tags: z.array(z.string()),
  review_status: knowledgeReviewStatusSchema,
  use_for_generation: z.boolean(),
  metadata: z.record(z.string(), z.unknown()),
  size_bytes: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const knowledgeEntryWithContentSchema = knowledgeEntrySchema.extend({
  content: z.string(),
})

export const draftExerciseSchema = z.object({
  name: z.string(),
  sets: z.number().nullable(),
  reps: z.number().nullable(),
  weight_note: z.string().nullable(),
})

export const draftSectionItemSchema = z.object({
  name: z.string(),
  sets: z.number().nullable(),
  reps: z.number().nullable(),
  weight_note: z.string().nullable(),
  prescription_text: z.string().nullable(),
  notes: z.string().nullable(),
})

export const draftWorkoutSectionSchema = z.object({
  section_key: z.string(),
  section_role: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  notes: z.string().nullable(),
  items: z.array(draftSectionItemSchema),
})

export const workoutDraftSchema = z.object({
  name: z.string(),
  workout_type: z.string(),
  duration_mins: z.number().nullable(),
  notes: z.string().nullable(),
  sections: z.array(draftWorkoutSectionSchema),
  exercises: z.array(draftExerciseSchema),
})

export const generatedWorkoutSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  result: workoutDraftSchema,
  knowledge_ids: z.array(z.string()),
  created_at: z.string(),
})

export type KnowledgeEntry = z.infer<typeof knowledgeEntrySchema>
export type KnowledgeEntryWithContent = z.infer<typeof knowledgeEntryWithContentSchema>
export type KnowledgeDocType = z.infer<typeof knowledgeDocTypeSchema>
export type KnowledgeReviewStatus = z.infer<typeof knowledgeReviewStatusSchema>
export type DraftExercise = z.infer<typeof draftExerciseSchema>
export type DraftSectionItem = z.infer<typeof draftSectionItemSchema>
export type DraftWorkoutSection = z.infer<typeof draftWorkoutSectionSchema>
export type WorkoutDraft = z.infer<typeof workoutDraftSchema>
export type GeneratedWorkout = z.infer<typeof generatedWorkoutSchema>
