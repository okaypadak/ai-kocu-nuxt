// src/queries/useStudyPlans.ts
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, unref, type Ref, type ComputedRef } from 'vue'
import { StudyPlansAPI, type StudyTask, type StudyPlanDTO } from '../api/studyPlans'
import { qk } from './keys'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

export function useStudyPlan(
    userId: MaybeReactive<string | undefined>,
    weekStart: MaybeReactive<string | undefined>
) {
    const uid = toVal(userId)
    const ws  = toVal(weekStart)

    return useQuery<StudyPlanDTO>({
        enabled: () => {
            const isEnabled = !!uid.value && !!ws.value
            if (!isEnabled) console.log('[useStudyPlan] Query DISABLED. uid:', uid.value, 'ws:', ws.value)
            return isEnabled
        },
        queryKey: computed(() => qk.studyPlan.byWeek(uid.value ?? '', ws.value ?? '')),
        queryFn: () => {
            console.log('[useStudyPlan] Fetching plan for:', uid.value, ws.value)
            return StudyPlansAPI.getPlan(uid.value!, ws.value!)
        },
        placeholderData: (prev) => prev
    })
}

export function useUpsertStudyPlan(
    userId: MaybeReactive<string | undefined>,
    weekStart: MaybeReactive<string | undefined>
) {
    const qc = useQueryClient()
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    return useMutation({
        mutationFn: (p: { tasks: StudyTask[]; daily: StudyPlanDTO['daily'] }) =>
            StudyPlansAPI.upsertPlan(uid.value!, ws.value!, p.tasks, p.daily),
        onSuccess: () => {
            if (uid.value && ws.value) {
                qc.invalidateQueries({ queryKey: qk.studyPlan.byWeek(uid.value, ws.value) })
                qc.invalidateQueries({ queryKey: qk.studyPlan.topicSeconds(uid.value, ws.value) })
            }
        }
    })
}

export function useTopicDurationsForWeek(
    userId: MaybeReactive<string | undefined>,
    weekStart: MaybeReactive<string | undefined>
) {
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    return useQuery<Record<string, number>>({
        enabled: () => !!uid.value && !!ws.value,
        queryKey: computed(() => qk.studyPlan.topicSeconds(uid.value ?? '', ws.value ?? '')),
        queryFn: () => {
            return StudyPlansAPI.topicDurationsForWeek(uid.value!, ws.value!)
        },
        staleTime: 60_000,
        placeholderData: (prev) => prev
    })
}
