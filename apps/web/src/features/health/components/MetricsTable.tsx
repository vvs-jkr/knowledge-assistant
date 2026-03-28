import { Skeleton } from '@/components/ui/skeleton'
import { useHealthMetrics } from '@/features/health/api/health.api'
import type { HealthMetric, MetricsQuery } from '@/shared/schemas/health.schema'

// ---------------------------------------------------------------------------
// Localisation
// ---------------------------------------------------------------------------

const METRIC_LABELS: Record<string, string> = {
  weight: 'Масса тела',
  bmi: 'ИМТ',
  bmr: 'Базальный метаболизм',
  inbody_score: 'Оценка InBody',
  body_fat_mass: 'Жировая масса',
  body_fat_percentage: 'Процент жира',
  skeletal_muscle_mass: 'Скелетная мышечная масса',
  protein: 'Белок',
  minerals: 'Минералы',
  bone_mineral_content: 'Минеральная масса костей',
  active_cell_mass: 'Масса активных клеток',
  smmi: 'SMMI',
  total_body_water: 'Общая вода организма',
  intracellular_water: 'Внутриклеточная вода',
  extracellular_water: 'Внеклеточная вода',
  ecw_ratio: 'Соотношение ECW/TBW',
  lean_mass_left_arm: 'Мышцы -- левая рука',
  lean_mass_right_arm: 'Мышцы -- правая рука',
  lean_mass_trunk: 'Мышцы -- туловище',
  lean_mass_left_leg: 'Мышцы -- левая нога',
  lean_mass_right_leg: 'Мышцы -- правая нога',
  fat_mass_left_arm: 'Жир -- левая рука',
  fat_mass_right_arm: 'Жир -- правая рука',
  fat_mass_trunk: 'Жир -- туловище',
  fat_mass_left_leg: 'Жир -- левая нога',
  fat_mass_right_leg: 'Жир -- правая нога',
  visceral_fat_level: 'Уровень висцерального жира',
}

const STATUS_LABELS: Record<string, string> = {
  normal: 'Норма',
  high: 'Высокий',
  low: 'Низкий',
  borderline: 'Погранично',
}

const STATUS_CLASSES: Record<string, string> = {
  normal: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  high: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  low: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  borderline: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
}

// ---------------------------------------------------------------------------
// Category grouping
// ---------------------------------------------------------------------------

const CATEGORIES: { label: string; keys: string[] }[] = [
  {
    label: 'Основные показатели',
    keys: ['weight', 'bmi', 'bmr', 'inbody_score'],
  },
  {
    label: 'Состав тела',
    keys: [
      'skeletal_muscle_mass',
      'body_fat_mass',
      'body_fat_percentage',
      'protein',
      'minerals',
      'bone_mineral_content',
      'active_cell_mass',
      'smmi',
    ],
  },
  {
    label: 'Водный баланс',
    keys: ['total_body_water', 'intracellular_water', 'extracellular_water', 'ecw_ratio'],
  },
  {
    label: 'Сегментарный анализ',
    keys: [
      'lean_mass_left_arm',
      'lean_mass_right_arm',
      'lean_mass_trunk',
      'lean_mass_left_leg',
      'lean_mass_right_leg',
      'fat_mass_left_arm',
      'fat_mass_right_arm',
      'fat_mass_trunk',
      'fat_mass_left_leg',
      'fat_mass_right_leg',
      'visceral_fat_level',
    ],
  },
]

function getCategoryLabel(metricName: string): string {
  for (const cat of CATEGORIES) {
    if (cat.keys.includes(metricName)) return cat.label
  }
  return 'Прочее'
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatReference(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return `${min} - ${max}`
  if (min !== null) return `> ${min}`
  if (max !== null) return `< ${max}`
  return '--'
}

function statusClass(status: string): string {
  return STATUS_CLASSES[status] ?? 'bg-muted text-muted-foreground'
}

function formatDate(iso: string): string {
  const [year, month, day] = iso.split('-')
  return `${day}.${month}.${year}`
}

// ---------------------------------------------------------------------------
// Grouped rendering
// ---------------------------------------------------------------------------

interface DateGroup {
  date: string
  categories: { label: string; metrics: HealthMetric[] }[]
}

function groupMetrics(metrics: HealthMetric[]): DateGroup[] {
  // Collect unique dates in descending order.
  const dateOrder: string[] = []
  const byDate = new Map<string, HealthMetric[]>()

  for (const m of metrics) {
    if (!byDate.has(m.recorded_date)) {
      dateOrder.push(m.recorded_date)
      byDate.set(m.recorded_date, [])
    }
    byDate.get(m.recorded_date)?.push(m)
  }

  dateOrder.sort((a, b) => b.localeCompare(a))

  return dateOrder.map((date) => {
    const dateMetrics = byDate.get(date) ?? []

    // Group by category, preserving category order.
    const catMap = new Map<string, HealthMetric[]>()
    for (const m of dateMetrics) {
      const cat = getCategoryLabel(m.metric_name)
      if (!catMap.has(cat)) catMap.set(cat, [])
      catMap.get(cat)?.push(m)
    }

    // Build ordered category list.
    const orderedCatLabels = [...CATEGORIES.map((c) => c.label), 'Прочее'].filter((label) =>
      catMap.has(label)
    )

    const categories = orderedCatLabels.map((label) => ({
      label,
      metrics: catMap.get(label) ?? [],
    }))

    return { date, categories }
  })
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface MetricsTableProps {
  params?: MetricsQuery
}

export function MetricsTable({ params }: MetricsTableProps) {
  const { data: metrics, isLoading } = useHealthMetrics(params)

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
        Нет данных
      </div>
    )
  }

  const groups = groupMetrics(metrics)

  return (
    <div className="overflow-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            <th className="px-4 py-2 font-medium">Показатель</th>
            <th className="px-4 py-2 font-medium">Значение</th>
            <th className="px-4 py-2 font-medium">Ед.</th>
            <th className="px-4 py-2 font-medium">Норма</th>
            <th className="px-4 py-2 font-medium">Статус</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <>
              {/* Date header row */}
              <tr key={`date-${group.date}`} className="border-b bg-muted/30">
                <td
                  colSpan={5}
                  className="px-4 py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide"
                >
                  {formatDate(group.date)}
                </td>
              </tr>

              {group.categories.map((cat) => (
                <>
                  {/* Category sub-header */}
                  <tr key={`cat-${group.date}-${cat.label}`} className="border-b bg-muted/10">
                    <td colSpan={5} className="px-4 py-1.5 text-xs font-medium text-foreground/60">
                      {cat.label}
                    </td>
                  </tr>

                  {/* Metric rows */}
                  {cat.metrics.map((m) => (
                    <tr
                      key={`${group.date}-${m.metric_name}`}
                      className="border-b transition-colors hover:bg-muted/20"
                    >
                      <td className="px-4 py-2 font-medium">
                        {METRIC_LABELS[m.metric_name] ?? m.metric_name}
                      </td>
                      <td className="px-4 py-2 tabular-nums">{m.value}</td>
                      <td className="px-4 py-2 text-muted-foreground">{m.unit || '--'}</td>
                      <td className="px-4 py-2 text-muted-foreground">
                        {formatReference(m.reference_min, m.reference_max)}
                      </td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(m.status)}`}
                        >
                          {STATUS_LABELS[m.status] ?? m.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </>
              ))}
            </>
          ))}
        </tbody>
      </table>
    </div>
  )
}
