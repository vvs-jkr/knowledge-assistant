import { describe, expect, it } from 'vitest'
import { noteMetadataSchema, noteWithContentSchema, updateNoteSchema } from './notes.schema'

const baseMetadata = {
  id: 'abc123',
  filename: 'test.md',
  mime_type: 'text/markdown',
  size_bytes: 1024,
  frontmatter: null,
  created_at: '2026-02-28T12:00:00Z',
  updated_at: '2026-02-28T12:00:00Z',
}

describe('noteMetadataSchema', () => {
  it('accepts valid metadata without frontmatter', () => {
    expect(noteMetadataSchema.safeParse(baseMetadata).success).toBe(true)
  })

  it('accepts metadata with frontmatter object', () => {
    const data = { ...baseMetadata, frontmatter: { title: 'My Note', tags: ['rust'] } }
    expect(noteMetadataSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing required fields', () => {
    const { id: _id, ...withoutId } = baseMetadata
    expect(noteMetadataSchema.safeParse(withoutId).success).toBe(false)
  })

  it('rejects non-number size_bytes', () => {
    const data = { ...baseMetadata, size_bytes: '1024' }
    expect(noteMetadataSchema.safeParse(data).success).toBe(false)
  })
})

describe('noteWithContentSchema', () => {
  it('accepts valid note with content', () => {
    const data = {
      id: 'abc123',
      filename: 'test.md',
      content: '# Hello\n\nWorld',
      frontmatter: null,
      created_at: '2026-02-28T12:00:00Z',
      updated_at: '2026-02-28T12:00:00Z',
    }
    expect(noteWithContentSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing content field', () => {
    const data = {
      id: 'abc123',
      filename: 'test.md',
      frontmatter: null,
      created_at: '2026-02-28T12:00:00Z',
      updated_at: '2026-02-28T12:00:00Z',
    }
    expect(noteWithContentSchema.safeParse(data).success).toBe(false)
  })
})

describe('updateNoteSchema', () => {
  it('accepts content-only update', () => {
    expect(updateNoteSchema.safeParse({ content: '# Updated' }).success).toBe(true)
  })

  it('accepts update with optional filename', () => {
    expect(updateNoteSchema.safeParse({ content: '# Updated', filename: 'new.md' }).success).toBe(
      true
    )
  })

  it('rejects empty content', () => {
    const result = updateNoteSchema.safeParse({ content: '' })
    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0].message).toBe('Content cannot be empty')
    }
  })

  it('rejects missing content', () => {
    expect(updateNoteSchema.safeParse({}).success).toBe(false)
  })
})
