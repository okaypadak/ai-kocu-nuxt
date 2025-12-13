import { supabase } from '../lib/supabase'

/** ==== Types (DB ile birebir) ==== */
export type ExamResult = {
    id: string
    user_id: string
    curriculum_id: string
    topic_uuid: string
    topic_title: string | null
    section_id: number | null
    section_name: string | null
    lesson_id: number | null
    lesson_name: string | null
    question_count: number | null
    correct_count: number | null
    wrong_count: number | null
    net_score: number | null
    planned_duration_minutes: number | null
    duration_minutes: number | null
    started_at: string | null
    finished_at: string | null
    created_at: string
}

export type ExamResultCreate = {
    curriculum_id: string

    topic_uuid: string
    topic_title?: string | null
    section_id?: number | null
    section_name?: string | null
    lesson_id?: number | null
    lesson_name?: string | null

    planned_duration_minutes: number
    duration_minutes: number

    question_count: number
    correct_count: number
    wrong_count: number

    started_at: string
    finished_at: string
}

/** ==== Helpers ==== */
class ApiError extends Error {
    code?: string
    constructor(m: string, c?: string) {
        super(m)
        this.code = c
    }
}
const toErr = (e: any) =>
    new ApiError(
        e?.message || e?.error?.message || 'Beklenmeyen hata',
        e?.code || e?.error?.code
    )

const timeout = <T,>(p: PromiseLike<T>, ms = 10_000) =>
    Promise.race<T>([
        p,
        new Promise<T>((_, rej) =>
            setTimeout(
                () => rej(new ApiError('İstek zaman aşımı', 'TIMEOUT')),
                ms
            )
        ),
    ])

export function computeNet(correct: number, wrong: number) {
    return Number(
        ((Number(correct) || 0) - (Number(wrong) || 0) / 4).toFixed(2)
    )
}

const toNullableNumber = (value: unknown): number | null => {
    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : null
    }
    if (typeof value === 'string' && value.trim() !== '') {
        const numeric = Number(value)
        return Number.isFinite(numeric) ? numeric : null
    }
    return null
}

const toNonNegativeInt = (value: unknown): number => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Math.max(0, Math.round(numeric))
}

function must(v: any, name: string) {
    const ok = v !== undefined && v !== null && String(v).trim() !== ''
    if (!ok) throw new ApiError(`${name} zorunludur.`)
}

/** ==== API ==== */
export const ExamResultsAPI = {
    /** Son N kayıt (kullanıcı + konu) */
    async listRecentByTopic(
        userId: string,
        topicId: string,
        take = 20
    ): Promise<ExamResult[]> {
        try {
            const { data, error } = await timeout(
                supabase
                    .from('exam_results_topic')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('topic_uuid', topicId)
                    .order('created_at', { ascending: false })
                    .limit(take)
            )
            if (error) throw error
            return (data ?? []) as ExamResult[]
        } catch (e: any) {
            throw toErr(e)
        }
    },

    /**
     * Haftalık gösterim için: verilen tarih aralığındaki kayıtlar.
     * startISO dahil, endISO hariç.
     * curriculumId varsa ona da filtre uygularız.
     */
    async listByDateRange(
        userId: string,
        startISO: string,
        endISO: string,
        curriculumId?: string | null
    ): Promise<ExamResult[]> {
        try {
            let q = supabase
                .from('exam_results_topic')
                .select('*')
                .eq('user_id', userId)
                .gte('finished_at', startISO)
                .lt('finished_at', endISO)
                .order('finished_at', { ascending: true })

            if (curriculumId) {
                q = q.eq('curriculum_id', curriculumId)
            }

            const { data, error } = await timeout(q)
            if (error) throw error
            return (data ?? []) as ExamResult[]
        } catch (e: any) {
            throw toErr(e)
        }
    },

    /** Insert (RLS ile user_id doğrulanır) */
    async create(
        userId: string,
        p: ExamResultCreate
    ): Promise<ExamResult> {
        try {
            must(userId, 'user_id')
            must(p.curriculum_id, 'curriculum_id')
            must(p.topic_uuid, 'topic_uuid')
            must(p.planned_duration_minutes, 'planned_duration_minutes')
            must(p.duration_minutes, 'duration_minutes')
            must(p.question_count, 'question_count')

            const net = computeNet(
                p.correct_count ?? 0,
                p.wrong_count ?? 0
            )

            const row = {
                user_id: userId,
                curriculum_id: p.curriculum_id,
                topic_uuid: String(p.topic_uuid).trim(),
                topic_title: p.topic_title ?? null,
                section_id: toNullableNumber(p.section_id),
                section_name: p.section_name ?? null,
                lesson_id: toNullableNumber(p.lesson_id),
                lesson_name: p.lesson_name ?? null,
                planned_duration_minutes: toNonNegativeInt(
                    p.planned_duration_minutes
                ),
                duration_minutes: toNonNegativeInt(p.duration_minutes),
                question_count: toNonNegativeInt(p.question_count),
                correct_count: toNonNegativeInt(p.correct_count),
                wrong_count: toNonNegativeInt(p.wrong_count),
                net_score: net,
                started_at: p.started_at,
                finished_at: p.finished_at,
            }

            const { data, error } = await timeout(
                supabase
                    .from('exam_results_topic')
                    .insert(row)
                    .select('*')
                    .single()
            )
            if (error) throw error
            return data as ExamResult
        } catch (e: any) {
            throw toErr(e)
        }
    },
}
