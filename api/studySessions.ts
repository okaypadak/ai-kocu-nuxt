// src/api/studySessions.ts
import type { SupabaseClient } from '@supabase/supabase-js'

/** ==== Types ==== */
export type StudySession = {
    id: string
    user_id: string
    date: string                 // YYYY-MM-DD
    duration_minutes: number
    note: string | null
    curriculum_id: string | null
    topic_uuid: string | null
    topic_title: string | null
    section_id: number | null
    section_name: string | null
    lesson_id: number | null
    lesson_name: string | null
    created_at: string
}

export type SessionCreate = {
    date: string                // YYYY-MM-DD
    duration_minutes: number
    note?: string | null
    curriculum_id?: string | null
    topic_uuid?: string | null
    topic_title?: string | null
    section_id?: number | null
    section_name?: string | null
    lesson_id?: number | null
    lesson_name?: string | null
}

export type SessionUpdate = Partial<Omit<SessionCreate, 'date'>> & { date?: string }
export type DateRange = { from: string; to: string } // YYYY-MM-DD (to dahil)

/** ==== Helpers ==== */
class SessionError extends Error { code?: string; constructor(m:string,c?:string){ super(m); this.code=c } }
const toErr = (e:any)=> new SessionError(e?.message || e?.error?.message)
const timeout = <T>(p:PromiseLike<T>, ms=10_000)=>Promise.race<T>([
    p, new Promise<T>((_,rej)=>setTimeout(()=>rej(new SessionError('İstek zaman aşımı','TIMEOUT')),ms))
])

export function secondsToMinutesRounded(sec: number): number {
    const s = Math.max(0, Math.floor(sec))
    if (s <= 0) return 0
    return Math.max(1, Math.round(s / 60))
}
export function todayISO(): string {
    const d = new Date()
    const y = d.getFullYear(), m = String(d.getMonth()+1).padStart(2,'0'), day = String(d.getDate()).padStart(2,'0')
    return `${y}-${m}-${day}`
}

