// src/types/studyPlans.ts
export type DayKey =
    | 'monday' | 'tuesday' | 'wednesday' | 'thursday'
    | 'friday' | 'saturday' | 'sunday'

export interface DailyStat { total: number; completed: number }
export interface StudyPlanStats {
    totalTasks: number
    completedTasks: number
    completionRate: number
    daily: Record<DayKey, DailyStat>
}

export interface StudyTask {
    id: string
    day: DayKey
    title: string
    notes?: string | null
    completed: boolean

    curriculumId?: string | null
    sectionId?: number | string | null
    lessonId?: number | string | null
    topicId: string // zorunlu
}

export interface StudyPlanResponse {
    id?: string // Postgres UUID
    weekStart: string // YYYY-MM-DD
    tasks: StudyTask[]
    stats: StudyPlanStats
}
