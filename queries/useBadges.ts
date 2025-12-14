// src/queries/useBadges.ts
import { onMounted, onUnmounted, ref, type Ref, computed, unref } from 'vue'
import { supabase } from '../lib/supabase'
import {
    fetchBadges, fetchUserBadges, awardBadge, revokeBadge,
    sortLevels, type Badge, type UserBadge, type BadgeLevel
} from '../api/badges'

/** query keys */
export const qk = {
    badges: 'badges',
    userBadges: (uid: string) => `user_badges:${uid}`,
}

/** Katalog */
export function useBadgesCatalog() {
    return useAsyncData<Badge[]>(
        qk.badges,
        fetchBadges,
        {
            placeholderData: (prev) => prev
            // staleTime handled by default
        }
    )
    // Return compatible signature
    // { data, isLoading: pending, error, refetch: refresh }
}

/** Kullanıcı kazançları */
export function useUserBadges(userId?: string) {
    const key = computed(() => qk.userBadges(userId ?? ''))
    
    const { data, pending, error, refresh } = useAsyncData<UserBadge[]>(
        key.value,
        () => {
            if (!userId) return Promise.resolve([])
            return fetchUserBadges(userId)
        },
        {
            watch: [() => userId],
            placeholderData: (prev) => prev
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

/** Ver / Geri al */
export function useAwardBadge(userId?: string) {
    async function mutateAsync(p: { code: string; level: BadgeLevel }) {
        if (!userId) throw new Error('Missing user id')
        const res = await awardBadge(userId, p.code, p.level)
        refreshNuxtData(qk.userBadges(userId))
        return res
    }
    
    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

export function useRevokeBadge(userId?: string) {
    async function mutateAsync(p: { code: string; level: BadgeLevel }) {
        if (!userId) throw new Error('Missing user id')
        const res = await revokeBadge(userId, p.code, p.level)
        refreshNuxtData(qk.userBadges(userId))
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

/** Realtime: user_badges (INSERT/DELETE/UPDATE) */
export function useRealtimeUserBadges(userId?: string) {
    const status: Ref<'idle' | 'subscribed' | 'error'> = ref('idle')
    let channel: ReturnType<typeof supabase.channel> | null = null

    onMounted(() => {
        if (!userId) return
        try {
            channel = supabase
                .channel(`rb_${userId}`)
                .on(
                    'postgres_changes',
                    { event: '*', schema: 'public', table: 'user_badges', filter: `user_id=eq.${userId}` },
                    () => {
                        // invalidate
                       refreshNuxtData(qk.userBadges(userId))
                    }
                )
                .subscribe((s) => { status.value = s === 'SUBSCRIBED' ? 'subscribed' : status.value })
        } catch { status.value = 'error' }
    })

    onUnmounted(() => {
        if (channel) { supabase.removeChannel(channel); channel = null }
        status.value = 'idle'
    })

    return { status }
}

/** Görsel yardımcılar */
export function levelPretty(l: BadgeLevel): string {
    const map: Record<string, string> = {
        bronze: 'Bronz', silver: 'Gümüş', gold: 'Altın', platinum: 'Platin', diamond: 'Elmas'
    }
    return map[l] ?? l
}
export function levelColor(l: BadgeLevel): string {
    const map: Record<string, string> = {
        bronze: 'bg-amber-300', silver: 'bg-slate-300', gold: 'bg-yellow-400',
        platinum: 'bg-slate-200', diamond: 'bg-cyan-300'
    }
    return map[l] ?? 'bg-slate-200'
}
export { sortLevels }
