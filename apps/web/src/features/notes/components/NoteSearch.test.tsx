import { useNotesStore } from '@/features/notes/store/notes.store'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteSearch } from './NoteSearch'

vi.mock('@/features/notes/api/notes.api', () => ({
  useSearchNotes: vi.fn(() => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
  })),
}))

const resetStore = () =>
  useNotesStore.setState({
    selectedNoteId: null,
    isEditing: false,
    searchQuery: '',
    isSearching: false,
  })

describe('NoteSearch', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('renders a search input', () => {
    render(<NoteSearch />)
    expect(screen.getByPlaceholderText('Semantic search…')).toBeDefined()
  })

  it('shows skeletons while search is pending', async () => {
    const { useSearchNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useSearchNotes).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as unknown as ReturnType<typeof useSearchNotes>)

    const { container } = render(<NoteSearch />)
    expect(container.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows error message when search fails', async () => {
    const { useSearchNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useSearchNotes).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
    } as unknown as ReturnType<typeof useSearchNotes>)

    render(<NoteSearch />)
    expect(screen.getByText('Search failed. Try again.')).toBeDefined()
  })

  it('shows "No results found." when search returns empty array', async () => {
    const { useSearchNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useSearchNotes).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [],
    } as unknown as ReturnType<typeof useSearchNotes>)

    render(<NoteSearch />)
    expect(screen.getByText('No results found.')).toBeDefined()
  })

  it('renders result filename, similarity percentage, and snippet', async () => {
    const { useSearchNotes } = await import('@/features/notes/api/notes.api')
    vi.mocked(useSearchNotes).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [
        {
          note_id: 'n1',
          filename: 'result.md',
          distance: 0.1,
          snippet: 'A snippet',
          frontmatter: null,
        },
      ],
    } as unknown as ReturnType<typeof useSearchNotes>)

    render(<NoteSearch />)
    expect(screen.getByText('result.md')).toBeDefined()
    expect(screen.getByText('90%')).toBeDefined()
    expect(screen.getByText('A snippet')).toBeDefined()
  })

  it('selects a note and clears the search when a result is clicked', async () => {
    const { useSearchNotes } = await import('@/features/notes/api/notes.api')
    const mockReset = vi.fn()
    vi.mocked(useSearchNotes).mockReturnValue({
      mutate: vi.fn(),
      reset: mockReset,
      isPending: false,
      isError: false,
      isSuccess: true,
      data: [
        { note_id: 'n1', filename: 'result.md', distance: 0.2, snippet: null, frontmatter: null },
      ],
    } as unknown as ReturnType<typeof useSearchNotes>)

    const user = userEvent.setup()
    render(<NoteSearch />)
    await user.click(screen.getByRole('button', { name: /result\.md/i }))
    expect(useNotesStore.getState().selectedNoteId).toBe('n1')
    expect(mockReset).toHaveBeenCalled()
  })
})
