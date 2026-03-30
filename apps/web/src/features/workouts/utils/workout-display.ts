import type { WorkoutType } from '@/shared/schemas/workouts.schema'

export const WORKOUT_TYPE_LABELS: Record<WorkoutType, string> = {
  for_time: 'For Time',
  amrap: 'AMRAP',
  emom: 'EMOM',
  tabata: 'Tabata',
  lifting: 'Lifting',
  rounds: 'Rounds',
  wod: 'WOD',
  other: 'Other',
}

export const WORKOUT_TYPE_BADGE_COLORS: Record<WorkoutType, string> = {
  for_time: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
  amrap: 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300',
  emom: 'bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300',
  tabata: 'bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300',
  lifting: 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300',
  rounds: 'bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300',
  wod: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-300',
  other: 'bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400',
}

export const WORKOUT_TYPE_BORDER_COLORS: Record<WorkoutType, string> = {
  for_time: 'border-l-blue-500',
  amrap: 'border-l-green-500',
  emom: 'border-l-purple-500',
  tabata: 'border-l-orange-500',
  lifting: 'border-l-red-500',
  rounds: 'border-l-cyan-500',
  wod: 'border-l-yellow-500',
  other: 'border-l-zinc-400',
}

/** Converts "CHARGE", "charge", "POWER" -> "Charge", "Power" */
export function normalizeWorkoutName(name: string): string {
  if (name === name.toUpperCase() && name.length > 1) {
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase()
  }
  return name
}
