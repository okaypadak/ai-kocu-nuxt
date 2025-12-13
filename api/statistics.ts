import { supabase } from '../lib/supabase'

export type TimeRange = { from: string; to: string }

export type StudySessionRow = {
    id: string
    user_id: string
    date: string            // YYYY-MM-DD
    duration_minutes: number
    curriculum_id: string | null
    lesson_id: number | null
    lesson_name: string | null
}

export const StatisticsAPI = {
    /** Günlük çalışma verileri (aralığa göre) */
    async fetchStudySessions(userId: string, range: TimeRange) {
        const { data, error } = await supabase
            .from('study_sessions')
            .select('id,user_id,date,duration_minutes,curriculum_id,lesson_id,lesson_name')
            .eq('user_id', userId)
            .gte('date', range.from)
            .lte('date', range.to)
            .order('date', { ascending: true })

        if (error) throw error
        return (data ?? []) as StudySessionRow[]
    },

    /** Ders ilerlemesi (her konu ≥10dk ise tamamlandı) - RPC */
    async fetchLessonProgress(userId: string) {
        const { data, error } = await supabase.rpc('fn_get_lesson_progress', {
            p_user_id: userId
        })
        if (error) throw error
        return data as Array<{
            lesson_name: string
            total_topics: number
            completed_topics: number
            lesson_status: string
        }>
    }
}
