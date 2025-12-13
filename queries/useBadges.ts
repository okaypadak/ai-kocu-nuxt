// src/queries/useBadges.ts
import { onMounted, onUnmounted, ref, type Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../lib/supabase'
import {
    fetchBadges, fetchUserBadges, awardBadge, revokeBadge,
    sortLevels, type Badge, type UserBadge, type BadgeLevel
} from '../api/badges'

/** query keys */
const qk = {
    badges: ['badges'] as const,
    userBadges: (uid: string) => ['user_badges', uid] as const,
}

/** Katalog */
export function useBadgesCatalog() {
    return useQuery<Badge[]>({
        queryKey: qk.badges,
        queryFn: fetchBadges,
        staleTime: 5 * 60_000,
        placeholderData: (prev) => prev,
    })
}

/** Kullanıcı kazançları */
export function useUserBadges(userId?: string) {
    const enabled = !!userId
    return useQuery<UserBadge[]>({
        enabled,
        queryKey: qk.userBadges(userId ?? ''),
        queryFn: () => fetchUserBadges(userId!),
        staleTime: 60_000,
        placeholderData: (prev) => prev,
    })
}

/** Ver / Geri al */
export function useAwardBadge(userId?: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (p: { code: string; level: BadgeLevel }) => awardBadge(userId!, p.code, p.level),
        onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: qk.userBadges(userId) }) }
    })
}
export function useRevokeBadge(userId?: string) {
    const qc = useQueryClient()
    return useMutation({
        mutationFn: (p: { code: string; level: BadgeLevel }) => revokeBadge(userId!, p.code, p.level),
        onSuccess: () => { if (userId) qc.invalidateQueries({ queryKey: qk.userBadges(userId) }) }
    })
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
                        const qc = useQueryClient()
                        qc.invalidateQueries({ queryKey: qk.userBadges(userId) })
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
