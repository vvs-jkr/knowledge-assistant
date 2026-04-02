import { Button } from '@/components/ui/button'
import {
  useBatchReviewArchivedWorkouts,
  useArchivedWorkouts,
} from '@/features/workouts/api/workouts.api'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import type { ArchiveReviewStatus } from '@/shared/schemas/workouts.schema'
import { AlertCircle, Calendar, X } from 'lucide-react'
import { toast } from 'sonner'

const REVIEW_STATUS_OPTIONS = [
  { value: 'raw', label: 'Raw' },
  { value: 'needs_review', label: 'Нужно проверить' },
  { value: 'reviewed', label: 'Проверено' },
  { value: 'corrected', label: 'Исправлено' },
] as const

export function ArchiveFilterBar() {
  const filters = useWorkoutsStore((s) => s.archiveFilters)
  const selectedArchiveWorkoutIds = useWorkoutsStore((s) => s.selectedArchiveWorkoutIds)
  const setArchiveFilter = useWorkoutsStore((s) => s.setArchiveFilter)
  const resetArchiveFilters = useWorkoutsStore((s) => s.resetArchiveFilters)
  const clearArchiveWorkoutSelection = useWorkoutsStore((s) => s.clearArchiveWorkoutSelection)
  const batchReview = useBatchReviewArchivedWorkouts()

  const queryParams = {
    ...(filters.review_status !== null ? { review_status: filters.review_status } : {}),
    ...(filters.year !== null ? { year: Number(filters.year) } : {}),
  }
  const { data: items } = useArchivedWorkouts(queryParams)

  const hasFilters = filters.review_status !== null || filters.year !== null

  const selectedIds = selectedArchiveWorkoutIds
  const selectedCount = selectedIds.length

  const runBatch = async (payload: {
    review_status?: ArchiveReviewStatus
    ready_for_retrieval?: boolean
    confirmMessage?: string
  }) => {
    if (selectedIds.length === 0) {
      toast.error('Нет выбранных карточек для batch review')
      return
    }
    if (payload.confirmMessage && !window.confirm(payload.confirmMessage)) {
      return
    }

    const { confirmMessage: _confirmMessage, ...request } = payload

    await batchReview.mutateAsync(
      { ids: selectedIds, ...request },
      {
        onSuccess: (result) => {
          clearArchiveWorkoutSelection()
          toast.success(`Обновлено карточек: ${result.updated}`)
        },
        onError: () => toast.error('Не удалось обновить архивные карточки'),
      }
    )
  }

  return (
    <div className="flex flex-wrap items-center gap-2 border-b px-4 py-2">
      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        <AlertCircle className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <select
          aria-label="Фильтр по статусу архива"
          value={filters.review_status ?? ''}
          onChange={(e) => {
            const value = e.target.value
            setArchiveFilter('review_status', value === '' ? null : value)
          }}
          className="bg-background text-sm text-foreground outline-none"
        >
          <option value="">Все статусы</option>
          {REVIEW_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <div className="flex items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
        <Calendar className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        <input
          type="number"
          min="1900"
          max="2100"
          step="1"
          placeholder="Год"
          aria-label="Фильтр по году архива"
          value={filters.year ?? ''}
          onChange={(e) => {
            const value = e.target.value.trim()
            setArchiveFilter('year', value === '' ? null : value)
          }}
          className="w-20 bg-background text-sm text-foreground outline-none"
        />
      </div>

      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={resetArchiveFilters}
          className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
          Сброс
        </Button>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-2">
        <div className="text-sm text-muted-foreground">
          {selectedCount > 0 ? `Выбрано: ${selectedCount}` : `Карточек: ${(items ?? []).length}`}
        </div>
        {selectedCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearArchiveWorkoutSelection}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            Снять выбор
          </Button>
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={batchReview.isPending || selectedCount === 0}
          onClick={() =>
            void runBatch({
              review_status: 'reviewed',
              confirmMessage: `Отметить как проверенные ${selectedCount} карточек?`,
            })
          }
        >
          Отметить как проверенные
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={batchReview.isPending || selectedCount === 0}
          onClick={() =>
            void runBatch({
              review_status: 'corrected',
              ready_for_retrieval: true,
              confirmMessage: `Пометить ${selectedCount} карточек как исправленные и разрешить их для RAG?`,
            })
          }
        >
          Исправлено и в RAG
        </Button>
      </div>
    </div>
  )
}
