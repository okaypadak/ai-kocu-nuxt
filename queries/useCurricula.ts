// src/queries/useCurricula.ts
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
    const client = useSupabaseClient()
    const key = computed(() => qk.curricula.join(':'))
    const { data, pending, error, refresh } = useAsyncData<Curriculum[]>(
        key.value,
        () => CurriculumAPI.fetchAll(client),
        {
            // staleTime handled by Nuxt default or manual
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

export function useSections(curriculumId: MaybeReactive<string | null | undefined>) {
    const client = useSupabaseClient()
    const id = toVal(curriculumId) // string|null|undefined
    const key = computed(() => qk.sections(id.value ?? '').join(':'))
    
    const { data, pending, error, refresh } = useAsyncData<Section[]>(
        key.value,
        () => {
            if (!id.value) return Promise.resolve([])
            return CurriculumAPI.fetchSectionsByCurriculumId(client, id.value)
        },
        {
            watch: [id],
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

export function useLessons(sectionId: MaybeReactive<number | undefined>) {
    const client = useSupabaseClient()
    const id = toVal(sectionId)
    const key = computed(() => qk.lessons(String(id.value ?? '')).join(':'))

    const { data, pending, error, refresh } = useAsyncData<Lesson[]>(
        key.value,
        () => {
             if (!id.value) return Promise.resolve([])
             return CurriculumAPI.fetchLessonsBySectionId(client, id.value)
        },
        {
            watch: [id],
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

export function useTopics(lessonId: MaybeReactive<number | undefined>) {
    const client = useSupabaseClient()
    const id = toVal(lessonId)
    const key = computed(() => qk.topics(String(id.value ?? '')).join(':'))
    
    const { data, pending, error, refresh } = useAsyncData<Topic[]>(
        key.value,
        async () => {
             if (!id.value) return Promise.resolve([])
             const rows = await CurriculumAPI.fetchTopicsByLessonId(client, id.value)
             return [...rows].sort((a, b) => {
                const sa = a.sort_order ?? 9_999
                const sb = b.sort_order ?? 9_999
                return sa === sb ? String(a.id).localeCompare(String(b.id)) : sa - sb
            })
        },
        {
            watch: [id],
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

export function useCurriculumTree(curriculumId: MaybeReactive<string | null | undefined>) {
    const client = useSupabaseClient()
    const id = toVal(curriculumId)
    const key = computed(() => qk.tree(id.value ?? '').join(':'))
    
    const { data, pending, error, refresh } = useAsyncData<CurriculumTree>(
        key.value,
        () => {
            if (!id.value) return Promise.resolve({})
            return CurriculumAPI.fetchTree(client, id.value)
        },
        {
            watch: [id],
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}

export function useCurriculumStats(curriculumId: MaybeReactive<string | null | undefined>) {
    const client = useSupabaseClient()
    const id = toVal(curriculumId)
    const key = computed(() => qk.stats(id.value ?? '').join(':'))
    
    const { data, pending, error, refresh } = useAsyncData<{ sections: number; lessons: number; topics: number }>(
        key.value,
        () => {
            if (!id.value) return Promise.resolve({ sections: 0, lessons: 0, topics: 0 })
            return CurriculumAPI.fetchStats(client, id.value)
        },
        {
            watch: [id],
        }
    )
    return { data, isLoading: pending, error, refetch: refresh }
}
