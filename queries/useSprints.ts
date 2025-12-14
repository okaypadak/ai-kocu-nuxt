// src/queries/sprints.ts
import { computed, unref, type Ref, type ComputedRef, ref } from 'vue'
import { SprintsAPI, type SprintGenerateInput, type SprintGenerateResult, type SprintSummary } from '../api/sprints'
import { qk } from './keys'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

export function useGenerateSprint() {
    const isPending = ref(false)
    const error = ref<Error | null>(null)
    const data = ref<SprintGenerateResult | null>(null)

    function reset() {
        error.value = null
        data.value = null
        isPending.value = false
    }

    async function mutateAsync(payload: SprintGenerateInput) {
        isPending.value = true
        error.value = null
        try {
            const res = await SprintsAPI.generate(payload)
            data.value = res
            return res
        } catch (err: any) {
            error.value = err
            throw err
        } finally {
            isPending.value = false
        }
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isPending,
        isLoading: isPending,
        error,
        data,
        reset
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

    return { data, isLoading: pending, isFetching: pending, error, refetch: refresh }
}

export function useDeleteSprint(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    const isPending = ref(false)
    const error = ref<Error | null>(null)
    const variables = ref<string | null>(null)
    
    async function mutateAsync(sprintId: string) {
        if (!uid.value) {
            throw new Error('Kullanıcı bulunamadı')
        }
        if (!sprintId) {
            throw new Error('Koşu bulunamadı')
        }
        
        isPending.value = true
        variables.value = sprintId
        error.value = null

        try {
            const res = await SprintsAPI.deleteById(uid.value, sprintId)
            
            // Refresh cache
            const key = qk.sprints.list(uid.value).join(':')
            refreshNuxtData(key)
            
            return res
        } catch (err: any) {
            error.value = err
            throw err
        } finally {
            isPending.value = false
            variables.value = null
        }
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isPending,
        isLoading: isPending,
        error,
        variables
    }
}
