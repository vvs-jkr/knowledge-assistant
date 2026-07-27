import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useTrainingGoals, useUpdateTrainingGoals } from '@/features/chat/api/chat.api'
import type { WorkoutAnalysis } from '@/features/workouts/api/workouts.api'
import { useQueryClient } from '@tanstack/react-query'
import { Target } from 'lucide-react'
import { useEffect, useState } from 'react'

export function TrainingGoals() {
  const { data: goals, isLoading } = useTrainingGoals()
  const updateGoals = useUpdateTrainingGoals()
  const qc = useQueryClient()

  const [text, setText] = useState('')
  const [active, setActive] = useState(true)
  const [seeded, setSeeded] = useState(false)

  useEffect(() => {
    if (goals !== undefined && !seeded) {
      setText(goals.goals)
      setActive(goals.active)
      setSeeded(true)
    }
  }, [goals, seeded])

  const handleToggle = (checked: boolean) => {
    setActive(checked)
    updateGoals.mutate({ active: checked })
  }

  const handleBlur = () => {
    if (goals !== undefined && text !== goals.goals) {
      updateGoals.mutate({ goals: text })
    }
  }

  const handleFillFromAnalysis = () => {
    const analysis = qc.getQueryData<WorkoutAnalysis>(['workouts', 'analysis'])
    if (analysis === undefined) return
    const points = analysis.improvements.join('\n')
    setText((prev) => (prev.trim() === '' ? points : `${prev}\n\n${points}`))
  }

  if (isLoading) return null

  const hasAnalysis = qc.getQueryData(['workouts', 'analysis']) !== undefined

  return (
    <div className="m-2 space-y-2 rounded-xl border bg-card/75 p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-6 w-6 place-items-center rounded-lg bg-accent text-accent-foreground">
            <Target className="h-3.5 w-3.5" />
          </div>
          <Label htmlFor="goals-active" className="text-xs font-medium">
            Цели тренировок
          </Label>
        </div>
        <Switch
          id="goals-active"
          checked={active}
          onCheckedChange={handleToggle}
          disabled={updateGoals.isPending}
        />
      </div>

      <Textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={handleBlur}
        placeholder="Опиши свои цели и слабые стороны..."
        className="min-h-[72px] resize-none rounded-xl border-0 bg-secondary/55 text-xs shadow-none focus-visible:ring-1"
        disabled={!active || updateGoals.isPending}
      />

      {hasAnalysis && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 w-full text-xs"
          onClick={handleFillFromAnalysis}
          disabled={updateGoals.isPending}
        >
          Заполнить из анализа
        </Button>
      )}
    </div>
  )
}
