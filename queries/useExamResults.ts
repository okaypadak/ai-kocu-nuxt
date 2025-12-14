import { computed, unref, type Ref, type ComputedRef, ref } from 'vue'
import {
    ExamResultsAPI,
    type ExamResult,
    type ExamResultCreate,
} from '../api/examResults'
import {
    GeneralExamResultsAPI,
    type GeneralExamResultCreate,
    type GeneralExamResult,
} from '../api/generalExamResults'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function'
        ? computed(() => (src as any)())
        : computed(() => unref(src as any))

export const useExamResultsTrigger = () => useState('examResultsTrigger', () => 0)

/** Son N kayıt (user + topic) */
export function useRecentExamResults(
    userId: MaybeReactive<string | undefined>,
    topicId: MaybeReactive<string | null | undefined>,
    limit = 20
) {
    const uid = toVal(userId)
    const tid = toVal(topicId)
    const trigger = useExamResultsTrigger()

    const key = computed(() => [
        'examResults',
        'recent',
        uid.value ?? '',
        tid.value ?? '',
        String(limit),
    ].join(':'))

    const { data, pending, error, refresh } = useAsyncData<ExamResult[]>(
        key.value,
        () => {
            if (!uid.value || !tid.value) return Promise.resolve([])
            return ExamResultsAPI.listRecentByTopic(uid.value, tid.value, limit)
        },
        {
            watch: [trigger],
            placeholderData: (p) => p,
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

export function useWeeklyExamResults(
    userId: MaybeReactive<string | undefined>,
    weekStartISO: MaybeReactive<string | undefined>,
    weekEndISO: MaybeReactive<string | undefined>,
    curriculumId: MaybeReactive<string | null | undefined>
) {
    const uid = toVal(userId)
    const ws = toVal(weekStartISO)
    const we = toVal(weekEndISO)
    const cid = toVal(curriculumId)
    const trigger = useExamResultsTrigger()

    const key = computed(() => [
        'examResults',
        'weekly',
        uid.value ?? '',
        ws.value ?? '',
        we.value ?? '',
        cid.value ?? '',
    ].join(':'))

    const { data, pending, error, refresh } = useAsyncData<ExamResult[]>(
        key.value,
        () => {
            if (!uid.value || !ws.value || !we.value) return Promise.resolve([])
            return ExamResultsAPI.listByDateRange(
                uid.value,
                ws.value,
                we.value,
                cid.value ?? null
            )
        },
        {
            watch: [trigger],
            placeholderData: (p) => p,
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

export function useWeeklyGeneralExamResults(
    userId: MaybeReactive<string | undefined>,
    weekStartISO: MaybeReactive<string | undefined>,
    weekEndISO: MaybeReactive<string | undefined>,
    curriculumId: MaybeReactive<string | null | undefined>
) {
    const uid = toVal(userId)
    const ws = toVal(weekStartISO)
    const we = toVal(weekEndISO)
    const cid = toVal(curriculumId)
    const trigger = useExamResultsTrigger()

    const key = computed(() => [
        'generalExamResults',
        'weekly',
        uid.value ?? '',
        ws.value ?? '',
        we.value ?? '',
        cid.value ?? '',
    ].join(':'))

    const { data, pending, error, refresh } = useAsyncData<GeneralExamResult[]>(
        key.value,
        () => {
            if (!uid.value || !ws.value || !we.value) return Promise.resolve([])
            return GeneralExamResultsAPI.listByDateRange(
                uid.value,
                ws.value,
                we.value,
                cid.value ?? null
            )
        },
        {
            watch: [trigger],
            placeholderData: (p) => p,
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

/** Kayıt oluşturma */
export function useCreateExamResult(
    userId: MaybeReactive<string | undefined>
) {
    const uid = toVal(userId)
    const trigger = useExamResultsTrigger()

    async function mutateAsync(payload: ExamResultCreate) {
        const res = await ExamResultsAPI.create(uid.value!, payload)
        trigger.value++
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}

export function useCreateGeneralExamResult(
    userId: MaybeReactive<string | undefined>
) {
    const uid = toVal(userId)
    const trigger = useExamResultsTrigger()

    async function mutateAsync(payload: GeneralExamResultCreate) {
        const res = await GeneralExamResultsAPI.create(uid.value!, payload)
        trigger.value++
        return res
    }

    return {
        mutateAsync,
        mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
        isLoading: ref(false)
    }
}
