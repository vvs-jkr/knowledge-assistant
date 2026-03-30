import { z } from 'zod'

// workout_type values must match backend VALID_WORKOUT_TYPES
export const workoutTypeSchema = z.enum([
  'for_time',
  'amrap',
  'emom',
  'tabata',
  'lifting',
  'rounds',
  'other',
])

// source_type values must match backend VALID_SOURCE_TYPES
export const sourceTypeSchema = z.enum(['manual', 'digitized', 'generated'])

export const workoutSummarySchema = z.object({
  id: z.string(),
  date: z.string(),
  name: z.string(),
  workout_type: workoutTypeSchema,
  duration_mins: z.number().nullable(),
  rounds: z.number().nullable(),
  exercise_count: z.number(),
  source_type: sourceTypeSchema,
  plan_id: z.string().nullable(),
  created_at: z.string(),
})

export const workoutExerciseSchema = z.object({
  id: z.string(),
  exercise_id: z.string(),
  exercise_name: z.string(),
  muscle_groups: z.array(z.string()),
  reps: z.number().nullable(),
  sets: z.number().nullable(),
  weight_kg: z.number().nullable(),
  weight_note: z.string().nullable(),
  duration_secs: z.number().nullable(),
  order_index: z.number(),
  notes: z.string().nullable(),
})

export const workoutDetailSchema = workoutSummarySchema.omit({ exercise_count: true }).extend({
  exercises: z.array(workoutExerciseSchema),
  raw_text: z.string().nullable(),
  source_file: z.string().nullable(),
  year_confidence: z.number().nullable(),
  updated_at: z.string(),
})

export const workoutPlanSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  description: z.string(),
  workout_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const workoutPlanDetailSchema = workoutPlanSummarySchema
  .omit({ workout_count: true })
  .extend({
    workouts: z.array(workoutSummarySchema),
  })

export const exerciseInfoSchema = z.object({
  id: z.string(),
  name: z.string(),
  muscle_groups: z.array(z.string()),
})

export const workoutLogSchema = z.object({
  id: z.string(),
  workout_id: z.string(),
  workout_name: z.string(),
  completed_at: z.string(),
  duration_secs: z.number().nullable(),
  rounds_completed: z.number().nullable(),
  notes: z.string().nullable(),
  created_at: z.string(),
})

export const heatmapEntrySchema = z.object({
  date: z.string(),
  count: z.number(),
})

export const weeklyVolumeEntrySchema = z.object({
  week_start: z.string(),
  total_volume: z.number(),
  workout_count: z.number(),
})

export const typeDistEntrySchema = z.object({
  workout_type: workoutTypeSchema,
  count: z.number(),
})

export const exerciseProgressEntrySchema = z.object({
  date: z.string(),
  max_weight_kg: z.number().nullable(),
  total_sets: z.number().nullable(),
  total_reps: z.number().nullable(),
})

export const workoutStatsSchema = z.object({
  heatmap: z.array(heatmapEntrySchema),
  weekly_volume: z.array(weeklyVolumeEntrySchema),
  type_distribution: z.array(typeDistEntrySchema),
  exercise_progress: z.array(exerciseProgressEntrySchema),
  total_workouts: z.number(),
  total_logs: z.number(),
  current_streak_days: z.number(),
})

export const createWorkoutLogSchema = z.object({
  workout_id: z.string(),
  completed_at: z.string(),
  duration_secs: z.number().optional(),
  rounds_completed: z.number().optional(),
  notes: z.string().optional(),
})

export const workoutAnalysisSchema = z.object({
  summary: z.string(),
  patterns: z.array(z.string()),
  muscle_balance: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.string()),
  suggested_focus: z.string(),
})

export type WorkoutAnalysis = z.infer<typeof workoutAnalysisSchema>
export type WorkoutType = z.infer<typeof workoutTypeSchema>
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>
export type WorkoutDetail = z.infer<typeof workoutDetailSchema>
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>
export type ExerciseInfo = z.infer<typeof exerciseInfoSchema>
export type WorkoutLog = z.infer<typeof workoutLogSchema>
export type HeatmapEntry = z.infer<typeof heatmapEntrySchema>
export type WeeklyVolumeEntry = z.infer<typeof weeklyVolumeEntrySchema>
export type TypeDistEntry = z.infer<typeof typeDistEntrySchema>
export type ExerciseProgressEntry = z.infer<typeof exerciseProgressEntrySchema>
export type WorkoutStats = z.infer<typeof workoutStatsSchema>
export type CreateWorkoutLog = z.infer<typeof createWorkoutLogSchema>
export type WorkoutPlanSummary = z.infer<typeof workoutPlanSummarySchema>
export type WorkoutPlanDetail = z.infer<typeof workoutPlanDetailSchema>
