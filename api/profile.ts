// src/api/profile.ts
import { supabase } from '../lib/supabase'

export type Role = 'student' | 'teacher' | 'admin'

export type AiCharacter =
    | 'fast_start_drop'
    | 'slow_stable'
    | 'low_study_high_net'
    | 'hardworking_chaotic'
    | 'focused_slow'
    | 'social_distracted'
    | 'unknown'

export type AiReward = 'none' | 'basic' | 'gamified' | 'legendary_cards'
export type AiInspiration = 'soft' | 'balanced' | 'hardcore' | 'humorous'
export type AiCreativity = 'normal' | 'creative' | 'very_creative' | 'storytelling'
export type AiMode =
    | 'discipline_commando'
    | 'soft_mentor'
    | 'funny_comic'
    | 'anime_senpai'
    | 'professional_coach'
    | 'elon_style'
    | 'rick_and_morty'
    | 'game_character'

export type Profile = {
    user_id: string
    email: string | null
    role: Role
    fullname: string | null
    customer_tax_number: string | null
    preferred_curriculum_id: string | null
    created_at: string
    updated_at: string
    ai_mode: AiMode | null
    ai_creativity: AiCreativity | null
    ai_inspiration: AiInspiration | null
    ai_reward_mode: AiReward | null
    ai_character: AiCharacter | null
    ai_daily_plan_enabled: boolean | null
    ai_weekly_report_enabled: boolean | null
    ai_belgesel_mode: boolean | null
    ai_prediction_enabled: boolean | null
    premium_ends_at: string | null
}

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const normalizePreferredCurriculumId = (value?: string | null): string | null => {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    if (!trimmed) return null
    return UUID_REGEX.test(trimmed) ? trimmed : null
}

const toProfileWithNormalizedPref = (prof: Profile | null): Profile | null =>
    prof
        ? {
              ...prof,
              preferred_curriculum_id: normalizePreferredCurriculumId(prof.preferred_curriculum_id)
          }
        : prof

const PROFILE_FIELDS =
    'user_id,email,role,fullname,customer_tax_number,' +
    'preferred_curriculum_id,created_at,updated_at,' +
    'ai_mode,ai_creativity,ai_inspiration,ai_reward_mode,ai_character,' +
    'ai_daily_plan_enabled,ai_weekly_report_enabled,ai_belgesel_mode,ai_prediction_enabled,premium_ends_at'

async function pickAnyCurriculumId(): Promise<string | null> {
    const { data, error } = await supabase.from('curricula').select('id').order('id', { ascending: true }).limit(1)
    if (error) {
        console.warn('[profile] fallback curriculum lookup failed:', error.message)
        return null
    }
    return data?.[0]?.id ?? null
}

