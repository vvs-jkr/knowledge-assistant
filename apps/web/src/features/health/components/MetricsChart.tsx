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

interface MetricInfo {
  en: string
  ru: string
  unit: string
}

const METRIC_INFO: Record<string, MetricInfo> = {
  glucose: { en: 'Glucose', ru: 'Глюкоза', unit: 'mmol/L' },
  cholesterol_total: { en: 'Total Cholesterol', ru: 'Холестерин общий', unit: 'mmol/L' },
  cholesterol_hdl: { en: 'HDL Cholesterol', ru: 'Холестерин ЛПВП', unit: 'mmol/L' },
  cholesterol_ldl: { en: 'LDL Cholesterol', ru: 'Холестерин ЛПНП', unit: 'mmol/L' },
  hemoglobin: { en: 'Hemoglobin (Hgb)', ru: 'Гемоглобин', unit: 'g/L' },
  platelets: { en: 'Platelets (PLT)', ru: 'Тромбоциты', unit: 'x10⁹/L' },
  leukocytes: { en: 'WBC', ru: 'Лейкоциты', unit: 'x10⁹/L' },
  erythrocytes: { en: 'RBC', ru: 'Эритроциты', unit: 'x10¹²/L' },
  esr: { en: 'ESR', ru: 'СОЭ (скорость оседания эритроцитов)', unit: 'mm/h' },
  creatinine: { en: 'Creatinine', ru: 'Креатинин', unit: 'μmol/L' },
  alt: { en: 'ALT', ru: 'АЛТ (аланинаминотрансфераза)', unit: 'U/L' },
  ast: { en: 'AST', ru: 'АСТ (аспартатаминотрансфераза)', unit: 'U/L' },
  bmr: { en: 'BMR', ru: 'Базальный метаболизм', unit: 'kcal' },
  bmi: { en: 'BMI', ru: 'Индекс массы тела (ИМТ)', unit: '' },
  weight: { en: 'Weight', ru: 'Масса тела', unit: 'kg' },
  active_cell_mass: { en: 'Active Cell Mass', ru: 'Активная клеточная масса', unit: 'kg' },
  body_fat_mass: { en: 'Body Fat Mass', ru: 'Масса жира', unit: 'kg' },
  body_fat_percentage: { en: 'Body Fat %', ru: 'Процент жира', unit: '%' },
  bone_mineral_content: { en: 'Bone Mineral', ru: 'Минеральная масса костей', unit: 'kg' },
  ecw_ratio: { en: 'ECW Ratio', ru: 'Отношение внеклеточной воды', unit: '' },
  extracellular_water: { en: 'ECW', ru: 'Внеклеточная вода', unit: 'L' },
  fat_mass_left_arm: { en: 'Fat L.Arm', ru: 'Жир -- левая рука', unit: 'kg' },
  fat_mass_left_leg: { en: 'Fat L.Leg', ru: 'Жир -- левая нога', unit: 'kg' },
  fat_mass_right_arm: { en: 'Fat R.Arm', ru: 'Жир -- правая рука', unit: 'kg' },
  fat_mass_right_leg: { en: 'Fat R.Leg', ru: 'Жир -- правая нога', unit: 'kg' },
  fat_mass_trunk: { en: 'Fat Trunk', ru: 'Жир -- туловище', unit: 'kg' },
  inbody_score: { en: 'InBody Score', ru: 'Оценка InBody', unit: '' },
  intracellular_water: { en: 'ICW', ru: 'Внутриклеточная вода', unit: 'L' },
  lean_mass_left_arm: { en: 'Lean L.Arm', ru: 'Мышцы -- левая рука', unit: 'kg' },
  lean_mass_left_leg: { en: 'Lean L.Leg', ru: 'Мышцы -- левая нога', unit: 'kg' },
  lean_mass_right_arm: { en: 'Lean R.Arm', ru: 'Мышцы -- правая рука', unit: 'kg' },
  lean_mass_right_leg: { en: 'Lean R.Leg', ru: 'Мышцы -- правая нога', unit: 'kg' },
  lean_mass_trunk: { en: 'Lean Trunk', ru: 'Мышцы -- туловище', unit: 'kg' },
  skeletal_muscle_mass: { en: 'Skeletal Muscle', ru: 'Скелетная мышечная масса', unit: 'kg' },
  total_body_water: { en: 'Total Water', ru: 'Общая вода тела', unit: 'L' },
  visceral_fat_level: { en: 'Visceral Fat', ru: 'Уровень висцерального жира', unit: '' },
}

function getInfo(metricName: string): MetricInfo {
  return METRIC_INFO[metricName] ?? { en: metricName, ru: metricName, unit: '' }
}

interface ChartTooltipProps {
  active?: boolean
  payload?: Array<{ value?: number }>
  label?: string
  unit: string
  ru: string
}

function ChartTooltip({ active, payload, label, unit, ru }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return (
    <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
      <p className="font-medium text-foreground">{ru}</p>
      <p className="text-muted-foreground">{label}</p>
      <p className="text-foreground">
        {payload[0]?.value} {unit}
      </p>
    </div>
  )
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
        Нет данных для графиков
      </div>
    )
  }

  const byMetric = new Map<string, typeof metrics>()
  for (const m of metrics) {
    const arr = byMetric.get(m.metric_name) ?? []
    arr.push(m)
    byMetric.set(m.metric_name, arr)
  }

  return (
    <div className="grid grid-cols-1 gap-6 p-4 lg:grid-cols-2">
      {[...byMetric.keys()].map((name) => {
        const data = byMetric.get(name) ?? []
        const info = getInfo(name)
        const refMin = data[0]?.reference_min ?? null
        const refMax = data[0]?.reference_max ?? null
        const chartData = data.map((m) => ({ date: m.recorded_date, value: m.value }))
        const heading = info.unit ? `${info.en} (${info.unit})` : info.en

        return (
          <div key={name}>
            <p
              title={info.ru}
              className="mb-2 cursor-help text-sm font-medium underline decoration-dotted decoration-muted-foreground underline-offset-2"
            >
              {heading}
            </p>
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={chartData} margin={{ top: 4, right: 16, bottom: 4, left: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} width={48} />
                <Tooltip content={<ChartTooltip unit={info.unit} ru={info.ru} />} />
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
