import { ref, computed, unref, type Ref, type ComputedRef } from 'vue'
import { supabase } from '../lib/supabase'
import { StatisticsAPI } from '../api/statistics'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))
const UUID_RX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const normalizeUuid = (val: any): string | null =>
    typeof val === 'string' && UUID_RX.test(val) ? val : null

/* ---------- yardımcılar ---------- */
const formatDate = (date: Date) => {
    const y = date.getFullYear()
    const m = String(date.getMonth() + 1).padStart(2, '0')
    const d = String(date.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
}

/** 🔹 Günlük trend + Streak */
export function useDailyStudy(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)

    type DayPoint = { date: string; totalminutes: number; totalMinutes?: number }
    const byDay = ref<DayPoint[]>([])
    const pending = ref(false)
    const error = ref<string>('')

    // streak state
    const thresholdMinutes = 60
    const streak = ref<{ current: number; best: number; todayMet: boolean; threshold: number }>({
        current: 0,
        best: 0,
        todayMet: false,
        threshold: thresholdMinutes
    })

    function calcStreak(series: DayPoint[]) {
        // seri tarih sıralı (ASC) varsayımıyla çalışır
        let best = 0
        let run = 0
        const th = thresholdMinutes

        for (const p of series) {
            const ok = (p.totalminutes ?? p.totalMinutes ?? 0) >= th
            run = ok ? run + 1 : 0
            if (run > best) best = run
        }

        // current: sondan geriye doğru
        let current = 0
        for (let i = series.length - 1; i >= 0; i--) {
            const point = series[i]
            if (!point) break
            const ok = (point.totalminutes ?? point.totalMinutes ?? 0) >= th
            if (!ok) break
            current++
        }

        // todayMet: son gün eşik üstü mü
        const last = series[series.length - 1]
        const todayMet = !!last && ((last.totalminutes ?? last.totalMinutes ?? 0) >= th)

        streak.value = { current, best, todayMet, threshold: th }
    }

    async function compute(days = 7) {
        if (!uid.value) return
        pending.value = true
        try {
            // Streak için min 60 gün veriyi al (trend gösterimi için yine keseriz)
            const normalizedDays = Number.isFinite(days) && days > 0 ? Math.floor(days) : 7
            const wantDays = Math.max(60, normalizedDays)

            const today = new Date()
            const startDate = new Date(today)
            startDate.setDate(today.getDate() - (wantDays - 1))

            const range = { from: formatDate(startDate), to: formatDate(today) }

            const sessions = await StatisticsAPI.fetchStudySessions(uid.value, range)

            // gün -> toplam dakika
            const totals = new Map<string, number>()
            for (const s of sessions) {
                const key = s.date
                totals.set(key, (totals.get(key) ?? 0) + (s.duration_minutes ?? 0))
            }

            // boş günleri de içeren seri
            const result: DayPoint[] = []
            const cursor = new Date(startDate)
            while (cursor <= today) {
                const key = formatDate(cursor)
                result.push({ date: key, totalminutes: totals.get(key) ?? 0 })
                cursor.setDate(cursor.getDate() + 1)
            }

            byDay.value = result
            calcStreak(result)
            error.value = ''
        } catch (e: any) {
            error.value = e.message ?? 'Hata'
            byDay.value = []
            streak.value = { current: 0, best: 0, todayMet: false, threshold: thresholdMinutes }
        } finally {
            pending.value = false
        }
    }

    return { byDay, pending, error, compute, streak }
}

/** 🔹 Ders ilerlemesi (RPC) */
export function useLessonProgress(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    const lessons = ref<
        Array<{
            lesson_name: string
            total_topics: number
            completed_topics: number
            lesson_status: string
        }>
    >([])
    const pending = ref(false)
    const error = ref<string>('')

    async function compute() {
        if (!uid.value) return
        pending.value = true
        try {
            const { data, error: err } = await supabase.rpc('fn_get_lesson_progress', {
                p_user_id: uid.value
            })
            if (err) throw err
            lessons.value = data ?? []
        } catch (e: any) {
            error.value = e.message ?? 'Hata'
            lessons.value = []
        } finally {
            pending.value = false
        }
    }

    return { lessons, pending, error, compute }
}

/** 🔹 Ders -> konu ilerlemesi (RPC) */
export function useTopicProgress(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    const topics = ref<
        Array<{
            lesson_name: string
            topic_title: string
            total_minutes: number
            topic_status: string
            topic_id?: string
        }>
    >([])
    const pending = ref(false)
    const error = ref<string>('')

    async function compute() {
        if (!uid.value) return
        pending.value = true
        try {
            const { data, error: err } = await supabase.rpc('fn_get_topic_progress', {
                p_user_id: uid.value
            })
            if (err) throw err
            topics.value = data ?? []
        } catch (e: any) {
            error.value = e.message ?? 'Hata'
            topics.value = []
        } finally {
            pending.value = false
        }
    }

    return { topics, pending, error, compute }
}

/** 🔹 Genel ilerleme (RPC) */
export function useOverallProgress(
    userId: MaybeReactive<string | undefined>,
    curriculumId: MaybeReactive<string | null | undefined>
) {
    const uid = toVal(userId)
    const cid = toVal(curriculumId)
    type TopicSummaryRow = {
        total_topics: number | null
        completed_topics: number | null
        progress_percent?: number | null
        note?: string | null
    }
    const overall = ref<{
        total_topics: number
        completed_topics: number
        progress_percent: number
        note?: string | null
    } | null>(null)
    const pending = ref(false)
    const error = ref<string>('')

    async function compute() {
        if (!uid.value) return
        pending.value = true
        try {
            const pCurriculum = normalizeUuid(cid.value)
            const { data: raw, error: err } = await supabase
                .rpc('get_curriculum_topic_summary', {
                    p_user_id: uid.value,
                    p_curriculum_id: pCurriculum
                })
                .maybeSingle()
            if (err) throw err
            const data = (raw as TopicSummaryRow | null) ?? null
            if (!data) {
                overall.value = null
            } else {
                const total = Number(data.total_topics ?? 0)
                const completed = Number(data.completed_topics ?? 0)
                const pct = total > 0 ? Math.round((completed / total) * 1000) / 10 : 0
                overall.value = {
                    total_topics: total,
                    completed_topics: completed,
                    progress_percent: pct,
                    note: data.note
                }
            }
        } catch (e: any) {
            error.value = e.message ?? 'Hata'
            overall.value = null
        } finally {
            pending.value = false
        }
    }

    return { overall, pending, error, compute }
}
