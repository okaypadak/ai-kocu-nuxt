// src/api/badges.ts
import { supabase } from '../lib/supabase'

export type BadgeLevel = string // public.badge_level enum; ör: 'bronze'|'silver'|'gold'|...
export type Badge = {
    code: string
    title: string
    description: string | null
    emoji: string | null
    rule: any | null
    levels: BadgeLevel[] | null
    created_at: string
    updated_at: string
}

export type UserBadge = {
    user_id: string
    badge_code: string
    level: BadgeLevel
    earned_at: string
}

class ApiErr extends Error { code?: string; constructor(m: string, c?: string) { super(m); this.code = c } }
const toErr = (e: any) => new ApiErr(e?.message || e?.error?.message || 'Beklenmeyen hata', e?.code || e?.error?.code)
const timeout = <T>(p: PromiseLike<T>, ms = 10000) => Promise.race<T>([
    p, new Promise<T>((_, rej) => setTimeout(() => rej(new ApiErr('Zaman aşımı', 'TIMEOUT')), ms))
])

/** Katalog (tüm rozetler) */
export async function fetchBadges(): Promise<Badge[]> {
    const { data, error } = await timeout(
        supabase.from('badges').select('*').order('code', { ascending: true })
    )
    if (error) throw toErr(error)
    return (data ?? []) as Badge[]
}

/** Kullanıcının kazandıkları */
export async function fetchUserBadges(userId: string): Promise<UserBadge[]> {
    const { data, error } = await timeout(
        supabase.from('user_badges')
            .select('*')
            .eq('user_id', userId)
            .order('earned_at', { ascending: false })
    )
    if (error) throw toErr(error)
    return (data ?? []) as UserBadge[]
}

/** Admin: rozet tanımı ekle/güncelle */
export async function upsertBadge(b: Omit<Badge, 'created_at' | 'updated_at'>): Promise<Badge> {
    const row = { ...b }
    const { data, error } = await timeout(
        supabase.from('badges').upsert(row).select('*').single()
    )
    if (error) throw toErr(error)
    return data as Badge
}

/** Kullanıcıya rozet ver (idempotent) */
export async function awardBadge(userId: string, badgeCode: string, level: BadgeLevel): Promise<UserBadge> {
    const row = { user_id: userId, badge_code: badgeCode, level }
    const { data, error } = await timeout(
        supabase.from('user_badges').upsert(row, { onConflict: 'user_id,badge_code,level' }).select('*').single()
    )
    if (error) throw toErr(error)
    return data as UserBadge
}

/** (Opsiyonel) Geri al */
export async function revokeBadge(userId: string, badgeCode: string, level: BadgeLevel): Promise<void> {
    const { error } = await timeout(
        supabase.from('user_badges').delete()
            .eq('user_id', userId)
            .eq('badge_code', badgeCode)
            .eq('level', level)
    )
    if (error) throw toErr(error)
}

/** Yardımcılar */
export const DEFAULT_LEVEL_ORDER: BadgeLevel[] = ['bronze', 'silver', 'gold', 'platinum', 'diamond']
export function sortLevels(levels?: BadgeLevel[] | null): BadgeLevel[] {
    if (!levels || !levels.length) return []
    const order = new Map(DEFAULT_LEVEL_ORDER.map((l, i) => [l, i]))
    return [...levels].sort((a, b) => (order.get(a) ?? 999) - (order.get(b) ?? 999))
}
