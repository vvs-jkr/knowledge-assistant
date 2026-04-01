import { useNotesStore } from '@/features/notes/store/notes.store'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteList } from './NoteList'

vi.mock('@/features/notes/api/notes.api', () => ({
  useNotes: vi.fn(() => ({ data: undefined, isLoading: false })),
  useDeleteNote: vi.fn(() => ({ mutate: vi.fn() })),
  downloadNote: vi.fn(),
}))

const resetStore = () => useNotesStore.setState({ selectedNoteId: null, isEditing: false })

const mockNote = {
  id: 'note-1',
  filename: 'test.md',
  mime_type: 'text/markdown',
  size_bytes: 1024,
  frontmatter: null,
  created_at: '2026-02-28T12:00:00Z',
  updated_at: '2026-02-28T12:00:00Z',
}

describe('NoteList', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('shows empty state when no notes exist', async () => {
    render(<NoteList />)
    expect(screen.getByText('Заметок пока нет')).toBeDefined()
  })

  it('shows skeleton rows while loading', async () => {
    const { useNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useNotes).mockReturnValueOnce({
      data: undefined,
      isLoading: true,
    } as ReturnType<typeof useNotes>)
    const { container } = render(<NoteList />)
    // Skeleton elements have animate-pulse class
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('renders note filename when notes are present', async () => {
    const { useNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useNotes).mockReturnValueOnce({
      data: [mockNote],
      isLoading: false,
    } as ReturnType<typeof useNotes>)
    render(<NoteList />)
    expect(screen.getByText('test.md')).toBeDefined()
  })

  it('selects a note on click', async () => {
    const { useNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useNotes).mockReturnValue({
      data: [mockNote],
      isLoading: false,
    } as ReturnType<typeof useNotes>)
    const user = userEvent.setup()
    render(<NoteList />)
    await user.click(screen.getByText('test.md'))
    expect(useNotesStore.getState().selectedNoteId).toBe('note-1')
  })

  it('renders multiple notes', async () => {
    const { useNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useNotes).mockReturnValueOnce({
      data: [mockNote, { ...mockNote, id: 'note-2', filename: 'second.md' }],
      isLoading: false,
    } as ReturnType<typeof useNotes>)
    render(<NoteList />)
    expect(screen.getByText('test.md')).toBeDefined()
    expect(screen.getByText('second.md')).toBeDefined()
  })
})
