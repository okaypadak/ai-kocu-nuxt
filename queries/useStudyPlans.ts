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
    const client = useSupabaseClient()
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    const trigger = useStudyPlanTrigger()

    const key = computed(() => qk.studyPlan.byWeek(uid.value ?? '', ws.value ?? '').join(':'))

    const { data, pending, error, refresh } = useAsyncData<StudyPlanDTO>(
        key.value,
        () => {
             const isEnabled = !!uid.value && !!ws.value
             if (!isEnabled) {
                 return Promise.resolve(null as any)
             }
             return StudyPlansAPI.getPlan(client, uid.value!, ws.value!)
        },
        {
            watch: [trigger],
        }
    )

    return { data, isLoading: pending, error, refetch: refresh }
}

export function useUpsertStudyPlan(
    userId: MaybeReactive<string | undefined>,
    weekStart: MaybeReactive<string | undefined>
) {
    const client = useSupabaseClient()
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    const trigger = useStudyPlanTrigger()
    
    async function mutateAsync(p: { tasks: StudyTask[]; daily: StudyPlanDTO['daily'] }) {
        const res = await StudyPlansAPI.upsertPlan(client, uid.value!, ws.value!, p.tasks, p.daily)
        trigger.value++
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
    const client = useSupabaseClient()
    const uid = toVal(userId)
    const ws  = toVal(weekStart)
    const trigger = useStudyPlanTrigger() // Reuse same trigger for simplicity

    const key = computed(() => qk.studyPlan.topicSeconds(uid.value ?? '', ws.value ?? '').join(':'))

    const { data, pending, error, refresh } = useAsyncData<Record<string, number>>(
        key.value,
        () => {
             if (!uid.value || !ws.value) return Promise.resolve({})
             return StudyPlansAPI.topicDurationsForWeek(client, uid.value!, ws.value!)
        },
        {
            watch: [trigger],
        }
    )

    return { data, isLoading: pending, error, refetch: refresh }
}
