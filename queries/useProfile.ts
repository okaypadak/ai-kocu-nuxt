// src/queries/useProfile.ts
import { ProfileAPI, type Profile, type Role, normalizePreferredCurriculumId } from '../api/profile'
import { useAuthStore } from '../stores/auth.store'
import { computed, type Ref, unref, isRef } from 'vue'

/**
 * Kullanım:
 *   const { data, updateBasics, updatePreferred } = useProfile()
 *   // veya belirli bir kullanıcı için:
 *   const { data } = useProfile(otherUserId)  // string | Ref<string|null>
 */
export function useProfile(userId?: string | Ref<string | null> | null) {
    const auth = useAuthStore()

    // userId parametresi ref de olabilir string de; hepsini tek bir computed'ta topladık
    const uidRef = computed<string | null>(() => {
        const p = userId
        const passed = isRef(p) ? unref(p) : p
        return passed ?? auth.userId ?? null
    })

    const key = computed(() => `profile:${uidRef.value}`)

    // ---- Query: profili getir ----
    const { data, pending, error, refresh } = useAsyncData<Profile | null, Error>(
        key.value,
        async () => {
            const uid = uidRef.value
            if (!uid) return null
            return ProfileAPI.fetchByUserId(uid)
        },
        {
            watch: [uidRef],
            // immediate: true (default)
        }
    )

    // ---- Mutations ----
    // Not: Vue Query'deki gibi otomatik state takibi (isLoading vs) yok,
    // gerekirse her fonksiyon için ref kullanip state tutulabilir.
    // Şimdilik sadece promise döndürüyoruz.

    async function updateBasicsMutation(payload: { fullname?: string | null; role?: Role }, options?: { onSuccess?: (data: Profile) => void, onError?: (err: Error) => void }) {
        const uid = uidRef.value
        if (!uid) throw new Error('Kullanıcı yok')
        
        try {
            const res = await ProfileAPI.updateBasics(uid, payload)
            // Cache güncelle
            refreshNuxtData(key.value)
            options?.onSuccess?.(res)
            return res
        } catch (e: any) {
            options?.onError?.(e)
            throw e
        }
    }

    async function updateCustomerInfoMutation(payload: { customer_tax_number?: string | null }, options?: { onSuccess?: (data: Profile) => void, onError?: (err: Error) => void }) {
        const uid = uidRef.value
        if (!uid) throw new Error('Kullanici yok')

        try {
            const res = await ProfileAPI.updateCustomerInfo(uid, payload)
            refreshNuxtData(key.value)
            options?.onSuccess?.(res)
            return res
        } catch (e: any) {
             options?.onError?.(e)
             throw e
        }
    }

    async function updatePreferredMutation(cid: string, options?: { onSuccess?: (data: Profile) => void, onError?: (err: Error) => void }) {
        const uid = uidRef.value
        if (!uid) throw new Error("Kullanici yok")
        
        const normalized = normalizePreferredCurriculumId(cid)
        if (!normalized) throw new Error("Gecerli mufredat ID gerekli")
        
        try {
            const res = await ProfileAPI.updatePreferred(uid, normalized)
            refreshNuxtData(key.value)
            if (uidRef.value && uidRef.value === auth.userId) {
                auth.$patch({ preferredCurriculumId: res.preferred_curriculum_id ?? null })
            }
            options?.onSuccess?.(res)
            return res
        } catch (e: any) {
             options?.onError?.(e)
             throw e
        }
    }

    async function updateAiMutation(
        payload: Partial<Pick<Profile, 'ai_mode' | 'ai_creativity' | 'ai_inspiration' | 'ai_reward_mode'>> & {
            ai_daily_plan_enabled?: boolean | null
            ai_weekly_report_enabled?: boolean | null
            ai_belgesel_mode?: boolean | null
            ai_prediction_enabled?: boolean | null
        }, 
        options?: { onSuccess?: (data: Profile) => void, onError?: (err: Error) => void }
    ) {
        const uid = uidRef.value
        if (!uid) throw new Error('Kullanıcı yok')

        try {
            const res = await ProfileAPI.updateAi(uid, payload)
            refreshNuxtData(key.value)
            options?.onSuccess?.(res)
            return res
        } catch (e: any) {
             options?.onError?.(e)
             throw e
        }
    }

    // Vue Query uyumluluğu için "mutate" fonksiyonu:
    // Fakat burada düz async fonksiyon döndürüyoruz.
    // Kullanılan yerlerde `.mutate(...)` çağıran varsa hata alcaktır.
    // O yüzden `mutate` wrapper'ı ekleyelim.

    function makeMutation(fn: any) {
        return {
            mutate: (vars: any, opts: any) => fn(vars, opts),
            mutateAsync: (vars: any) => fn(vars), // basitleştirilmiş
            isLoading: ref(false), // static ref for compatibility (TODO: implement real loading state if needed)
            isPending: ref(false),
            isError: ref(false),
            error: ref(null)
        }
    }
    
    // Eğer mutate çağrısı yapılıyorsa bu wrapper şart.
    // Ancak temizlik adına, çağıran yerleri düz async fonksiyona çevirmek daha iyi olur.
    // Şimdilik uyumluluk katmanı ekliyorum.

    return {
        // data & flags
        data,
        isLoading: pending,
        isFetching: pending,
        error,

        // mutations (Backward compatibility wrappers)
        updateBasics: makeMutation(updateBasicsMutation),
        updateCustomerInfo: makeMutation(updateCustomerInfoMutation),
        updatePreferred: makeMutation(updatePreferredMutation),
        updateAi: makeMutation(updateAiMutation),

        // refetch
        refetch: refresh
    }
}
