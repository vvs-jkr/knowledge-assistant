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

export type NoteMetadata = z.infer<typeof noteMetadataSchema>
export type NoteWithContent = z.infer<typeof noteWithContentSchema>
export type UpdateNoteInput = z.infer<typeof updateNoteSchema>
