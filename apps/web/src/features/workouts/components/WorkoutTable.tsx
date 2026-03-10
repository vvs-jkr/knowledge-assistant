import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { useWorkouts } from '@/features/workouts/api/workouts.api'
import { useWorkoutsStore } from '@/features/workouts/store/workouts.store'
import type { WorkoutSummary } from '@/shared/schemas/workouts.schema'
import {
  type SortingState,
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  useReactTable,
} from '@tanstack/react-table'
import { ArrowUpDown } from 'lucide-react'
import { useState } from 'react'

const columnHelper = createColumnHelper<WorkoutSummary>()

const columns = [
  columnHelper.accessor('date', {
    header: 'Date',
    cell: (info) => info.getValue(),
    enableSorting: true,
  }),
  columnHelper.accessor('name', {
    header: 'Name',
    cell: (info) => info.getValue(),
    enableSorting: true,
  }),
  columnHelper.accessor('workout_type', {
    header: 'Type',
    cell: (info) => <Badge variant="secondary">{info.getValue()}</Badge>,
  }),
  columnHelper.accessor('duration_mins', {
    header: 'Duration',
    cell: (info) => {
      const val = info.getValue()
      return val !== null ? `${val} min` : '—'
    },
  }),
  columnHelper.accessor('rounds', {
    header: 'Rounds',
    cell: (info) => {
      const val = info.getValue()
      return val !== null ? val : '—'
    },
  }),
  columnHelper.accessor('exercise_count', {
    header: 'Exercises',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('source_type', {
    header: 'Source',
    cell: (info) => <Badge variant="outline">{info.getValue()}</Badge>,
  }),
]

export function WorkoutTable() {
  const filters = useWorkoutsStore((s) => s.filters)
  const selectWorkout = useWorkoutsStore((s) => s.selectWorkout)

  const queryParams = {
    ...(filters.workout_type !== null ? { workout_type: filters.workout_type } : {}),
    ...(filters.from !== null ? { from: filters.from } : {}),
    ...(filters.to !== null ? { to: filters.to } : {}),
  }

  const { data: workouts, isLoading } = useWorkouts(queryParams)
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: workouts ?? [],
    columns,
    state: { sorting },
    onSortingChange: setSorting,
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

  if (!workouts?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No workouts found
      </div>
    )
  }

  return (
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
                          ? 'flex cursor-pointer items-center gap-1 select-none'
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
          {table.getRowModel().rows.map((row) => (
            <TableRow
              key={row.id}
              className="cursor-pointer hover:bg-muted/50"
              onClick={() => selectWorkout(row.original.id)}
            >
              {row.getVisibleCells().map((cell) => (
                <TableCell key={cell.id}>
                  {flexRender(cell.column.columnDef.cell, cell.getContext())}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}
