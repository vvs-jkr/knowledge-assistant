import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useArchivedWorkouts } from '@/features/workouts/api/workouts.api'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import { cn } from '@/lib/utils'
import type { ArchivedWorkoutSummary } from '@/shared/schemas/workouts.schema'
import {
  type SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown, ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'

const PAGE_SIZE = 15
const columnHelper = createColumnHelper<ArchivedWorkoutSummary>()

const STATUS_LABELS: Record<ArchivedWorkoutSummary['review_status'], string> = {
  raw: 'Raw',
  needs_review: 'Нужно проверить',
  reviewed: 'Проверено',
  corrected: 'Исправлено',
}

const columns = [
  columnHelper.accessor('archive_date', {
    header: 'Дата',
    cell: (info) => info.getValue(),
    enableSorting: true,
  }),
  columnHelper.accessor('title', {
    header: 'Карточка',
    cell: (info) => info.getValue(),
    enableSorting: true,
  }),
  columnHelper.accessor('review_status', {
    header: 'Статус',
    cell: (info) => <Badge variant="secondary">{STATUS_LABELS[info.getValue()]}</Badge>,
  }),
  columnHelper.accessor('section_count', {
    header: 'Секции',
    cell: (info) => info.getValue(),
  }),
]

export function ArchiveTable() {
  const filters = useWorkoutsStore((s) => s.archiveFilters)
  const selectedArchiveWorkoutId = useWorkoutsStore((s) => s.selectedArchiveWorkoutId)
  const selectArchiveWorkout = useWorkoutsStore((s) => s.selectArchiveWorkout)
  const [sorting, setSorting] = useState<SortingState>([])
  const [page, setPage] = useState(0)

  const queryParams = {
    ...(filters.review_status !== null ? { review_status: filters.review_status } : {}),
    ...(filters.year !== null ? { year: Number(filters.year) } : {}),
  }

  const { data: items, isLoading } = useArchivedWorkouts(queryParams)

  const table = useReactTable({
    data: items ?? [],
    columns,
    state: { sorting },
    onSortingChange: (updater) => {
      setSorting(updater)
      setPage(0)
    },
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  })

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {[1, 2, 3, 4].map((i) => (
          <Skeleton key={i} className="h-10 w-full" />
        ))}
      </div>
    )
  }

  if (!items?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        Архивные карточки не найдены
      </div>
    )
  }

  const allRows = table.getRowModel().rows
  const totalPages = Math.ceil(allRows.length / PAGE_SIZE)
  const pageRows = allRows.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  return (
    <div className="flex flex-col overflow-hidden">
      <div className="overflow-auto">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((hg) => (
              <TableRow key={hg.id}>
                {hg.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder ? null : (
                      <button
                        type="button"
                        className={
                          header.column.getCanSort()
                            ? 'flex cursor-pointer select-none items-center gap-1'
                            : undefined
                        }
                        onClick={header.column.getToggleSortingHandler()}
                      >
                        {flexRender(header.column.columnDef.header, header.getContext())}
                        {header.column.getCanSort() && (
                          <ArrowUpDown className="h-3 w-3 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {pageRows.map((row) => {
              const isSelected = row.original.id === selectedArchiveWorkoutId
              return (
                <TableRow
                  key={row.id}
                  className={cn(
                    'cursor-pointer',
                    isSelected ? 'bg-primary/10 hover:bg-primary/15' : 'hover:bg-muted/50'
                  )}
                  onClick={() => selectArchiveWorkout(row.original.id)}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      </div>

      {totalPages > 1 && (
        <div className="flex shrink-0 items-center justify-between border-t px-4 py-2 text-sm text-muted-foreground">
          <span>
            {page * PAGE_SIZE + 1}-{Math.min((page + 1) * PAGE_SIZE, allRows.length)} из{' '}
            {allRows.length}
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span>
              {page + 1} / {totalPages}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page === totalPages - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
