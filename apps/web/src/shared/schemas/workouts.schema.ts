import { z } from 'zod'

// workout_type values must match backend VALID_WORKOUT_TYPES
export const workoutTypeSchema = z.enum([
  'for_time',
  'amrap',
  'emom',
  'tabata',
  'lifting',
  'rounds',
  'wod',
  'other',
])

// source_type values must match backend VALID_SOURCE_TYPES
export const sourceTypeSchema = z.enum(['manual', 'digitized', 'generated'])
export const archiveReviewStatusSchema = z.enum(['raw', 'needs_review', 'reviewed', 'corrected'])

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

export const workoutSectionItemSchema = z.object({
  id: z.string(),
  exercise_id: z.string().nullable(),
  display_name: z.string(),
  sets: z.number().nullable(),
  reps: z.number().nullable(),
  weight_kg: z.number().nullable(),
  weight_note: z.string().nullable(),
  duration_secs: z.number().nullable(),
  prescription_text: z.string(),
  notes: z.string(),
  order_index: z.number(),
})

export const workoutSectionSchema = z.object({
  id: z.string(),
  section_key: z.string(),
  section_role: z.string(),
  title: z.string(),
  description: z.string(),
  notes: z.string(),
  order_index: z.number(),
  items: z.array(workoutSectionItemSchema),
})

export const workoutDetailSchema = workoutSummarySchema.omit({ exercise_count: true }).extend({
  sections: z.array(workoutSectionSchema),
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

export const archivedWorkoutSummarySchema = z.object({
  id: z.string(),
  archive_date: z.string(),
  title: z.string(),
  source_system: z.string(),
  source_type: z.string(),
  review_status: archiveReviewStatusSchema,
  quality_score: z.number().nullable(),
  section_count: z.number(),
  image_count: z.number(),
  created_at: z.string(),
  updated_at: z.string(),
})

export const archivedWorkoutSectionSchema = z.object({
  id: z.string(),
  section_type_raw: z.string().nullable(),
  section_type_normalized: z.string().nullable(),
  title: z.string().nullable(),
  content_raw: z.string(),
  content_corrected: z.string(),
  order_index: z.number(),
})

export const archivedWorkoutImageSchema = z.object({
  id: z.string(),
  file_path: z.string(),
  sort_order: z.number(),
})

export const archivedWorkoutDetailSchema = archivedWorkoutSummarySchema
  .omit({ section_count: true, image_count: true })
  .extend({
    source_file: z.string().nullable(),
    raw_ocr_text: z.string(),
    corrected_text: z.string(),
    exclude_from_stats: z.boolean(),
    sections: z.array(archivedWorkoutSectionSchema),
    images: z.array(archivedWorkoutImageSchema),
  })

export type WorkoutAnalysis = z.infer<typeof workoutAnalysisSchema>
export type ArchiveReviewStatus = z.infer<typeof archiveReviewStatusSchema>
export type WorkoutType = z.infer<typeof workoutTypeSchema>
export type WorkoutSummary = z.infer<typeof workoutSummarySchema>
export type WorkoutDetail = z.infer<typeof workoutDetailSchema>
export type WorkoutExercise = z.infer<typeof workoutExerciseSchema>
export type WorkoutSection = z.infer<typeof workoutSectionSchema>
export type WorkoutSectionItem = z.infer<typeof workoutSectionItemSchema>
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
export type ArchivedWorkoutSummary = z.infer<typeof archivedWorkoutSummarySchema>
export type ArchivedWorkoutDetail = z.infer<typeof archivedWorkoutDetailSchema>
export type ArchivedWorkoutSection = z.infer<typeof archivedWorkoutSectionSchema>
export type ArchivedWorkoutImage = z.infer<typeof archivedWorkoutImageSchema>
