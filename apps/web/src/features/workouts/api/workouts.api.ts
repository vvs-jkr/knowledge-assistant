import { api } from '@/shared/lib/api'
import type {
  CreateWorkoutLog,
  ExerciseInfo,
  WorkoutAnalysis,
  WorkoutDetail,
  WorkoutLog,
  WorkoutPlanDetail,
  WorkoutPlanSummary,
  WorkoutStats,
  WorkoutSummary,
  WorkoutType,
} from '@/shared/schemas/workouts.schema'
import {
  exerciseInfoSchema,
  workoutAnalysisSchema,
  workoutDetailSchema,
  workoutLogSchema,
  workoutPlanDetailSchema,
  workoutPlanSummarySchema,
  workoutStatsSchema,
  workoutSummarySchema,
} from '@/shared/schemas/workouts.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type ExerciseInput = {
  exercise_id?: string
  name?: string
  muscle_groups?: string[]
  reps?: number
  sets?: number
  weight_kg?: number
  weight_note?: string
  duration_secs?: number
  order_index?: number
  notes?: string
}

type UpdateExerciseInput = {
  exercise_id?: string
  name?: string
  reps?: number
  sets?: number
  weight_kg?: number
  weight_note?: string
  duration_secs?: number
  order_index?: number
}

type UpdateWorkoutInput = {
  date?: string
  name?: string
  workout_type?: string
  duration_mins?: number | null
  rounds?: number | null
  exercises?: UpdateExerciseInput[]
}

type CreateWorkoutInput = {
  date: string
  name: string
  workout_type?: string
  duration_mins?: number
  rounds?: number
  source_type?: string
  source_file?: string
  raw_text?: string
  year_confidence?: number
  plan_id?: string
  exercises?: ExerciseInput[]
}

type CreatePlanInput = {
  name: string
  description?: string
}

type UpdatePlanInput = {
  name?: string
  description?: string
}

type WorkoutsQuery = Partial<
  Pick<WorkoutSummary, 'workout_type'> & {
    from: string
    to: string
    exercise_id: string
    plan_id: string
    limit: number
    offset: number
  }
>

type StatsQuery = {
  from?: string
  to?: string
  exercise_id?: string
}

type LogsQuery = {
  workout_id?: string
  from?: string
  to?: string
  limit?: number
  offset?: number
}

const workoutsApi = {
  list: (params?: WorkoutsQuery): Promise<WorkoutSummary[]> =>
    api.get<WorkoutSummary[]>('/workouts', { params }).then((r) => {
      return workoutSummarySchema.array().parse(r.data)
    }),

  get: (id: string): Promise<WorkoutDetail> =>
    api.get<WorkoutDetail>(`/workouts/${id}`).then((r) => {
      return workoutDetailSchema.parse(r.data)
    }),

  stats: (params?: StatsQuery): Promise<WorkoutStats> =>
    api.get<WorkoutStats>('/workouts/stats', { params }).then((r) => {
      return workoutStatsSchema.parse(r.data)
    }),

  exercises: (search?: string): Promise<ExerciseInfo[]> =>
    api
      .get<ExerciseInfo[]>('/workouts/exercises', { params: search ? { search } : undefined })
      .then((r) => {
        return exerciseInfoSchema.array().parse(r.data)
      }),

  create: (body: CreateWorkoutInput): Promise<WorkoutSummary> =>
    api.post<WorkoutSummary>('/workouts', body).then((r) => {
      return workoutSummarySchema.parse(r.data)
    }),

  delete: (id: string): Promise<void> =>
    api.delete(`/workouts/${id}`).then(() => undefined),

  createLog: (body: CreateWorkoutLog): Promise<WorkoutLog> =>
    api.post<WorkoutLog>('/workouts/logs', body).then((r) => {
      return workoutLogSchema.parse(r.data)
    }),

  logs: (params?: LogsQuery): Promise<WorkoutLog[]> =>
    api.get<WorkoutLog[]>('/workouts/logs', { params }).then((r) => {
      return workoutLogSchema.array().parse(r.data)
    }),

  update: (id: string, body: UpdateWorkoutInput): Promise<WorkoutDetail> =>
    api.put<WorkoutDetail>(`/workouts/${id}`, body).then((r) => workoutDetailSchema.parse(r.data)),

  analyze: (): Promise<WorkoutAnalysis> =>
    api.post<WorkoutAnalysis>('/workouts/analyze').then((r) => {
      return workoutAnalysisSchema.parse(r.data)
    }),

  plans: {
    list: (): Promise<WorkoutPlanSummary[]> =>
      api.get<WorkoutPlanSummary[]>('/workouts/plans').then((r) =>
        workoutPlanSummarySchema.array().parse(r.data),
      ),

    get: (id: string): Promise<WorkoutPlanDetail> =>
      api
        .get<WorkoutPlanDetail>(`/workouts/plans/${id}`)
        .then((r) => workoutPlanDetailSchema.parse(r.data)),

    create: (body: CreatePlanInput): Promise<WorkoutPlanSummary> =>
      api
        .post<WorkoutPlanSummary>('/workouts/plans', body)
        .then((r) => workoutPlanSummarySchema.parse(r.data)),

    update: (id: string, body: UpdatePlanInput): Promise<WorkoutPlanSummary> =>
      api
        .put<WorkoutPlanSummary>(`/workouts/plans/${id}`, body)
        .then((r) => workoutPlanSummarySchema.parse(r.data)),

    delete: (id: string): Promise<void> =>
      api.delete(`/workouts/plans/${id}`).then(() => undefined),
  },
}

