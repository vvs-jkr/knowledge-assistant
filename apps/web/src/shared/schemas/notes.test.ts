import { describe, expect, it } from 'vitest'
import {
  analyzeResponseSchema,
  noteAnalysisSchema,
  noteMetadataSchema,
  noteWithContentSchema,
  searchResultSchema,
  updateNoteSchema,
} from './notes.schema'

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

describe('searchResultSchema', () => {
  const validResult = {
    note_id: 'abc',
    filename: 'note.md',
    distance: 0.12,
    snippet: 'Some text here…',
    frontmatter: null,
  }

  it('accepts valid search result', () => {
    expect(searchResultSchema.safeParse(validResult).success).toBe(true)
  })

  it('accepts result with frontmatter', () => {
    const data = { ...validResult, frontmatter: { title: 'Test' } }
    expect(searchResultSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing note_id', () => {
    const { note_id: _, ...without } = validResult
    expect(searchResultSchema.safeParse(without).success).toBe(false)
  })

  it('rejects non-number distance', () => {
    expect(searchResultSchema.safeParse({ ...validResult, distance: 'close' }).success).toBe(false)
  })
})

describe('noteAnalysisSchema', () => {
  const validAnalysis = {
    summary: 'A good note.',
    quality_score: 8,
    improvement_suggestions: ['Add examples'],
    duplicate_candidates: [],
    tags_suggested: ['rust'],
  }

  it('accepts valid analysis', () => {
    expect(noteAnalysisSchema.safeParse(validAnalysis).success).toBe(true)
  })

  it('rejects quality_score outside 1-10', () => {
    expect(noteAnalysisSchema.safeParse({ ...validAnalysis, quality_score: 0 }).success).toBe(false)
    expect(noteAnalysisSchema.safeParse({ ...validAnalysis, quality_score: 11 }).success).toBe(
      false
    )
  })

  it('rejects non-integer quality_score', () => {
    expect(noteAnalysisSchema.safeParse({ ...validAnalysis, quality_score: 7.5 }).success).toBe(
      false
    )
  })

  it('accepts analysis with duplicate candidates', () => {
    const data = {
      ...validAnalysis,
      duplicate_candidates: [
        { note_id: 'x', filename: 'other.md', similarity_reason: 'Same topic' },
      ],
    }
    expect(noteAnalysisSchema.safeParse(data).success).toBe(true)
  })
})

describe('analyzeResponseSchema', () => {
  it('accepts valid analyze response', () => {
    const data = {
      analysis: {
        summary: 'Summary',
        quality_score: 5,
        improvement_suggestions: [],
        duplicate_candidates: [],
        tags_suggested: [],
      },
    }
    expect(analyzeResponseSchema.safeParse(data).success).toBe(true)
  })

  it('rejects missing analysis field', () => {
    expect(analyzeResponseSchema.safeParse({}).success).toBe(false)
  })
})
