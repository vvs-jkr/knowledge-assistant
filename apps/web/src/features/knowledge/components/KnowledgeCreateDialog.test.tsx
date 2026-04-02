import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const createMock = vi.fn()

vi.mock('@/features/knowledge/api/knowledge.api', () => ({
  useCreateKnowledge: () => ({
    mutate: createMock,
    isPending: false,
  }),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { KnowledgeCreateDialog } from '@/features/knowledge/components/KnowledgeCreateDialog'

describe('KnowledgeCreateDialog', () => {
  beforeEach(() => {
    createMock.mockReset()
  })

  it('submits a typed knowledge entry payload', async () => {
    const user = userEvent.setup()
    const qc = new QueryClient()

    render(
      <QueryClientProvider client={qc}>
        <KnowledgeCreateDialog />
      </QueryClientProvider>
    )

    await user.click(screen.getByRole('button', { name: /добавить запись/i }))

    fireEvent.change(screen.getByLabelText(/заголовок/i), {
      target: { value: 'Prilepin' },
    })
    fireEvent.change(screen.getByLabelText(/тип документа/i), {
      target: { value: 'programming_principle' },
    })
    fireEvent.change(screen.getByLabelText(/источник/i), {
      target: { value: 'Book' },
    })
    fireEvent.change(screen.getByLabelText(/теги/i), {
      target: { value: 'strength, volume' },
    })
    fireEvent.change(screen.getByLabelText(/содержание/i), {
      target: { value: 'Useful loading table' },
    })

    await user.click(screen.getByRole('button', { name: /^сохранить$/i }))

    await waitFor(() => expect(createMock).toHaveBeenCalledTimes(1))
    expect(createMock.mock.calls[0][0]).toEqual({
      title: 'Prilepin',
      source: 'Book',
      doc_type: 'programming_principle',
      tags: ['strength', 'volume'],
      content: 'Useful loading table',
      review_status: 'reviewed',
      use_for_generation: true,
    })
  }, 10000)
})