/** ==== API ==== */
export const StudySessionsAPI = {
    async fetchById(client: SupabaseClient, id: string): Promise<StudySession | null> {
        try {
            const { data, error } = await timeout(
                client.from('study_sessions').select('*').eq('id', id).single()
            )
            if (error) throw error
            return (data ?? null) as StudySession | null
        } catch (e:any) { throw toErr(e) }
    },

    async listByRange(
        client: SupabaseClient,
        userId: string,
        range: DateRange,
        opts?: { limit?: number; order?: 'asc' | 'desc' }
    ): Promise<StudySession[]> {
        try {
            const limit = opts?.limit ?? 500
            const asc = (opts?.order ?? 'desc') === 'asc'
            const { data, error } = await timeout(
                client.from('study_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .gte('date', range.from)
                    .lte('date', range.to)
                    .order('date', { ascending: asc })
                    .order('created_at', { ascending: asc })
                    .limit(limit)
            )
            if (error) throw error
            return (data ?? []) as StudySession[]
        } catch (e:any) { throw toErr(e) }
    },

    async listByDate(
        client: SupabaseClient,
        userId: string,
        dateISO: string,
        opts?: { limit?: number; order?: 'asc' | 'desc' }
    ): Promise<StudySession[]> {
        try {
            const limit = opts?.limit ?? 500
            const asc = (opts?.order ?? 'desc') === 'asc'
            const { data, error } = await timeout(
                client.from('study_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('date', dateISO)
                    .order('created_at', { ascending: asc })
                    .limit(limit)
            )
            if (error) throw error
            return (data ?? []) as StudySession[]
        } catch (e:any) { throw toErr(e) }
    },

    async listRecent(client: SupabaseClient, userId: string, limit = 20): Promise<StudySession[]> {
        try {
            const { data, error } = await timeout(
                client.from('study_sessions')
                    .select('*')
                    .eq('user_id', userId)
                    .order('date', { ascending: false })
                    .order('created_at', { ascending: false })
                    .limit(limit)
            )
            if (error) throw error
            return (data ?? []) as StudySession[]
        } catch (e:any) { throw toErr(e) }
    },

    /** ✅ Insert */
    async create(client: SupabaseClient, userId: string, payload: SessionCreate): Promise<StudySession> {
        try {
            if (!userId) throw new SessionError('Oturum açmanız gerekiyor.', 'NO_AUTH')
            const row = {
                user_id: userId,
                date: payload.date,
                duration_minutes: payload.duration_minutes,
                note: null, // Not storing study session notes anymore
                curriculum_id: payload.curriculum_id ?? null,
                topic_uuid: payload.topic_uuid ?? null,
                topic_title: payload.topic_title ?? null,
                section_id: payload.section_id ?? null,
                section_name: payload.section_name ?? null,
                lesson_id: payload.lesson_id ?? null,
                lesson_name: payload.lesson_name ?? null,
            }
            const { data, error } = await timeout(
                client.from('study_sessions').insert(row).select('*').single()
            )
            if (error) throw error
            return data as StudySession
        } catch (e:any) { throw toErr(e) }
    },

    /** ✅ Timer’dan saniye -> dakika */
    async createFromTimer(client: SupabaseClient, userId: string, p: {
        duration_seconds: number
        date?: string
        note?: string | null
        curriculum_id?: string | null
        topic_uuid?: string | null
        topic_title?: string | null
        section_id?: number | null
        section_name?: string | null
        lesson_id?: number | null
        lesson_name?: string | null
    }): Promise<StudySession> {
        try {
            const minutes = secondsToMinutesRounded(p.duration_seconds)
            const date = p.date ?? todayISO()
            const { duration_seconds, ...rest } = p
            const clean: SessionCreate = { ...rest, date, duration_minutes: minutes }
            return await this.create(client, userId, clean)
        } catch (e:any) { throw toErr(e) }
    },

    async update(client: SupabaseClient, id: string, patch: SessionUpdate): Promise<StudySession> {
        try {
            const safePatch: SessionUpdate = {
                date: patch.date,
                duration_minutes: patch.duration_minutes,
                curriculum_id: patch.curriculum_id ?? null,
                topic_uuid: patch.topic_uuid ?? null,
                topic_title: patch.topic_title ?? null,
                section_id: patch.section_id ?? null,
                section_name: patch.section_name ?? null,
                lesson_id: patch.lesson_id ?? null,
                lesson_name: patch.lesson_name ?? null,
            }
            const { data, error } = await timeout(
                client.from('study_sessions').update(safePatch).eq('id', id).select('*').single()
            )
            if (error) throw error
            return data as StudySession
        } catch (e:any) { throw toErr(e) }
    },

    async remove(client: SupabaseClient, id: string): Promise<void> {
        const { error } = await timeout(
            client.from('study_sessions').delete().eq('id', id)
        )
        if (error) throw toErr(error)
    },

    async deleteByTopicId(client: SupabaseClient, topicUuid: string): Promise<void> {
        const { error } = await timeout(
            client.from('study_sessions').delete().eq('topic_uuid', topicUuid)
        )
        if (error) throw toErr(error)
    },

    /** Eski: toplam/daily (dakika) */
    async statsByRange(
        client: SupabaseClient,
        userId: string,
        range: DateRange
    ): Promise<{ totalMinutes: number; daily: Array<{ date: string; minutes: number }> }> {
        try {
            const { data, error } = await timeout(
                client.from('study_sessions')
                    .select('date, duration_minutes')
                    .eq('user_id', userId)
                    .gte('date', range.from)
                    .lte('date', range.to)
            )
            if (error) throw error

            const map = new Map<string, number>()
            for (const row of (data ?? []) as any[]) {
                const d = String(row.date)
                const m = Number(row.duration_minutes ?? 0)
                map.set(d, (map.get(d) ?? 0) + m)
            }
            const daily = Array.from(map.entries())
                .sort((a,b)=>a[0].localeCompare(b[0]))
                .map(([date, minutes])=>({date, minutes}))
            const totalMinutes = daily.reduce((acc,x)=>acc+x.minutes,0)
            return { totalMinutes, daily }
        } catch (e:any) { throw toErr(e) }
    },

    /** ✅ Günlük özet: her gün için toplam dakika + seans adedi (grafik için) */
    async dailySummaryByRange(
        client: SupabaseClient,
        userId: string,
        range: DateRange
    ): Promise<Array<{ date: string; totalMinutes: number; count: number }>> {
        try {
            const { data, error } = await timeout(
                client.from('study_sessions')
                    .select('date, duration_minutes')
                    .eq('user_id', userId)
                    .gte('date', range.from)
                    .lte('date', range.to)
            )
            if (error) throw error

            const map = new Map<string, { totalMinutes: number; count: number }>()
            for (const row of (data ?? []) as any[]) {
                const d = String(row.date)
                const m = Number(row.duration_minutes ?? 0)
                const cur = map.get(d) ?? { totalMinutes: 0, count: 0 }
                cur.totalMinutes += m
                cur.count += 1
                map.set(d, cur)
            }
            return Array.from(map.entries())
                .sort((a,b)=>a[0].localeCompare(b[0]))
                .map(([date, agg]) => ({ date, totalMinutes: agg.totalMinutes, count: agg.count }))
        } catch (e:any) { throw toErr(e) }
    },

    /** En çok çalışılan konular (dakika toplamı) */
    async topTopics(
        client: SupabaseClient,
        userId: string,
        range: DateRange,
        limit = 10
    ): Promise<Array<{ topic_uuid: string; topic_title: string | null; minutes: number }>> {
        try {
            const { data, error } = await timeout(
                client.from('study_sessions')
                    .select('topic_uuid, topic_id, topic_title, duration_minutes')
                    .eq('user_id', userId)
                    .gte('date', range.from)
                    .lte('date', range.to)
                    .not('topic_uuid', 'is', null)
            )
            if (error) throw error

            const map = new Map<string, { topic_uuid: string; topic_title: string | null; minutes: number }>()
            for (const row of (data ?? []) as any[]) {
                const rawKey = row.topic_uuid ?? row.topic_id
                if (!rawKey) continue
                const key = String(rawKey)
                const prev = map.get(key) ?? { topic_uuid: key, topic_title: row.topic_title ?? null, minutes: 0 }
                prev.minutes += Number(row.duration_minutes ?? 0)
                map.set(key, prev)
            }
            return Array.from(map.values()).sort((a,b)=>b.minutes-a.minutes).slice(0, limit)
        } catch (e:any) { throw toErr(e) }
    },

    /** Haftalık topic toplam süreleri (saniye; UI için) */
    async totalsByTopicForWeekSeconds(client: SupabaseClient, userId: string, weekStart: string): Promise<Record<string, number>> {
        const start = new Date(weekStart)
        const end = new Date(start); end.setDate(end.getDate()+6)
        const to = `${end.getFullYear()}-${String(end.getMonth()+1).padStart(2,'0')}-${String(end.getDate()).padStart(2,'0')}`

        const { data, error } = await timeout(
            client.from('study_sessions')
                .select('topic_uuid, topic_id, duration_minutes')
                .eq('user_id', userId)
                .gte('date', weekStart)
                .lte('date', to)
                .not('topic_uuid', 'is', null)
        )
        if (error) throw toErr(error)

        const out: Record<string, number> = {}
        for (const row of (data ?? []) as any[]) {
            const rawKey = row.topic_uuid ?? row.topic_id
            if (!rawKey) continue
            const key = String(rawKey)
            out[key] = (out[key] ?? 0) + Number(row.duration_minutes ?? 0) * 60 // saniye
        }
        return out
    }
}
