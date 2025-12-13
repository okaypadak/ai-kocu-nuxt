// src/queries/sprints.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, unref, type Ref, type ComputedRef } from 'vue'
import { SprintsAPI, type SprintGenerateInput, type SprintGenerateResult, type SprintSummary } from '../api/sprints'
import { qk } from './keys'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

export function useGenerateSprint() {
    return useMutation<SprintGenerateResult, Error, SprintGenerateInput>({
        mutationFn: (payload) => SprintsAPI.generate(payload)
    })
}

export function useUserSprints(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    return useQuery<SprintSummary[]>({
        enabled: () => !!uid.value,
        queryKey: computed(() => qk.sprints.list(uid.value ?? '')),
        queryFn: () => SprintsAPI.listByUser(uid.value!),
        placeholderData: (prev) => prev
    })
}

export function useDeleteSprint(userId: MaybeReactive<string | undefined>) {
    const uid = toVal(userId)
    const qc = useQueryClient()
    return useMutation<void, Error, string>({
        mutationFn: (sprintId) => {
            if (!uid.value) {
                throw new Error('Kullanıcı bulunamadı')
            }
            if (!sprintId) {
                throw new Error('Koşu bulunamadı')
            }
            return SprintsAPI.deleteById(uid.value, sprintId)
        },
        onSuccess: () => {
            if (uid.value) {
                qc.invalidateQueries({ queryKey: qk.sprints.list(uid.value) })
            }
        }
    })
}
