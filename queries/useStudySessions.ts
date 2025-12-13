import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, unref, type Ref, type ComputedRef } from 'vue'
import {
    StudySessionsAPI,
    type StudySession,
    type SessionCreate,
    type SessionUpdate,
    type DateRange
} from '../api/studySessions'
import { qk } from './keys'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

/** Tarih aralığı listesi */
export function useStudySessions(
    userId: string | undefined,
    range: DateRange | undefined,
    limit?: number
) {
    const enabled = !!userId && !!range
    return useQuery<StudySession[]>({
        enabled,
        queryKey: qk.studySessions.list(userId ?? '', range?.from ?? '', range?.to ?? '', String(limit ?? '')),
        queryFn: () => StudySessionsAPI.listByRange(userId!, range!, { limit }),
        staleTime: 60_000,
        placeholderData: (prev) => prev
    })
}

/** Son N kayıt */
export function useRecentStudySessions(userId: string | undefined, limit = 20) {
    const enabled = !!userId
    return useQuery<StudySession[]>({
        enabled,
        queryKey: qk.studySessions.recent(userId ?? '', String(limit)),
        queryFn: () => StudySessionsAPI.listRecent(userId!, limit),
        staleTime: 60_000,
        placeholderData: (prev) => prev
    })
}

/** Günlük toplam dakika + toplam (eski) */
export function useStudySessionStats(userId: string | undefined, range: DateRange | undefined) {
    const enabled = !!userId && !!range
    return useQuery<{ totalMinutes: number; daily: Array<{ date: string; minutes: number }> }>({
        enabled,
        queryKey: qk.studySessions.stats(userId ?? '', range?.from ?? '', range?.to ?? ''),
        queryFn: () => StudySessionsAPI.statsByRange(userId!, range!)
    })
}

/** En çok çalışılan konular */
export function useTopTopics(
    userId: string | undefined,
    range: DateRange | undefined,
    limit = 10
) {
    const enabled = !!userId && !!range
    return useQuery<Array<{ topic_uuid: string; topic_title: string | null; minutes: number }>>({
        enabled,
        queryKey: qk.studySessions.topTopics(userId ?? '', range?.from ?? '', range?.to ?? '', String(limit)),
        queryFn: () => StudySessionsAPI.topTopics(userId!, range!, limit),
        staleTime: 60_000
    })
}

/** Haftalık topic süreleri (saniye) – UI için */
export function useWeeklyTopicSeconds(userId: string | undefined, weekStartISO: string | undefined) {
    const enabled = !!userId && !!weekStartISO
    return useQuery<Record<string, number>>({
        enabled,
        queryKey: qk.studyPlan.topicSeconds(userId ?? '', weekStartISO ?? ''),
        queryFn: () => StudySessionsAPI.totalsByTopicForWeekSeconds(userId!, weekStartISO!)
    })
}

/** 🔹 GÜNLÜK ÖZET (tarih -> toplam dakika + adet) */
export function useDailySummary(
    userId: MaybeReactive<string | undefined>,
    range: MaybeReactive<DateRange | undefined>
) {
    const uid = toVal(userId)
    const rg  = toVal(range)
    return useQuery<Array<{ date: string; totalMinutes: number; count: number }>>({
        enabled: () => !!uid.value && !!rg.value,
        queryKey: computed(() => ['dailySummary', uid.value ?? '', rg.value?.from ?? '', rg.value?.to ?? '']),
        queryFn: () => StudySessionsAPI.dailySummaryByRange(uid.value!, rg.value!)
    })
}

/** 🔹 Güne göre seans listesi */
export function useSessionsByDate(
    userId: MaybeReactive<string | undefined>,
    dateISO: MaybeReactive<string | undefined>,
    opts?: { limit?: number; order?: 'asc' | 'desc' }
) {
    const uid = toVal(userId)
    const dt  = toVal(dateISO)
    return useQuery<StudySession[]>({
        enabled: () => !!uid.value && !!dt.value,
        queryKey: computed(() => ['sessionsByDate', uid.value ?? '', dt.value ?? '', String(opts?.limit ?? ''), opts?.order ?? '']),
        queryFn: () => StudySessionsAPI.listByDate(uid.value!, dt.value!, opts)
    })
}

/** Mutations */
export function useCreateStudySession(userId: MaybeReactive<string | undefined>) {
    const qc = useQueryClient()
    const uid = toVal(userId)
    return useMutation({
        mutationFn: (payload: SessionCreate) => {
            const resolved = uid.value
            if (!resolved) throw new Error('Oturum açmanız gerekiyor.')
            return StudySessionsAPI.create(resolved, payload)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: qk.studySessions.root })
        }
    })
}

/** Reaktif userId + invalidations */
export function useCreateStudySessionFromTimer(userId: MaybeReactive<string | undefined>) {
    const qc = useQueryClient()
    const uid = toVal(userId)
    return useMutation({
        mutationFn: (p: Omit<SessionCreate,'duration_minutes'|'date'> & { duration_seconds: number; date?: string }) => {
            const resolved = uid.value
            if (!resolved) throw new Error('Oturum açmanız gerekiyor.')
            return StudySessionsAPI.createFromTimer(resolved, p)
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: qk.studySessions.root })
            qc.invalidateQueries({ queryKey: qk.studyPlan.root })
            qc.invalidateQueries({ queryKey: ['topicDurations'] })
            qc.invalidateQueries({ queryKey: ['dailySummary'] })
            qc.invalidateQueries({ queryKey: ['sessionsByDate'] })
        }
    })
}

export function useUpdateStudySession() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (p: { id: string; patch: SessionUpdate }) => StudySessionsAPI.update(p.id, p.patch),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: qk.studySessions.root })
        }
    })
}

export function useDeleteStudySession() {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (id: string) => StudySessionsAPI.remove(id),
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: qk.studySessions.root })
        }
    })
}
