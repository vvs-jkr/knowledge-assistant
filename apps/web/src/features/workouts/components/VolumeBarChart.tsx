import type { WeeklyVolumeEntry } from '@/shared/schemas/workouts.schema'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface VolumeBarChartProps {
  data: WeeklyVolumeEntry[]
}

function formatWeekStart(dateStr: string): string {
  const d = new Date(dateStr)
  return d.toLocaleString('ru', { month: 'short', day: 'numeric' })
}

export function VolumeBarChart({ data }: VolumeBarChartProps) {
  const chartData = data.map((entry) => ({
    week: formatWeekStart(entry.week_start),
    volume: entry.total_volume,
    workouts: entry.workout_count,
  }))

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
        <XAxis dataKey="week" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} width={48} />
        <Tooltip />
        <Legend />
        <Bar dataKey="volume" fill="hsl(var(--chart-1))" name="Объём" />
        <Bar dataKey="workouts" fill="hsl(var(--chart-2))" name="Тренировки" />
      </BarChart>
    </ResponsiveContainer>
  )
}
