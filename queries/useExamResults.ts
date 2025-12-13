import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { computed, unref, type Ref, type ComputedRef } from 'vue'
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

/** Son N kayıt (user + topic) */
export function useRecentExamResults(
    userId: MaybeReactive<string | undefined>,
    topicId: MaybeReactive<string | null | undefined>,
    limit = 20
) {
    const uid = toVal(userId)
    const tid = toVal(topicId)

    return useQuery<ExamResult[]>({
        enabled: () => !!uid.value && !!tid.value,
        queryKey: computed(() => [
            'examResults',
            'recent',
            uid.value ?? '',
            tid.value ?? '',
            String(limit),
        ]),
        queryFn: () =>
            ExamResultsAPI.listRecentByTopic(uid.value!, tid.value!, limit),
        placeholderData: (p) => p,
    })
}

/**
 * Haftalık veriler:
 * - userId zorunlu
 * - weekStartISO zorunlu (hafta pazartesi 00:00)
 * - weekEndISO   zorunlu (haftaStart + 7gün)
 * - curriculumId opsiyonel (ör: TYT / AYT ayrımı)
 *
 * Dönen data: ham exam_result[]
 * Component içinde günlere göre gruplayacağız.
 */
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

    return useQuery<ExamResult[]>({
        enabled: () => !!uid.value && !!ws.value && !!we.value,
        queryKey: computed(() => [
            'examResults',
            'weekly',
            uid.value ?? '',
            ws.value ?? '',
            we.value ?? '',
            cid.value ?? '',
        ]),
        queryFn: () =>
            ExamResultsAPI.listByDateRange(
                uid.value!,
                ws.value!,
                we.value!,
                cid.value ?? null
            ),
        placeholderData: (p) => p,
    })
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

    return useQuery<GeneralExamResult[]>({
        enabled: () => !!uid.value && !!ws.value && !!we.value,
        queryKey: computed(() => [
            'generalExamResults',
            'weekly',
            uid.value ?? '',
            ws.value ?? '',
            we.value ?? '',
            cid.value ?? '',
        ]),
        queryFn: () =>
            GeneralExamResultsAPI.listByDateRange(
                uid.value!,
                ws.value!,
                we.value!,
                cid.value ?? null
            ),
        placeholderData: (p) => p,
    })
}

/** Kayıt oluşturma */
export function useCreateExamResult(
    userId: MaybeReactive<string | undefined>
) {
    const qc = useQueryClient()
    const uid = toVal(userId)

    return useMutation({
        mutationFn: (payload: ExamResultCreate) =>
            ExamResultsAPI.create(uid.value!, payload),
        onSuccess: (_d, v) => {
            // konuya göre listeyi yenile
            const topicKey = String(v.topic_uuid ?? '')
            qc.invalidateQueries({
                queryKey: [
                    'examResults',
                    'recent',
                    uid.value ?? '',
                    topicKey,
                ],
            })
            // weekly list'ler de potansiyel olarak değişti.
            qc.invalidateQueries({
                queryKey: ['examResults', 'weekly'],
                exact: false,
            })
        },
    })
}

export function useCreateGeneralExamResult(
    userId: MaybeReactive<string | undefined>
) {
    const qc = useQueryClient()
    const uid = toVal(userId)

    return useMutation({
        mutationFn: (payload: GeneralExamResultCreate) =>
            GeneralExamResultsAPI.create(uid.value!, payload),
        onSuccess: () => {
            qc.invalidateQueries({
                queryKey: ['generalExamResults'],
                exact: false,
            })
        },
    })
}
