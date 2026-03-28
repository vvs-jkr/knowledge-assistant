import { Skeleton } from '@/components/ui/skeleton'
import { useHealthMetrics } from '@/features/health/api/health.api'
import type { MetricsQuery } from '@/shared/schemas/health.schema'
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

const METRIC_LABELS: Record<string, string> = {
  glucose: 'Глюкоза (Glucose, mmol/L)',
  cholesterol_total: 'Холестерин общий (Total Cholesterol, mmol/L)',
  cholesterol_hdl: 'Холестерин ЛПВП (HDL, mmol/L)',
  cholesterol_ldl: 'Холестерин ЛПНП (LDL, mmol/L)',
  hemoglobin: 'Гемоглобин (Hgb, g/L)',
  platelets: 'Тромбоциты (PLT, x10⁹/L)',
  leukocytes: 'Лейкоциты (WBC, x10⁹/L)',
  erythrocytes: 'Эритроциты (RBC, x10¹²/L)',
  esr: 'СОЭ (ESR, mm/h)',
  creatinine: 'Креатинин (Creatinine, μmol/L)',
  alt: 'АЛТ (ALT, U/L)',
  ast: 'АСТ (AST, U/L)',
}

interface MetricsChartProps {
  params?: MetricsQuery
}

export function MetricsChart({ params }: MetricsChartProps) {
  const { data: metrics, isLoading } = useHealthMetrics(params)

  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!metrics?.length) {
    return (
      <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
        No metrics to chart
      </div>
    )
  }

  // Group by metric_name
  const byMetric = new Map<string, typeof metrics>()
  for (const m of metrics) {
    const arr = byMetric.get(m.metric_name) ?? []
    arr.push(m)
    byMetric.set(m.metric_name, arr)
  }

  const metricNames = [...byMetric.keys()]

  return (
    <div className="space-y-8 p-4">
      {metricNames.map((name) => {
        const data = byMetric.get(name) ?? []
        const label = METRIC_LABELS[name] ?? name
        const refMin = data[0]?.reference_min ?? null
        const refMax = data[0]?.reference_max ?? null

        const chartData = data.map((m) => ({ date: m.recorded_date, value: m.value }))

        return (
          <div key={name}>
            <p className="mb-2 text-sm font-medium">{label}</p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip />
                {refMin !== null && (
                  <ReferenceLine
                    y={refMin}
                    stroke="hsl(var(--chart-2))"
                    strokeDasharray="4 2"
                    label={{ value: `min ${refMin}`, fontSize: 10 }}
                  />
                )}
                {refMax !== null && (
                  <ReferenceLine
                    y={refMax}
                    stroke="hsl(var(--chart-2))"
                    strokeDasharray="4 2"
                    label={{ value: `max ${refMax}`, fontSize: 10 }}
                  />
                )}
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke="hsl(var(--chart-1))"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )
      })}
    </div>
  )
}
