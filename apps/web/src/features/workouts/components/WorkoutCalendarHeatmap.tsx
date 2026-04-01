import type { HeatmapEntry } from '@/shared/schemas/workouts.schema'

interface WorkoutCalendarHeatmapProps {
  data: HeatmapEntry[]
}

type GridCell = {
  date: string
  count: number
} | null

function buildHeatmapGrid(data: HeatmapEntry[], weeks = 26): GridCell[][] {
  const countByDate = new Map<string, number>()
  for (const entry of data) {
    countByDate.set(entry.date, entry.count)
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  // Align to current week's Sunday
  const endDate = new Date(today)
  const dayOfWeek = endDate.getDay() // 0 = Sunday
  endDate.setDate(endDate.getDate() + (6 - dayOfWeek))

  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - weeks * 7 + 1)

  // Build weeks x days matrix (row = day of week 0-6, col = week)
  const cols: GridCell[][] = []

  const cursor = new Date(startDate)
  for (let week = 0; week < weeks; week++) {
    const col: GridCell[] = []
    for (let day = 0; day < 7; day++) {
      const dateStr = cursor.toISOString().slice(0, 10)
      col.push({
        date: dateStr,
        count: countByDate.get(dateStr) ?? 0,
      })
      cursor.setDate(cursor.getDate() + 1)
    }
    cols.push(col)
  }

  return cols
}

function cellColorClass(count: number): string {
  if (count === 0) return 'bg-muted'
  if (count === 1) return 'bg-[hsl(var(--chart-1)/0.3)]'
  if (count <= 3) return 'bg-[hsl(var(--chart-1)/0.6)]'
  return 'bg-[hsl(var(--chart-1))]'
}

const DAY_LABELS = ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
const SHOW_DAY_LABELS = [1, 3, 5] // Mon, Wed, Fri indices

function getWeekKey(col: GridCell[], index: number): string {
  return col[0]?.date ?? `week-${index}`
}

function getCellTitle(cell: GridCell): string {
  if (cell === null) return ''
  const workoutsWord =
    cell.count === 1 ? 'тренировка' : cell.count < 5 ? 'тренировки' : 'тренировок'
  return `${cell.date}: ${cell.count} ${workoutsWord}`
}

function HeatmapWeekColumn({ col, index }: { col: GridCell[]; index: number }) {
  return (
    <div key={getWeekKey(col, index)} className="flex flex-col gap-0.5">
      {col.map((cell, cellIndex) => (
        <div
          key={cell?.date ?? `${getWeekKey(col, index)}-${cellIndex}`}
          className={`h-4 w-4 rounded-sm ${cell ? cellColorClass(cell.count) : 'bg-muted'}`}
          title={getCellTitle(cell)}
        />
      ))}
    </div>
  )
}

function getMonthLabels(cols: GridCell[][]): { label: string; colIndex: number }[] {
  const labels: { label: string; colIndex: number }[] = []
  let lastMonth = -1
  for (let i = 0; i < cols.length; i++) {
    const col = cols[i]
    const firstCell = col?.[0]
    if (firstCell) {
      const month = new Date(firstCell.date).getMonth()
      if (month !== lastMonth) {
        labels.push({
          label: new Date(firstCell.date).toLocaleString('ru', { month: 'short' }),
          colIndex: i,
        })
        lastMonth = month
      }
    }
  }
  return labels
}

export function WorkoutCalendarHeatmap({ data }: WorkoutCalendarHeatmapProps) {
  const cols = buildHeatmapGrid(data, 26)
  const monthLabels = getMonthLabels(cols)

  return (
    <div className="overflow-x-auto">
      <div className="inline-flex flex-col gap-1">
        {/* Month labels */}
        <div className="flex gap-0.5 pl-8">
          {cols.map((col, i) => {
            const label = monthLabels.find((m) => m.colIndex === i)
            return (
              <div key={getWeekKey(col, i)} className="h-4 w-4 text-center">
                {label && (
                  <span className="text-[10px] text-muted-foreground leading-none">
                    {label.label}
                  </span>
                )}
              </div>
            )
          })}
        </div>

        {/* Grid rows */}
        <div className="flex gap-0.5">
          {/* Day labels */}
          <div className="flex flex-col gap-0.5 pr-1">
            {DAY_LABELS.map((label, i) => (
              <div key={label} className="flex h-4 items-center">
                <span className="w-7 text-right text-[10px] text-muted-foreground leading-none">
                  {SHOW_DAY_LABELS.includes(i) ? label : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Cells */}
          {cols.map((col, index) => (
            <HeatmapWeekColumn key={getWeekKey(col, index)} col={col} index={index} />
          ))}
        </div>
      </div>
    </div>
  )
}

export { buildHeatmapGrid }