export function useWorkouts(params?: WorkoutsQuery) {
  return useQuery({
    queryKey: ['workouts', 'list', params],
    queryFn: () => workoutsApi.list(params),
    staleTime: 30_000,
  })
}

export function useWorkout(id: string) {
  return useQuery({
    queryKey: ['workouts', 'detail', id],
    queryFn: () => workoutsApi.get(id),
    staleTime: 30_000,
  })
}

export function useWorkoutStats(params?: StatsQuery) {
  return useQuery({
    queryKey: ['workouts', 'stats', params],
    queryFn: () => workoutsApi.stats(params),
    staleTime: 60_000,
  })
}

export function useExercises(search?: string) {
  return useQuery({
    queryKey: ['workouts', 'exercises', search],
    queryFn: () => workoutsApi.exercises(search),
    staleTime: 60_000,
  })
}

export function useWorkoutLogs(params?: LogsQuery) {
  return useQuery({
    queryKey: ['workouts', 'logs', params],
    queryFn: () => workoutsApi.logs(params),
    staleTime: 30_000,
  })
}

export function useCreateWorkoutLog() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: workoutsApi.createLog,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts', 'logs'] })
      qc.invalidateQueries({ queryKey: ['workouts', 'stats'] })
    },
  })
}

export function useUpdateWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdateWorkoutInput) =>
      workoutsApi.update(id, body),
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: ['workouts', 'list'] })
      qc.setQueryData(['workouts', 'detail', updated.id], updated)
    },
  })
}

export function useDeleteWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workoutsApi.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts', 'list'] })
      qc.invalidateQueries({ queryKey: ['workouts', 'plans'] })
      qc.invalidateQueries({ queryKey: ['workouts', 'stats'] })
    },
  })
}

export function useAnalyzeWorkouts() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: workoutsApi.analyze,
    onSuccess: (data) => {
      qc.setQueryData<WorkoutAnalysis>(['workouts', 'analysis'], data)
    },
  })
}

export function useCreateWorkout() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateWorkoutInput) => workoutsApi.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts', 'list'] })
      qc.invalidateQueries({ queryKey: ['workouts', 'plans'] })
    },
  })
}

export function usePlans() {
  return useQuery({
    queryKey: ['workouts', 'plans'],
    queryFn: () => workoutsApi.plans.list(),
    staleTime: 30_000,
  })
}

export function usePlan(id: string | null) {
  return useQuery({
    queryKey: ['workouts', 'plans', id],
    queryFn: () => workoutsApi.plans.get(id as string),
    enabled: id !== null,
    staleTime: 30_000,
  })
}

export function useCreatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreatePlanInput) => workoutsApi.plans.create(body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts', 'plans'] })
    },
  })
}

export function useUpdatePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string } & UpdatePlanInput) =>
      workoutsApi.plans.update(id, body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts', 'plans'] })
    },
  })
}

export function useDeletePlan() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => workoutsApi.plans.delete(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['workouts', 'plans'] })
    },
  })
}

export { workoutsApi }
export type { CreateWorkoutInput, WorkoutsQuery, WorkoutType, WorkoutAnalysis }
