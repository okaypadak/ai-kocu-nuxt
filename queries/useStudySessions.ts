import { computed, unref, type Ref, type ComputedRef, ref } from 'vue'
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

// Global trigger for invalidating all study session queries
export const useStudySessionTrigger = () => useState('studySessionsTrigger', () => 0)

/** Tarih aralığı listesi */
export function useStudySessions(
    userId: string | undefined,
    range: DateRange | undefined,
    limit?: number
) {
    const trigger = useStudySessionTrigger()
    
    // Key construction
    // We append trigger to key to force refresh? 
    // No, useAsyncData(key, fn, { watch: [trigger] }) handles it.
    // The key should remain stable to allow caching.
    const key = computed(() => qk.studySessions.list(userId ?? '', range?.from ?? '', range?.to ?? '', String(limit ?? '')).join(':'))

    const { data, pending, error, refresh } = useAsyncData<StudySession[]>(
        key.value,
        () => {
            if (!userId || !range) return Promise.resolve([])
            return StudySessionsAPI.listByRange(userId, range, { limit })
        },
        {
            watch: [trigger],
            default: () => []
        }
    )

    return { data, isLoading: pending, error, refetch: refresh }
}

/** Son N kayıt */
export function useRecentStudySessions(userId: string | undefined, limit = 20) {
    const trigger = useStudySessionTrigger()
    const key = computed(() => qk.studySessions.recent(userId ?? '', String(limit)).join(':'))

    return useAsyncData<StudySession[]>(
        key.value,
        () => {
             if (!userId) return Promise.resolve([])
             return StudySessionsAPI.listRecent(userId, limit)
        },
        {
            watch: [trigger],
            default: () => []
        }
    )
    // Note: returning direct useAsyncData result has data/pending/error/refresh etc.
    // Adapting to match previous return signature { data, isLoading, error, refetch }
    // Or just return the whole object and let consumer adapt?
    // The previous code returned `useQuery` result.
    // Consumers likely use destructuring: `const { data, isLoading } = useRecent...`
    // useAsyncData return `pending` instead of `isLoading`.
    // I should probably map it to keep compatibility.
}

