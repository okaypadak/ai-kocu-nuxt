import { useQuery } from '@tanstack/vue-query'
import { qk } from './keys'
import { computed, unref, type Ref, type ComputedRef } from 'vue'
import {
    CurriculumAPI,
    type Curriculum,
    type Section,
    type Lesson,
    type Topic,
    type CurriculumTree,
} from '../api/curriculum'

// değer | ref | computed | getter kabul et
type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
    typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

export function useCurricula() {
    return useQuery<Curriculum[]>({
        queryKey: qk.curricula,
        queryFn: () => CurriculumAPI.fetchAll(),
        staleTime: 5 * 60_000,
        placeholderData: (p) => p,
    })
}

export function useSections(curriculumId: MaybeReactive<string | null | undefined>) {
    const id = toVal(curriculumId) // string|null|undefined
    return useQuery<Section[]>({
        enabled: () => !!id.value,
        queryKey: computed(() => qk.sections(id.value ?? '')),
        queryFn: () => CurriculumAPI.fetchSectionsByCurriculumId(id.value!),
        staleTime: 5 * 60_000,
        placeholderData: (p) => p,
    })
}

export function useLessons(sectionId: MaybeReactive<number | undefined>) {
    const id = toVal(sectionId)
    return useQuery<Lesson[]>({
        enabled: () => !!id.value,
        queryKey: computed(() => qk.lessons(String(id.value ?? ''))),
        queryFn: () => CurriculumAPI.fetchLessonsBySectionId(id.value!),
        staleTime: 5 * 60_000,
        placeholderData: (p) => p,
    })
}

export function useTopics(lessonId: MaybeReactive<number | undefined>) {
    const id = toVal(lessonId)
    return useQuery<Topic[]>({
        enabled: () => !!id.value,
        queryKey: computed(() => qk.topics(String(id.value ?? ''))),
        queryFn: () => CurriculumAPI.fetchTopicsByLessonId(id.value!),
        select: (rows) =>
            [...rows].sort((a, b) => {
                const sa = a.sort_order ?? 9_999
                const sb = b.sort_order ?? 9_999
                return sa === sb ? String(a.id).localeCompare(String(b.id)) : sa - sb
            }),
        staleTime: 5 * 60_000,
        placeholderData: (p) => p,
    })
}

export function useCurriculumTree(curriculumId: MaybeReactive<string | null | undefined>) {
    const id = toVal(curriculumId)
    return useQuery<CurriculumTree>({
        enabled: () => !!id.value,
        queryKey: computed(() => qk.tree(id.value ?? '')),
        queryFn: () => CurriculumAPI.fetchTree(id.value!),
        staleTime: 10 * 60_000,
        placeholderData: (p) => p,
    })
}

export function useCurriculumStats(curriculumId: MaybeReactive<string | null | undefined>) {
    const id = toVal(curriculumId)
    return useQuery<{ sections: number; lessons: number; topics: number }>({
        enabled: () => !!id.value,
        queryKey: computed(() => qk.stats(id.value ?? '')),
        queryFn: () => CurriculumAPI.fetchStats(id.value!),
        staleTime: 2 * 60_000,
        placeholderData: (p) => p,
    })
}
