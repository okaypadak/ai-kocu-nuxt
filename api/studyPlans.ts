// src/api/studyPlans.ts
import { supabase } from '../lib/supabase'

export type DayKey = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'

export type StudyTask = {
    id: string
    day: DayKey
    title: string
    notes: string | null
    completed: boolean
    curriculum_id?: string | null
    section_id?: number | null
    lesson_id?: number | null
    topic_uuid: string | null
}

export type StudyPlan = {
    id: string
    user_id: string
    week_start: string
    total_tasks: number
    completed_tasks: number
    completion_rate: number
    sprint_id?: string | null
}

export type DailyRow = { day: DayKey; total: number; completed: number }

export type StudyPlanDTO = {
    plan: StudyPlan | null
    tasks: StudyTask[]
    daily: Record<DayKey, { total: number; completed: number }>
}

class StudyPlanError extends Error { code?: string; constructor(m: string, c?: string){ super(m); this.code = c } }
const withTimeout = <T>(p: PromiseLike<T>, ms=10000) =>
    Promise.race<T>([p, new Promise<T>((_,rej)=>setTimeout(()=>rej(new StudyPlanError('TIMEOUT','TIMEOUT')), ms))])
const normErr = (e:any) => new StudyPlanError(e?.message || e?.error?.message || 'Beklenmeyen hata', e?.code || e?.error?.code)

const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const normalizeUuid = (val: unknown): string | null => {
    if (typeof val !== 'string') return null
    const trimmed = val.trim()
    return UUID_RX.test(trimmed) ? trimmed : null
}

// DB'ye gönderilecek allowed kolonlar — study_plan_tasks şemanızla birebir
const ALLOWED_TASK_COLS = new Set([
    'id','plan_id','day','title','notes','completed',
    'curriculum_id','section_id','lesson_id','topic_uuid','updated_at'
])

const toDbNumber = (v: any): number | null => {
    if (v === null || v === undefined || v === '') return null
    if (typeof v === 'number' && Number.isFinite(v)) return v
    if (typeof v === 'bigint') return Number(v)
    if (typeof v === 'string') {
        const n = Number(v)
        return Number.isFinite(n) ? n : null
    }
    return null
}

const normalizeTask = (row: any): StudyTask => {
    return {
        id: String(row.id),
        day: row.day as DayKey,
        title: String(row.title ?? ''),
        notes: row.notes ?? null,
        completed: !!row.completed,
        curriculum_id: normalizeUuid(row.curriculum_id),
        section_id: toDbNumber(row.section_id),
        lesson_id: toDbNumber(row.lesson_id),
        topic_uuid: row.topic_uuid
            ? String(row.topic_uuid)
            : row.topic_id
                ? String(row.topic_id)
                : null
    }
}