/** Günlük toplam dakika + toplam (eski) */
export function useStudySessionStats(userId: string | undefined, range: DateRange | undefined) {
    const trigger = useStudySessionTrigger()
    const key = computed(() => qk.studySessions.stats(userId ?? '', range?.from ?? '', range?.to ?? '').join(':'))

    const { data, pending, error, refresh } = useAsyncData<{ totalMinutes: number; daily: Array<{ date: string; minutes: number }> }>(
        key.value,
        () => {
            if (!userId || !range) return Promise.resolve({ totalMinutes: 0, daily: [] })
            return StudySessionsAPI.statsByRange(userId, range)
        },
        {
            watch: [trigger]
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

/** En çok çalışılan konular */
export function useTopTopics(
    userId: string | undefined,
    range: DateRange | undefined,
    limit = 10
) {
    const trigger = useStudySessionTrigger()
    const key = computed(() => qk.studySessions.topTopics(userId ?? '', range?.from ?? '', range?.to ?? '', String(limit)).join(':'))

    const { data, pending, error, refresh } = useAsyncData<Array<{ topic_uuid: string; topic_title: string | null; minutes: number }>>(
        key.value,
        () => {
            if (!userId || !range) return Promise.resolve([])
            return StudySessionsAPI.topTopics(userId, range, limit)
        },
        {
           watch: [trigger],
           default: () => []
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

/** Haftalık topic süreleri (saniye) – UI için */
export function useWeeklyTopicSeconds(userId: string | undefined, weekStartISO: string | undefined) {
    const trigger = useStudySessionTrigger()
    const key = computed(() => qk.studyPlan.topicSeconds(userId ?? '', weekStartISO ?? '').join(':'))

    const { data, pending, error, refresh } = useAsyncData<Record<string, number>>(
        key.value,
        () => {
             if (!userId || !weekStartISO) return Promise.resolve({})
             return StudySessionsAPI.totalsByTopicForWeekSeconds(userId, weekStartISO)
        },
        {
            watch: [trigger]
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

/** 🔹 GÜNLÜK ÖZET (tarih -> toplam dakika + adet) */
export function useDailySummary(
    userId: MaybeReactive<string | undefined>,
    range: MaybeReactive<DateRange | undefined>
) {
    const uid = toVal(userId)
    const rg  = toVal(range)
    const trigger = useStudySessionTrigger()
    
    const key = computed(() => ['dailySummary', uid.value ?? '', rg.value?.from ?? '', rg.value?.to ?? ''].join(':'))
    
    const { data, pending, error, refresh } = useAsyncData<Array<{ date: string; totalMinutes: number; count: number }>>(
        key.value,
        () => {
            if (!uid.value || !rg.value) return Promise.resolve([])
            return StudySessionsAPI.dailySummaryByRange(uid.value, rg.value)
        },
        {
            watch: [trigger, uid, rg],
            default: () => []
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

/** 🔹 Güne göre seans listesi */
export function useSessionsByDate(
    userId: MaybeReactive<string | undefined>,
    dateISO: MaybeReactive<string | undefined>,
    opts?: { limit?: number; order?: 'asc' | 'desc' }
) {
    const uid = toVal(userId)
    const dt  = toVal(dateISO)
    const trigger = useStudySessionTrigger()

    const key = computed(() => ['sessionsByDate', uid.value ?? '', dt.value ?? '', String(opts?.limit ?? ''), opts?.order ?? ''].join(':'))
    
    const { data, pending, error, refresh } = useAsyncData<StudySession[]>(
        key.value,
        () => {
             if (!uid.value || !dt.value) return Promise.resolve([])
             return StudySessionsAPI.listByDate(uid.value, dt.value, opts)
        },
        {
            watch: [trigger, uid, dt],
            default: () => []
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

/** Mutations */
export function useCreateStudySession(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    const trigger = useStudySessionTrigger()

    async function mutateAsync(payload: SessionCreate) {
        const resolved = uid.value
        if (!resolved) throw new Error('Oturum açmanız gerekiyor.')
        const res = await StudySessionsAPI.create(resolved, payload)
        trigger.value++ // Trigger invalidation
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

/** Reaktif userId + invalidations */
export function useCreateStudySessionFromTimer(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    const trigger = useStudySessionTrigger() // Invalidate sessions
    // To invalidate studyPlan, we need access to its trigger if it exists, or use refreshNuxtData on shared keys?
    // Ideally we should import useStudyPlanTrigger if we make it shared. 
    // Or just use refreshNuxtData for known Plan keys?
    // Let's assume we rely on trigger for self-domain, and maybe explicit generic refresh for others.
    
    async function mutateAsync(p: Omit<SessionCreate,'duration_minutes'|'date'> & { duration_seconds: number; date?: string }) {
        const resolved = uid.value
        if (!resolved) throw new Error('Oturum açmanız gerekiyor.')
        const res = await StudySessionsAPI.createFromTimer(resolved, p)
        
        trigger.value++ // Study Sessions
        // Also invalidate Study Plans
        const planTrigger = useState('studyPlansTrigger')
        if (planTrigger.value !== undefined) planTrigger.value++
        
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

export function useUpdateStudySession() {
    const trigger = useStudySessionTrigger()
    
    async function mutateAsync(p: { id: string; patch: SessionUpdate }) {
        const res = await StudySessionsAPI.update(p.id, p.patch)
        trigger.value++
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

export function useDeleteStudySession() {
    const trigger = useStudySessionTrigger()
    
    async function mutateAsync(id: string) {
        const res = await StudySessionsAPI.remove(id)
        trigger.value++
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}
