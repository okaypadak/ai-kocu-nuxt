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
    topicId: string
}

export interface StudyPlanResponse {
    id?: string
    weekStart: string
    tasks: StudyTask[]
    stats: StudyPlanStats
}
