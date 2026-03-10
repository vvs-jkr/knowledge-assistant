import type { ExerciseProgressEntry } from '@/shared/schemas/workouts.schema'
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

interface ExerciseProgressChartProps {
  data: ExerciseProgressEntry[]
  exerciseName: string
}

export function ExerciseProgressChart({ data, exerciseName }: ExerciseProgressChartProps) {
  const chartData = data
    .filter((entry) => entry.max_weight_kg !== null)
    .map((entry) => ({
      date: entry.date,
      weight: entry.max_weight_kg,
    }))

  if (chartData.length === 0) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No weight data for {exerciseName}
      </div>
    )
  }

  return (
    <div>
      <p className="mb-2 text-sm font-medium">{exerciseName} — Max Weight (kg)</p>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
          <XAxis dataKey="date" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} width={48} />
          <Tooltip />
          <Line
            type="monotone"
            dataKey="weight"
            stroke="hsl(var(--chart-1))"
            strokeWidth={2}
            dot={{ r: 4 }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
