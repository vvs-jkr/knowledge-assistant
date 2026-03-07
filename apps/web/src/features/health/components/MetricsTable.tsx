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
import { useHealthMetrics } from '@/features/health/api/health.api'
import type { HealthMetric, MetricsQuery } from '@/shared/schemas/health.schema'
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

const columnHelper = createColumnHelper<HealthMetric>()

function statusVariant(status: string): 'default' | 'destructive' | 'secondary' {
  if (status === 'high' || status === 'low') return 'destructive'
  return 'secondary'
}

function formatReference(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min} – ${max}`
  if (min !== null) return `> ${min}`
  if (max !== null) return `< ${max}`
  return '—'
}

const columns = [
  columnHelper.accessor('recorded_date', {
    header: 'Date',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('metric_name', {
    header: 'Metric',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('value', {
    header: 'Value',
    cell: (info) => info.getValue(),
  }),
  columnHelper.accessor('unit', {
    header: 'Unit',
    cell: (info) => info.getValue(),
  }),
  columnHelper.display({
    id: 'reference',
    header: 'Reference',
    cell: (info) =>
      formatReference(info.row.original.reference_min, info.row.original.reference_max),
  }),
  columnHelper.accessor('status', {
    header: 'Status',
    cell: (info) => <Badge variant={statusVariant(info.getValue())}>{info.getValue()}</Badge>,
  }),
]

interface MetricsTableProps {
  params?: MetricsQuery
}

export function MetricsTable({ params }: MetricsTableProps) {
  const { data: metrics, isLoading } = useHealthMetrics(params)
  const [sorting, setSorting] = useState<SortingState>([])

  const table = useReactTable({
    data: metrics ?? [],
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

  if (!metrics?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No metrics found
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
            <TableRow key={row.id}>
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
