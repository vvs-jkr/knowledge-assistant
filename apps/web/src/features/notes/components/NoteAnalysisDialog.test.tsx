import { useNotesStore } from '@/features/notes/store/notes.store'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NoteAnalysisDialog } from './NoteAnalysisDialog'

vi.mock('@/features/notes/api/notes.api', () => ({
  useAnalyzeNote: vi.fn(() => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
  })),
  useImproveNote: vi.fn(() => ({
    mutate: vi.fn(),
    reset: vi.fn(),
    isPending: false,
    isError: false,
    isSuccess: false,
    data: undefined,
  })),
  useNote: vi.fn(() => ({ data: undefined, isLoading: false })),
  useUpdateNote: vi.fn(() => ({ mutate: vi.fn(), isPending: false })),
}))

const resetStore = () =>
  useNotesStore.setState({
    selectedNoteId: null,
    isEditing: false,
    searchQuery: '',
    isSearching: false,
  })

const mockAnalysis = {
  analysis: {
    summary: 'A great note about Rust.',
    quality_score: 8,
    improvement_suggestions: ['Add examples'],
    duplicate_candidates: [],
    tags_suggested: ['rust', 'programming'],
  },
}

describe('NoteAnalysisDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    resetStore()
  })

  it('renders the analyze trigger button', () => {
    render(<NoteAnalysisDialog noteId="note-1" />)
    expect(screen.getByRole('button', { name: /анализ/i })).toBeDefined()
  })

  it('opens the dialog and calls mutate when triggered', async () => {
    const { useAnalyzeNote } = await import('@/features/notes/api/notes.api')
    const mockMutate = vi.fn()
    vi.mocked(useAnalyzeNote).mockReturnValue({
      mutate: mockMutate,
      reset: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as unknown as ReturnType<typeof useAnalyzeNote>)

    const user = userEvent.setup()
    render(<NoteAnalysisDialog noteId="note-1" />)
    await user.click(screen.getByRole('button', { name: /анализ/i }))
    expect(screen.getByText('AI Анализ')).toBeDefined()
    expect(mockMutate).toHaveBeenCalledWith('note-1')
  })

  it('shows loading skeletons while analysis is pending', async () => {
    const { useAnalyzeNote } = await import('@/features/notes/api/notes.api')
    vi.mocked(useAnalyzeNote).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: true,
      isError: false,
      isSuccess: false,
      data: undefined,
    } as unknown as ReturnType<typeof useAnalyzeNote>)

    const user = userEvent.setup()
    render(<NoteAnalysisDialog noteId="note-1" />)
    await user.click(screen.getByRole('button', { name: /анализ/i }))
    expect(document.body.querySelectorAll('.animate-pulse').length).toBeGreaterThan(0)
  })

  it('shows error message and retry button on failure', async () => {
    const { useAnalyzeNote } = await import('@/features/notes/api/notes.api')
    vi.mocked(useAnalyzeNote).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: true,
      isSuccess: false,
      data: undefined,
    } as unknown as ReturnType<typeof useAnalyzeNote>)

    const user = userEvent.setup()
    render(<NoteAnalysisDialog noteId="note-1" />)
    await user.click(screen.getByRole('button', { name: /анализ/i }))
    expect(screen.getByText('Анализ не удался')).toBeDefined()
    expect(screen.getByRole('button', { name: /повторить/i })).toBeDefined()
  })

  it('shows analysis summary, quality score, tags, and suggestions on success', async () => {
    const { useAnalyzeNote } = await import('@/features/notes/api/notes.api')
    vi.mocked(useAnalyzeNote).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      data: mockAnalysis,
    } as unknown as ReturnType<typeof useAnalyzeNote>)

    const user = userEvent.setup()
    render(<NoteAnalysisDialog noteId="note-1" />)
    await user.click(screen.getByRole('button', { name: /анализ/i }))
    expect(screen.getByText('A great note about Rust.')).toBeDefined()
    expect(screen.getByText('8/10')).toBeDefined()
    expect(screen.getByText('rust')).toBeDefined()
    expect(screen.getByText('programming')).toBeDefined()
    expect(screen.getByText('Add examples')).toBeDefined()
  })

  it('shows duplicate candidates when present', async () => {
    const { useAnalyzeNote } = await import('@/features/notes/api/notes.api')
    vi.mocked(useAnalyzeNote).mockReturnValue({
      mutate: vi.fn(),
      reset: vi.fn(),
      isPending: false,
      isError: false,
      isSuccess: true,
      data: {
        analysis: {
          ...mockAnalysis.analysis,
          duplicate_candidates: [
            { note_id: 'n2', filename: 'similar.md', similarity_reason: 'Same topic' },
          ],
        },
      },
    } as unknown as ReturnType<typeof useAnalyzeNote>)

    const user = userEvent.setup()
    render(<NoteAnalysisDialog noteId="note-1" />)
    await user.click(screen.getByRole('button', { name: /анализ/i }))
    expect(screen.getByText('similar.md')).toBeDefined()
    expect(screen.getByText('Same topic')).toBeDefined()
  })
})
