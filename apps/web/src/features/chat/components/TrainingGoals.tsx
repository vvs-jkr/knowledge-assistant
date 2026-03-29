import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { useTrainingGoals, useUpdateTrainingGoals } from '@/features/chat/api/chat.api'
import type { WorkoutAnalysis } from '@/features/workouts/api/workouts.api'
import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'

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
    <div className="space-y-2 border-t px-3 py-3">
      <div className="flex items-center justify-between">
        <Label htmlFor="goals-active" className="text-xs font-medium">
          Цели тренировок
        </Label>
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
        className="min-h-[72px] resize-none text-xs"
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
