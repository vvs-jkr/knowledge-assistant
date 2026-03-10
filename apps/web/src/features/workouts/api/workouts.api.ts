import { api } from '@/shared/lib/api'
import type {
  CreateWorkoutLog,
  ExerciseInfo,
  WorkoutDetail,
  WorkoutLog,
  WorkoutStats,
  WorkoutSummary,
  WorkoutType,
} from '@/shared/schemas/workouts.schema'
import {
  exerciseInfoSchema,
  workoutDetailSchema,
  workoutLogSchema,
  workoutStatsSchema,
  workoutSummarySchema,
} from '@/shared/schemas/workouts.schema'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'

type WorkoutsQuery = Partial<
  Pick<WorkoutSummary, 'workout_type'> & {
    from: string
    to: string
    exercise_id: string
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

  createLog: (body: CreateWorkoutLog): Promise<WorkoutLog> =>
    api.post<WorkoutLog>('/workouts/logs', body).then((r) => {
      return workoutLogSchema.parse(r.data)
    }),

  logs: (params?: LogsQuery): Promise<WorkoutLog[]> =>
    api.get<WorkoutLog[]>('/workouts/logs', { params }).then((r) => {
      return workoutLogSchema.array().parse(r.data)
    }),
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

export { workoutsApi }
export type { WorkoutsQuery, WorkoutType }
