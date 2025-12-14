import { computed, unref, type ComputedRef, type Ref } from 'vue'
import { listLessonTeachers, type LessonTeacher } from '../api/youtubePlaylists'
import { qk } from './keys'

type MaybeReactive<T> = T | Ref<T> | ComputedRef<T> | (() => T)
const toVal = <T,>(src: MaybeReactive<T>) =>
  typeof src === 'function' ? computed(() => (src as any)()) : computed(() => unref(src as any))

export function useLessonTeachers(
  curriculumId: MaybeReactive<string | null | undefined>,
  lessonIds: MaybeReactive<number[]>
) {
  const cid = toVal(curriculumId)
  const lessons = toVal(lessonIds)
  
  const key = computed(() => 
      qk.lessonTeachers(cid.value ?? '', (lessons.value ?? []).join('-')).join(':')
  )

  const { data, pending, error, refresh } = useAsyncData<LessonTeacher[]>(
      key.value,
      () => {
          if (!cid.value || (lessons.value?.length ?? 0) === 0) return Promise.resolve([])
          return listLessonTeachers({ curriculumId: cid.value!, lessonIds: lessons.value ?? [] })
      },
      {
          watch: [cid, lessons],
          placeholderData: (prev) => prev
          // staleTime default behavior
      }
  )

  return { data, isLoading: pending, error, refetch: refresh }
}
