// src/queries/useProfile.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
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
    const qc = useQueryClient()

    // userId parametresi ref de olabilir string de; hepsini tek bir computed'ta topladık
    const uidRef = computed<string | null>(() => {
        const p = userId
        const passed = isRef(p) ? unref(p) : p
        return passed ?? auth.userId ?? null
    })

    // ---- Query: profili getir ----
    const query = useQuery<Profile | null, Error>({
        queryKey: computed(() => ['profile', uidRef.value] as const),
        enabled: computed(() => !!uidRef.value),
        staleTime: 60_000,
        queryFn: async () => {
            const uid = uidRef.value
            if (!uid) return null
            return ProfileAPI.fetchByUserId(uid)
        }
    })

    // ---- Mutations ----
    const updateBasicsMutation = useMutation<Profile, Error, { fullname?: string | null; role?: Role }>({
        mutationFn: async (payload) => {
            const uid = uidRef.value
            if (!uid) throw new Error('Kullanıcı yok')
            return ProfileAPI.updateBasics(uid, payload)
        },
        onSuccess: (data) => {
            qc.setQueryData(['profile', uidRef.value], data)
        }
    })

    const updateCustomerInfoMutation = useMutation<Profile, Error, {
        customer_tax_number?: string | null
    }>({
        mutationFn: async (payload) => {
            const uid = uidRef.value
            if (!uid) throw new Error('Kullanici yok')
            return ProfileAPI.updateCustomerInfo(uid, payload)
        },
        onSuccess: (data) => {
            qc.setQueryData(['profile', uidRef.value], data)
        }
    })

    const updatePreferredMutation = useMutation<Profile, Error, string>({
        mutationFn: async (cid) => {
            const uid = uidRef.value
            if (!uid) throw new Error("Kullanici yok")
            const normalized = normalizePreferredCurriculumId(cid)
            if (!normalized) throw new Error("Gecerli mufredat ID gerekli")
            return ProfileAPI.updatePreferred(uid, normalized)
        },
        onSuccess: (data) => {
            qc.setQueryData(['profile', uidRef.value], data)
            if (uidRef.value && uidRef.value === auth.userId) {
                auth.$patch({ preferredCurriculumId: data.preferred_curriculum_id ?? null })
            }
        }
    })

    const updateAiMutation = useMutation<
        Profile,
        Error,
        Partial<Pick<Profile, 'ai_mode' | 'ai_creativity' | 'ai_inspiration' | 'ai_reward_mode'>> & {
            ai_daily_plan_enabled?: boolean | null
            ai_weekly_report_enabled?: boolean | null
            ai_belgesel_mode?: boolean | null
            ai_prediction_enabled?: boolean | null
        }
    >({
        mutationFn: async (payload) => {
            const uid = uidRef.value
            if (!uid) throw new Error('Kullanıcı yok')
            return ProfileAPI.updateAi(uid, payload)
        },
        onSuccess: (data) => {
            qc.setQueryData(['profile', uidRef.value], data)
        }
    })

    return {
        // data & flags
        data: query.data as Ref<Profile | null>,
        isLoading: query.isLoading,
        isFetching: query.isFetching,
        error: query.error as Ref<Error | null>,

        // mutations
        updateBasics: updateBasicsMutation,
        updateCustomerInfo: updateCustomerInfoMutation,
        updatePreferred: updatePreferredMutation,
        updateAi: updateAiMutation,

        // refetch
        refetch: query.refetch
    }
}
