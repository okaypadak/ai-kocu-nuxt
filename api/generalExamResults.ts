// src/api/generalExamResults.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { computeNet } from './examResults'

export type GeneralExamDetailRow = {
    code: string
    name: string
    correct_count: number
    wrong_count: number
    net_score: number
    score?: number | null
}

export type GeneralExamDetail = {
    type?: string | null
    question_count?: number | null
    score?: number | null
    rows?: GeneralExamDetailRow[]
    totals?: {
        correct_count: number
        wrong_count: number
        net_score: number
        score?: number | null
    }
}

export type GeneralExamResult = {
    id: string
    user_id: string
    curriculum_id: string
    name: string
    planned_duration_minutes: number
    duration_minutes: number
    started_at: string
    finished_at: string
    created_at: string
    detail: GeneralExamDetail | null
}

export type GeneralExamResultCreate = {
    curriculum_id: string
    name: string
    planned_duration_minutes: number
    duration_minutes: number
    started_at: string
    finished_at: string
    detail: GeneralExamDetail | null
}

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
            setTimeout(() => rej(new ApiError('Zaman asimi', 'TIMEOUT')), ms)
        ),
    ])

const toNonNegativeInt = (value: unknown): number => {
    const numeric = Number(value)
    if (!Number.isFinite(numeric)) return 0
    return Math.max(0, Math.round(numeric))
}

function must(v: any, name: string) {
    const ok = v !== undefined && v !== null && String(v).trim() !== ''
    if (!ok) throw new ApiError(`${name} zorunludur.`)
}

const normalizeRow = (
    row: any,
    fallbackName: string
): GeneralExamDetailRow | null => {
    if (!row) return null

    const codeRaw = String(row.code ?? '').trim()
    const nameRaw =
        String(row.name ?? row.lesson_name ?? '').trim() || fallbackName
    const correct = toNonNegativeInt(row.correct_count)
    const wrong = toNonNegativeInt(row.wrong_count)
    const netScore =
        typeof row.net_score === 'number' && Number.isFinite(row.net_score)
            ? Number(row.net_score.toFixed(2))
            : computeNet(correct, wrong)


    return {
        code: codeRaw || 'genel_sinav',
        name: nameRaw || 'Genel Sinav',
        correct_count: correct,
        wrong_count: wrong,
        net_score: netScore,
    }
}

const normalizeDetail = (
    detail: any,
    fallbackName: string
): GeneralExamDetail | null => {
    if (!detail) return null

    const rows = Array.isArray(detail.rows)
        ? (detail.rows
              .map((r: any) => normalizeRow(r, fallbackName))
              .filter(Boolean) as GeneralExamDetailRow[])
        : []

    const questionCount = toNonNegativeInt(detail.question_count)
    const score =
        typeof detail.score === 'number' && Number.isFinite(detail.score)
            ? detail.score
            : null

    return {
        type: detail.type || 'genel_sinav',
        question_count: questionCount,
        score,
        rows,
    }
}

export const GeneralExamResultsAPI = {
    async listByDateRange(
        client: SupabaseClient,
        userId: string,
        startISO: string,
        endISO: string,
        curriculumId?: string | null
    ): Promise<GeneralExamResult[]> {
        try {
            let q = client
                .from('exam_result_general')
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
            return (data ?? []).map((row: any) => ({
                ...row,
                detail: normalizeDetail(row?.detail, row?.name),
            })) as GeneralExamResult[]
        } catch (e: any) {
            throw toErr(e)
        }
    },

    async create(
        client: SupabaseClient,
        userId: string,
        p: GeneralExamResultCreate
    ): Promise<GeneralExamResult> {
        try {
            must(userId, 'user_id')
            must(p.curriculum_id, 'curriculum_id')
            must(p.name, 'name')
            must(p.planned_duration_minutes, 'planned_duration_minutes')
            must(p.duration_minutes, 'duration_minutes')

            const safeName = String(p.name).trim()
            const row = {
                user_id: userId,
                curriculum_id: p.curriculum_id,
                name: safeName,
                planned_duration_minutes: toNonNegativeInt(
                    p.planned_duration_minutes
                ),
                duration_minutes: toNonNegativeInt(p.duration_minutes),
                started_at: p.started_at,
                finished_at: p.finished_at,
                detail: normalizeDetail(p.detail, safeName),
            }

            const { data, error } = await timeout(
                client
                    .from('exam_result_general')
                    .insert(row)
                    .select('*')
                    .single()
            )
            if (error) throw error

            return {
                ...(data as any),
                detail: normalizeDetail((data as any)?.detail, safeName),
            } as GeneralExamResult
        } catch (e: any) {
            throw toErr(e)
        }
    },
}