export const ProfileAPI = {
    /** Tek satır bekler; yoksa null döner. `.maybeSingle()` + `.limit(1)` */
    async fetchByUserId(uid: string): Promise<Profile | null> {
        const { data, error } = await supabase
            .from('profiles')
            .select(PROFILE_FIELDS)
            .eq('user_id', uid)
            .limit(1)
            .maybeSingle()
            .returns<Profile | null>()

        if (error) throw error
        return toProfileWithNormalizedPref(data)
    },

    /** Yoksa olustur (idempotent). preferred_curriculum_id zorunlu oldugu icin ilk mevcut kaydi veya verilen IDyi kullanir. */
    async createIfMissing(
        uid: string,
        email: string | null,
        role: Role = 'student',
        fullname: string | null = null,
        preferredCurriculumId?: string | null
    ): Promise<Profile> {
        const { data: existing, error: existingError } = await supabase
            .from('profiles')
            .select(PROFILE_FIELDS)
            .eq('user_id', uid)
            .limit(1)
            .maybeSingle()
            .returns<Profile | null>()

        if (existingError) throw existingError
        const safeExisting = toProfileWithNormalizedPref(existing)
        if (safeExisting) return safeExisting

        const preferred =
            normalizePreferredCurriculumId(preferredCurriculumId) ??
            normalizePreferredCurriculumId(await pickAnyCurriculumId())

        if (!preferred) {
            throw new Error('preferred_curriculum_id bulunamadi; profil olusturulamadi.')
        }

        const { data, error } = await supabase
            .from('profiles')
            .upsert(
                { user_id: uid, email, role, fullname, preferred_curriculum_id: preferred },
                { onConflict: 'user_id' }
            )
            .select(PROFILE_FIELDS)
            .single()
            .returns<Profile>()

        if (error) throw error
        const safe = toProfileWithNormalizedPref(data)
        if (!safe) throw new Error('Profile create failed')
        return safe
    },

    /** Get or create shortcut (isteğe bağlı) */
    async getOrCreateByUserId(
        uid: string,
        seed?: { email?: string | null; role?: Role; fullname?: string | null; preferredCurriculumId?: string | null }
    ): Promise<Profile> {
        const existing = await this.fetchByUserId(uid)
        if (existing) return existing
        await this.createIfMissing(
            uid,
            seed?.email ?? null,
            seed?.role ?? 'student',
            seed?.fullname ?? null,
            seed?.preferredCurriculumId ?? null
        )
        const created = await this.fetchByUserId(uid)
        if (!created) throw new Error('Profile create failed (RLS/policies?)')
        return created
    },

    /** Temel alanları güncelle (fullname, role). */
    async updateBasics(
        uid: string,
        payload: { fullname?: string | null; role?: Role }
    ): Promise<Profile> {
        const hasAny =
            Object.prototype.hasOwnProperty.call(payload, 'fullname') ||
            Object.prototype.hasOwnProperty.call(payload, 'role')

        if (!hasAny) {
            // no-op: alan yoksa mevcut kaydı döndür
            const prof = await this.fetchByUserId(uid)
            if (!prof) throw new Error('Profile not found')
            return prof
        }

        const { data, error } = await supabase
            .from('profiles')
            .update({
                // undefined gönderilirse PostgREST alanı dokunmaz
                fullname: payload.fullname ?? undefined,
                role: payload.role ?? undefined
            })
            .eq('user_id', uid)
            .select(PROFILE_FIELDS)
            .limit(1)
            .maybeSingle()
            .returns<Profile | null>()

        if (error) throw error
        if (!data) throw new Error('Profile update failed')
        return toProfileWithNormalizedPref(data)!
    },
    /** Mufredat tercih guncelle */
    async updatePreferred(uid: string, cid: string): Promise<Profile> {
        const target = normalizePreferredCurriculumId(cid)
        if (!target) throw new Error('Gecersiz mufredat ID (UUID bekleniyor).')

        const { data, error } = await supabase
            .from('profiles')
            .update({ preferred_curriculum_id: target })
            .eq('user_id', uid)
            .select(PROFILE_FIELDS)
            .limit(1)
            .maybeSingle()
            .returns<Profile | null>()

        if (error) throw error
        if (!data) throw new Error('Profile update failed')
        return toProfileWithNormalizedPref(data)!
    },



    /** Fatura / musteri bilgilerini guncelle (Sadece TCKN kaldı) */
    async updateCustomerInfo(
        uid: string,
        payload: {
            customer_tax_number?: string | null
        }
    ): Promise<Profile> {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                customer_tax_number: payload.customer_tax_number ?? undefined
            })
            .eq('user_id', uid)
            .select(PROFILE_FIELDS)
            .limit(1)
            .maybeSingle()
            .returns<Profile | null>()

        if (error) throw error
        if (!data) throw new Error('Profile update failed')
        return toProfileWithNormalizedPref(data)!
    },

    /** Yapay zeka tercihlerini güncelle */
    async updateAi(
        uid: string,
        payload: {
            ai_mode?: AiMode | null
            ai_creativity?: AiCreativity | null
            ai_inspiration?: AiInspiration | null
            ai_reward_mode?: AiReward | null
            ai_daily_plan_enabled?: boolean | null
            ai_weekly_report_enabled?: boolean | null
            ai_belgesel_mode?: boolean | null
            ai_prediction_enabled?: boolean | null
        }
    ): Promise<Profile> {
        const { data, error } = await supabase
            .from('profiles')
            .update({
                ai_mode: payload.ai_mode ?? undefined,
                ai_creativity: payload.ai_creativity ?? undefined,
                ai_inspiration: payload.ai_inspiration ?? undefined,
                ai_reward_mode: payload.ai_reward_mode ?? undefined,
                ai_daily_plan_enabled: payload.ai_daily_plan_enabled ?? undefined,
                ai_weekly_report_enabled: payload.ai_weekly_report_enabled ?? undefined,
                ai_belgesel_mode: payload.ai_belgesel_mode ?? undefined,
                ai_prediction_enabled: payload.ai_prediction_enabled ?? undefined
            })
            .eq('user_id', uid)
            .select(PROFILE_FIELDS)
            .limit(1)
            .maybeSingle()
            .returns<Profile | null>()

        if (error) throw error
        if (!data) throw new Error('Profile update failed')
        return toProfileWithNormalizedPref(data)!
    }
}
