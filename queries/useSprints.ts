// src/queries/sprints.ts
import { computed, unref, type Ref, type ComputedRef, ref } from 'vue'
import { SprintsAPI, type SprintGenerateInput, type SprintGenerateResult, type SprintSummary } from '../api/sprints'
import { qk } from './keys'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

export function useGenerateSprint() {
    async function mutateAsync(payload: SprintGenerateInput) {
        return SprintsAPI.generate(payload)
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

export function useUserSprints(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    const key = computed(() => qk.sprints.list(uid.value ?? '').join(':'))

    const { data, pending, error, refresh } = useAsyncData<SprintSummary[]>(
        key.value,
        () => {
            if (!uid.value) return Promise.resolve([])
            return SprintsAPI.listByUser(uid.value)
        },
        {
            watch: [uid],
            // placeholderData: (prev) => prev
        }
    )

    return { data, isLoading: pending, error, refetch: refresh }
}

export function useDeleteSprint(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    
    async function mutateAsync(sprintId: string) {
        if (!uid.value) {
            throw new Error('Kullanıcı bulunamadı')
        }
        if (!sprintId) {
            throw new Error('Koşu bulunamadı')
        }
        const res = await SprintsAPI.deleteById(uid.value, sprintId)
        
        // Refresh cache
        const key = qk.sprints.list(uid.value).join(':')
        refreshNuxtData(key)
        
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}
