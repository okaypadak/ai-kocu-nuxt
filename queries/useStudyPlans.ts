// src/queries/useStudyPlans.ts
import { computed, unref, type Ref, type ComputedRef, ref } from 'vue'
import { StudyPlansAPI, type StudyTask, type StudyPlanDTO } from '../api/studyPlans'
import { qk } from './keys'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

export const useStudyPlanTrigger = () => useState('studyPlansTrigger', () => 0)

export function useStudyPlan(
    userId: MaybeReactive<string | undefined>,
    weekStart: MaybeReactive<string | undefined>
) {
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    const trigger = useStudyPlanTrigger()

    const key = computed(() => qk.studyPlan.byWeek(uid.value ?? '', ws.value ?? '').join(':'))

    const { data, pending, error, refresh } = useAsyncData<StudyPlanDTO>(
        key.value,
        () => {
             const isEnabled = !!uid.value && !!ws.value
             if (!isEnabled) {
                 // Return empty/null structure? 
                 // Previous placeholderData: (prev) => prev
                 return Promise.resolve(null as any)
             }
             return StudyPlansAPI.getPlan(uid.value!, ws.value!)
        },
        {
            watch: [trigger],
            // placeholderData: (prev) => prev (Nuxt default is null, unless lazy/transform)
            // If we want to keep previous data while fetching, use 'lazy: true'?
            // But useAsyncData pending is distinct.
        }
    )

    return { data, isLoading: pending, error, refetch: refresh }
}

export function useUpsertStudyPlan(
    userId: MaybeReactive<string | undefined>,
    weekStart: MaybeReactive<string | undefined>
) {
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    const trigger = useStudyPlanTrigger()
    
    async function mutateAsync(p: { tasks: StudyTask[]; daily: StudyPlanDTO['daily'] }) {
        const res = await StudyPlansAPI.upsertPlan(uid.value!, ws.value!, p.tasks, p.daily)
        trigger.value++
        // Also invalidate topic seconds?
        // They share the same trigger if we want? Or explicit refresh?
        // The topicSeconds query below also typically needs refresh.
        // We can force it by same trigger if we want.
        // But topicSeconds query will use useAsyncData dependency logic.
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

export function useTopicDurationsForWeek(
    userId: MaybeReactive<string | undefined>,
    weekStart: MaybeReactive<string | undefined>
) {
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    const trigger = useStudyPlanTrigger() // Reuse same trigger for simplicity

    const key = computed(() => qk.studyPlan.topicSeconds(uid.value ?? '', ws.value ?? '').join(':'))

    const { data, pending, error, refresh } = useAsyncData<Record<string, number>>(
        key.value,
        () => {
             if (!uid.value || !ws.value) return Promise.resolve({})
             return StudyPlansAPI.topicDurationsForWeek(uid.value!, ws.value!)
        },
        {
            watch: [trigger],
            // staleTime equivalent?
        }
    )

    return { data, isLoading: pending, error, refetch: refresh }
}