export const StudyPlansAPI = {
    /** plan + tasks + daily istatistiklerini tek seferde getir */
    async getPlan(userId: string, weekStart: string): Promise<StudyPlanDTO> {
        try {
            const planRes = await withTimeout(
                supabase.from('study_plans').select('*').eq('user_id', userId).eq('week_start', weekStart).maybeSingle()
            ) as any
            if (planRes.error) throw planRes.error
            const plan: StudyPlan | null = planRes.data ?? null

            let tasks: StudyTask[] = []
            let dailyRows: DailyRow[] = []
            if (plan) {
                const [tRes, dRes] = await Promise.all([
                    withTimeout(supabase.from('study_plan_tasks').select('*').eq('plan_id', plan.id).order('created_at', { ascending: true })) as any,
                    withTimeout(supabase.from('study_plan_daily_stats').select('*').eq('plan_id', plan.id)) as any
                ])
                if (tRes.error) throw tRes.error
                if (dRes.error) throw dRes.error
                tasks = (tRes.data ?? []).map(normalizeTask)
                dailyRows = (dRes.data ?? []) as any
            }

            const daily: StudyPlanDTO['daily'] = {
                monday:{total:0,completed:0}, tuesday:{total:0,completed:0}, wednesday:{total:0,completed:0},
                thursday:{total:0,completed:0}, friday:{total:0,completed:0}, saturday:{total:0,completed:0},
                sunday:{total:0,completed:0}
            }
            for (const r of dailyRows) {
                const k = r.day as DayKey
                if (daily[k]) daily[k] = { total: Number(r.total||0), completed: Number(r.completed||0) }
            }
            return { plan, tasks, daily }
        } catch (e) { throw normErr(e) }
    },

    /** upsert: plan + tasks + daily (append=true keeps existing, otherwise prunes extras) */
    async upsertPlan(
        userId: string,
        weekStart: string,
        tasks: StudyTask[],
        daily: StudyPlanDTO['daily'],
        opts?: { sprintId?: string | null; append?: boolean }
    ): Promise<string> {
        try {
            const append = !!opts?.append
            void daily // keep signature; daily is recomputed from mergedTasks

            // append modunda mevcut plan/gorevleri dahil et
            let existingTasks: StudyTask[] = []
            if (append) {
                const existingPlanRes = await withTimeout(
                    supabase.from('study_plans').select('id').eq('user_id', userId).eq('week_start', weekStart).maybeSingle()
                ) as any
                if (existingPlanRes?.error) throw existingPlanRes.error
                const existingPlanId = existingPlanRes?.data?.id as string | undefined
                if (existingPlanId) {
                    const exTasksRes = await withTimeout(
                        supabase.from('study_plan_tasks').select('*').eq('plan_id', existingPlanId)
                    ) as any
                    if (exTasksRes?.error) throw exTasksRes.error
                    existingTasks = (exTasksRes?.data ?? []).map(normalizeTask)
                }
            }

            const mergedTasks = (() => {
                if (!append) return tasks
                const map = new Map<string, StudyTask>()
                for (const t of existingTasks) map.set(String(t.id), t)
                for (const t of tasks) map.set(String(t.id), t)
                return [...map.values()]
            })()

            const mergedDaily: StudyPlanDTO['daily'] = {
                monday:{total:0,completed:0}, tuesday:{total:0,completed:0}, wednesday:{total:0,completed:0},
                thursday:{total:0,completed:0}, friday:{total:0,completed:0}, saturday:{total:0,completed:0},
                sunday:{total:0,completed:0}
            }
            for (const t of mergedTasks) {
                const k = t.day as DayKey
                const row = mergedDaily[k]
                if (row) {
                    row.total += 1
                    if (t.completed) row.completed += 1
                }
            }

            const totalTasks = mergedTasks.length
            const completedTasks = mergedTasks.filter(t => t.completed).length
            const completionRate = totalTasks ? (completedTasks / totalTasks) * 100 : 0

            // 1) plan upsert (unique user_id,week_start)
            const planPayload: Record<string, any> = {
                user_id: userId,
                week_start: weekStart,
                total_tasks: totalTasks,
                completed_tasks: completedTasks,
                completion_rate: completionRate
            }
            if (opts && Object.prototype.hasOwnProperty.call(opts, 'sprintId')) {
                planPayload.sprint_id = opts.sprintId ?? null
            }
            const pRes = await withTimeout(
                supabase.from('study_plans')
                    .upsert([planPayload], { onConflict: 'user_id,week_start' })
                    .select('*').single()
            ) as any
            if (pRes.error) {
                throw pRes.error
            }
            const planId = pRes.data.id as string

            // 2) tasks upsert — sadece ALLOWED kolonlar
            const nowIso = new Date().toISOString()
            const rawPayload = mergedTasks.map(t => ({
                id: t.id,
                plan_id: planId,
                day: t.day,
                title: t.title,
                notes: t.notes ?? null,
                completed: !!t.completed,
                curriculum_id: normalizeUuid(t.curriculum_id),
                section_id: toDbNumber(t.section_id),
                lesson_id: toDbNumber(t.lesson_id),
                topic_uuid: t.topic_uuid ?? null,
                updated_at: nowIso,
            }))

            // Savunma: sadece izinli kolonlar
            const sanitized = rawPayload.map(row => Object.fromEntries(
                Object.entries(row).filter(([k,_]) => ALLOWED_TASK_COLS.has(k))
            ))

            if (sanitized.length) {
                const tRes = await withTimeout(
                    supabase.from('study_plan_tasks').upsert(sanitized, { onConflict: 'id' })
                ) as any
                if (tRes.error) {
                    throw tRes.error
                }
            }

            // 3) gereksiz task'leri sil (append=false iken)
            if (!append) {
                const keepIds = sanitized.map(p => (p as any).id as string)
                if (keepIds.length) {
                    const idsCsv = keepIds.map(i => `"${i}"`).join(',')
                    const delRes = await withTimeout(
                        supabase.from('study_plan_tasks')
                            .delete()
                            .eq('plan_id', planId)
                            .not('id', 'in', `(${idsCsv})`)
                    ) as any
                    if (delRes.error) {
                        throw delRes.error
                    }
                } else {
                    const delAll = await withTimeout(
                        supabase.from('study_plan_tasks').delete().eq('plan_id', planId)
                    ) as any
                    if (delAll.error) {
                        throw delAll.error
                    }
                }
            }

            // 4) daily upsert
            const dailyRows = Object.entries(mergedDaily).map(([day, v]) => ({ plan_id: planId, day, total: v.total, completed: v.completed }))
            if (dailyRows.length) {
                const dRes = await withTimeout(
                    supabase.from('study_plan_daily_stats').upsert(dailyRows as any, { onConflict: 'plan_id,day' })
                ) as any
                if (dRes.error) {
                    throw dRes.error
                }
            }

            return planId
        } catch (e:any) {
            throw normErr(e)
        }
    },

    /** seçili haftanın konu süreleri — saniye cinsinden */
    async topicDurationsForWeek(userId: string, weekStart: string): Promise<Record<string, number>> {
        try {
            const start = new Date(weekStart)
            const end = new Date(start); end.setDate(start.getDate() + 6)
            const to = end.toISOString().slice(0,10)

            const res = await withTimeout(
                supabase.from('study_sessions')
                    .select('topic_uuid, duration_minutes')
                    .eq('user_id', userId)
                    .gte('date', weekStart)
                    .lte('date', to)
                    .not('topic_uuid', 'is', null)
            ) as any
            if (res.error) throw res.error

            const map: Record<string, number> = {}
            for (const row of (res.data ?? [])) {
                const k = row.topic_uuid
                    ? String(row.topic_uuid)
                    : row.topic_id
                        ? String(row.topic_id)
                        : ''
                if (!k) continue
                const sec = Number(row.duration_minutes ?? 0) * 60
                map[k] = (map[k] ?? 0) + sec
            }
            return map
        } catch (e) { throw normErr(e) }
    }
}
