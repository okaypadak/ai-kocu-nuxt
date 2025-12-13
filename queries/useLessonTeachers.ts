import { useQuery } from '@tanstack/vue-query'
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

  return useQuery<LessonTeacher[]>({
    enabled: () => !!cid.value && (lessons.value?.length ?? 0) > 0,
    queryKey: computed(() =>
      qk.lessonTeachers(cid.value ?? '', (lessons.value ?? []).join('-'))
    ),
    queryFn: () => listLessonTeachers({ curriculumId: cid.value!, lessonIds: lessons.value ?? [] }),
    placeholderData: (prev) => prev,
    staleTime: 60_000,
  })
}
