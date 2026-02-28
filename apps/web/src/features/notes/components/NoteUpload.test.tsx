import { render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteUpload } from './NoteUpload'

vi.mock('@/features/notes/api/notes.api', () => ({
  useUploadNotes: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

describe('NoteUpload', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders the upload prompt text', () => {
    render(<NoteUpload />)
    expect(screen.getByText('Drop .md files or click')).toBeDefined()
  })

  it('renders a hidden file input', () => {
    render(<NoteUpload />)
    const input = document.querySelector('input[type="file"]')
    expect(input).not.toBeNull()
  })

  it('file input restricts to markdown mime type', () => {
    render(<NoteUpload />)
    const input = document.querySelector('input[type="file"]')
    const accept = input?.getAttribute('accept') ?? ''
    expect(accept).toContain('.md')
  })

  it('shows "Uploading…" when mutation is pending', async () => {
    const { useUploadNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useUploadNotes).mockReturnValueOnce({
      mutate: vi.fn(),
      isPending: true,
    } as unknown as ReturnType<typeof useUploadNotes>)
    render(<NoteUpload />)
    expect(screen.getByText('Uploading…')).toBeDefined()
  })
})
