import { z } from 'zod'

export const noteMetadataSchema = z.object({
  id: z.string(),
  filename: z.string(),
  mime_type: z.string(),
  size_bytes: z.number(),
  frontmatter: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const noteWithContentSchema = z.object({
  id: z.string(),
  filename: z.string(),
  content: z.string(),
  frontmatter: z.record(z.string(), z.unknown()).nullable(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const updateNoteSchema = z.object({
  content: z.string().min(1, 'Content cannot be empty'),
  filename: z.string().optional(),
})

export const searchResultSchema = z.object({
  note_id: z.string(),
  filename: z.string(),
  distance: z.number(),
  snippet: z.string(),
  frontmatter: z.record(z.string(), z.unknown()).nullable(),
})

export const duplicateCandidateSchema = z.object({
  note_id: z.string(),
  filename: z.string(),
  similarity_reason: z.string(),
})

export const noteAnalysisSchema = z.object({
  summary: z.string(),
  quality_score: z.number().int().min(1).max(10),
  improvement_suggestions: z.array(z.string()),
  duplicate_candidates: z.array(duplicateCandidateSchema),
  tags_suggested: z.array(z.string()),
})

export const analyzeResponseSchema = z.object({
  analysis: noteAnalysisSchema,
})

export const improveResponseSchema = z.object({
  improved_content: z.string(),
})

export type NoteMetadata = z.infer<typeof noteMetadataSchema>
export type NoteWithContent = z.infer<typeof noteWithContentSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
export type SearchResult = z.infer<typeof searchResultSchema>
export type DuplicateCandidate = z.infer<typeof duplicateCandidateSchema>
export type NoteAnalysis = z.infer<typeof noteAnalysisSchema>
export type AnalyzeResponse = z.infer<typeof analyzeResponseSchema>
export type ImproveResponse = z.infer<typeof improveResponseSchema>
