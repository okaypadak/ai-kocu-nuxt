<!-- src/views/CurriculaAdminView.vue -->
<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue'
import { useQuery, useQueryClient } from '@tanstack/vue-query'
import { useToast } from 'vue-toastification'
import Navbar from '../components/Navbar.vue'
import {
  CurriculumAPI,
  type Curriculum,
  type LessonWithTopics,
  type SectionWithLessons,
  type Topic
} from '../api/curriculum'
import { qk } from '../queries/keys'

type DraftMap<T> = Record<string | number, T>

const toast = useToast()
const queryClient = useQueryClient()

const selectedCurriculumId = ref<string | null>(null)
const creatingNew = ref(false)
const curriculumSaving = ref(false)
const curriculumDeleting = ref(false)

const formState = reactive({
  id: '',
  exam: '',
  version: '',
  notesText: ''
})

const newSection = reactive({ code: '', name: '' })
const newLessonInputs = ref<DraftMap<{ code: string; name: string }>>({})
const newTopicInputs = ref<DraftMap<{ title: string }>>({})

const sectionDrafts = ref<DraftMap<{ code: string; name: string }>>({})
const lessonDrafts = ref<DraftMap<{ code: string; name: string }>>({})
const topicDrafts = ref<DraftMap<{ title: string }>>({})

const sectionSavingId = ref<number | null>(null)
const sectionDeletingId = ref<number | null>(null)
const lessonSavingId = ref<number | null>(null)
const lessonDeletingId = ref<number | null>(null)
const topicSavingId = ref<string | null>(null)
const topicCreatingFor = ref<number | null>(null)
const topicDeletingId = ref<string | null>(null)

function generateCurriculumId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `cur-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`
}

const { data: curriculaData, isFetching: curriculaLoading, error: curriculaError } = useQuery({
  queryKey: qk.curricula,
  queryFn: CurriculumAPI.fetchAll,
})

const curriculaList = computed(() => curriculaData.value ?? [])

const treeQuery = useQuery({
  enabled: computed(() => !!selectedCurriculumId.value && !creatingNew.value),
  queryKey: computed(() => qk.tree(selectedCurriculumId.value ?? '')),
  queryFn: () => CurriculumAPI.fetchTree(selectedCurriculumId.value!),
})

const sectionList = computed<SectionWithLessons[]>(() => treeQuery.data.value?.sections ?? [])

const treeStats = computed(() => {
  const sections = treeQuery.data.value?.sections ?? []
  let lessons = 0
  let topics = 0
  sections.forEach((section) => {
    lessons += section.lessons.length
    section.lessons.forEach((lesson) => {
      topics += lesson.topics.length
    })
  })
  return {
    sections: sections.length,
    lessons,
    topics
  }
})

function clearForm() {
  formState.id = ''
  formState.exam = ''
  formState.version = ''
  formState.notesText = ''
}

function fillForm(entry: Curriculum) {
  formState.id = entry.id
  formState.exam = entry.exam
  formState.version = entry.version
  formState.notesText = (entry.notes ?? []).join('\n')
}

watch(
  curriculaList,
  (list) => {
    if (creatingNew.value) return
    if (!list || !list.length) {
      selectedCurriculumId.value = null
      clearForm()
      return
    }
    if (selectedCurriculumId.value && list.some((c) => c.id === selectedCurriculumId.value)) return
    selectedCurriculumId.value = list[0]!.id
  },
  { immediate: true }
)

watch(
  [selectedCurriculumId, curriculaList],
  () => {
    if (creatingNew.value) return
    const id = selectedCurriculumId.value
    if (!id) {
      clearForm()
      return
    }
    const match = curriculaList.value.find((c) => c.id === id)
    if (match) fillForm(match)
  },
  { immediate: true }
)

watch(
  () => treeQuery.data.value,
  (tree) => {
    const sections = tree?.sections ?? []
    const sectionMap: DraftMap<{ code: string; name: string }> = {}
    const lessonMap: DraftMap<{ code: string; name: string }> = {}
    const topicMap: DraftMap<{ title: string }> = {}
    sections.forEach((section) => {
      sectionMap[section.id] = { code: section.code, name: section.name }
      section.lessons.forEach((lesson) => {
        lessonMap[lesson.id] = { code: lesson.code, name: lesson.name }
        lesson.topics.forEach((topic) => {
          topicMap[topic.id] = { title: topic.title }
        })
      })
    })
    sectionDrafts.value = sectionMap
    lessonDrafts.value = lessonMap
    topicDrafts.value = topicMap
  },
  { immediate: true }
)

function splitNotes(text: string): string[] | null {
  const lines = text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
  return lines.length ? lines : null
}

function getSortedTopics(lesson: LessonWithTopics): Topic[] {
  return [...lesson.topics].sort((a, b) => {
    const aVal = a.sort_order ?? 9_999
    const bVal = b.sort_order ?? 9_999
    if (aVal === bVal) return a.id.localeCompare(b.id)
    return aVal - bVal
  })
}

function findLessonById(lessonId: number): LessonWithTopics | null {
  for (const section of sectionList.value) {
    const lesson = section.lessons.find((l) => l.id === lessonId)
    if (lesson) return lesson
  }
  return null
}

function nextTopicOrder(lessonId: number): number {
  const lesson = findLessonById(lessonId)
  return (lesson?.topics.length ?? 0) + 1
}

const canSaveCurriculum = computed(() => {
  return formState.id.trim().length > 0 && formState.exam.trim().length > 0
})

function selectCurriculum(id: string) {
  creatingNew.value = false
  selectedCurriculumId.value = id
}

function beginNewCurriculum() {
  creatingNew.value = true
  selectedCurriculumId.value = null
  clearForm()
  formState.id = generateCurriculumId()
}

function hydrateNewLessonInput(sectionId: number) {
  if (!newLessonInputs.value[sectionId]) {
    newLessonInputs.value[sectionId] = { code: '', name: '' }
  }
  return newLessonInputs.value[sectionId]
}

function hydrateNewTopicInput(lessonId: number) {
  if (!newTopicInputs.value[lessonId]) {
    newTopicInputs.value[lessonId] = { title: '' }
  }
  return newTopicInputs.value[lessonId]
}

function sectionDraft(sectionId: number) {
  if (!sectionDrafts.value[sectionId]) {
    sectionDrafts.value[sectionId] = { code: '', name: '' }
  }
  return sectionDrafts.value[sectionId]
}

function lessonDraft(lessonId: number) {
  if (!lessonDrafts.value[lessonId]) {
    lessonDrafts.value[lessonId] = { code: '', name: '' }
  }
  return lessonDrafts.value[lessonId]
}

function topicDraft(topicId: string) {
  if (!topicDrafts.value[topicId]) {
    topicDrafts.value[topicId] = { title: '' }
  }
  return topicDrafts.value[topicId]
}

function handleError(message: string, error?: unknown) {
  console.error(message, error)
  toast.error((error as Error)?.message ?? message)
}

function invalidateCurrentTree(targetId?: string | null) {
  const id = targetId ?? selectedCurriculumId.value
  if (!id) return
  queryClient.invalidateQueries({ queryKey: qk.tree(id) })
}

async function onSaveCurriculum() {
  if (!canSaveCurriculum.value) {
    toast.error('ID ve sınav alanlarını doldurun')
    return
  }
  curriculumSaving.value = true
  try {
    const id = formState.id.trim() || generateCurriculumId()
    formState.id = id
    const payload: Curriculum = {
      id,
      exam: formState.exam.trim(),
      version: formState.version.trim(),
      notes: splitNotes(formState.notesText)
    }
    const saved = await CurriculumAPI.saveCurriculum(payload)
    queryClient.invalidateQueries({ queryKey: qk.curricula })
    if (saved.id) {
      selectedCurriculumId.value = saved.id
      creatingNew.value = false
      invalidateCurrentTree(saved.id)
    }
    toast.success('Müfredat kaydedildi')
  } catch (err) {
    handleError('Müfredat kaydedilemedi', err)
  } finally {
    curriculumSaving.value = false
  }
}

async function onDeleteCurriculum() {
  if (!selectedCurriculumId.value) return
  if (!confirm('Bu müfredatı silmek istediğinizden emin misiniz?')) return
  curriculumDeleting.value = true
  const currId = selectedCurriculumId.value
  try {
    await CurriculumAPI.removeCurriculum(currId!)
    queryClient.invalidateQueries({ queryKey: qk.curricula })
    invalidateCurrentTree(currId)
    selectedCurriculumId.value = null
    clearForm()
    toast.success('Müfredat silindi')
  } catch (err) {
    handleError('Müfredat silinemedi', err)
  } finally {
    curriculumDeleting.value = false
  }
}

async function onCreateSection() {
  if (!selectedCurriculumId.value) return
  if (!newSection.code.trim() || !newSection.name.trim()) {
    toast.error('Bölüm kodu ve adı gerekli')
    return
  }
  try {
    await CurriculumAPI.createSection(selectedCurriculumId.value, {
      code: newSection.code.trim(),
      name: newSection.name.trim()
    })
    newSection.code = ''
    newSection.name = ''
    invalidateCurrentTree()
    toast.success('Bölüm oluşturuldu')
  } catch (err) {
    handleError('Bölüm oluşturulamadı', err)
  } finally {
    sectionSavingId.value = null
  }
}

async function onUpdateSection(sectionId: number) {
  const draft = sectionDraft(sectionId)
  if (!draft.code.trim() || !draft.name.trim()) {
    toast.error('Bölüm kodu ve adı boş bırakılamaz')
    return
  }
  sectionSavingId.value = sectionId
  try {
    await CurriculumAPI.updateSection(sectionId, {
      code: draft.code.trim(),
      name: draft.name.trim()
    })
    invalidateCurrentTree()
    toast.success('Bölüm güncellendi')
  } catch (err) {
    handleError('Bölüm güncellenemedi', err)
  } finally {
    sectionSavingId.value = null
  }
}

async function onDeleteSection(sectionId: number) {
  if (!confirm('Bu bölümü ve içindeki dersleri silmek istiyor musunuz?')) return
  sectionDeletingId.value = sectionId
  try {
    await CurriculumAPI.deleteSection(sectionId)
    invalidateCurrentTree()
    toast.success('Bölüm silindi')
  } catch (err) {
    handleError('Bölüm silinemedi', err)
  } finally {
    sectionDeletingId.value = null
  }
}

async function onCreateLesson(sectionId: number) {
  const input = hydrateNewLessonInput(sectionId)
  if (!input.code.trim() || !input.name.trim()) {
    toast.error('Ders kodu ve adı gerekli')
    return
  }
    lessonSavingId.value = sectionId
    try {
      await CurriculumAPI.createLesson(sectionId, {
        code: input.code.trim(),
        name: input.name.trim()
      })
    input.code = ''
    input.name = ''
    invalidateCurrentTree()
    toast.success('Ders oluşturuldu')
  } catch (err) {
    handleError('Ders oluşturulamadı', err)
  } finally {
    lessonSavingId.value = null
  }
}

async function onUpdateLesson(lessonId: number) {
  const draft = lessonDraft(lessonId)
  if (!draft.code.trim() || !draft.name.trim()) {
    toast.error('Ders kodu ve adı boş bırakılamaz')
    return
  }
  lessonSavingId.value = lessonId
  try {
    await CurriculumAPI.updateLesson(lessonId, {
      code: draft.code.trim(),
      name: draft.name.trim()
    })
    invalidateCurrentTree()
    toast.success('Ders güncellendi')
  } catch (err) {
    handleError('Ders güncellenemedi', err)
  } finally {
    lessonSavingId.value = null
  }
}

async function onDeleteLesson(lessonId: number) {
  if (!confirm('Bu dersi ve konularını silmek istediğinize emin misiniz?')) return
  lessonDeletingId.value = lessonId
  try {
    await CurriculumAPI.deleteLesson(lessonId)
    invalidateCurrentTree()
    toast.success('Ders silindi')
  } catch (err) {
    handleError('Ders silinemedi', err)
  } finally {
    lessonDeletingId.value = null
  }
}

function generateTopicId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `topic-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

async function onCreateTopic(lessonId: number) {
  const input = hydrateNewTopicInput(lessonId)
  if (!input.title.trim()) {
    toast.error('Konu başlığı girin')
    return
  }
  topicCreatingFor.value = lessonId
  try {
    await CurriculumAPI.createTopic(lessonId, {
      id: generateTopicId(),
      title: input.title.trim(),
      sort_order: nextTopicOrder(lessonId)
    })
    input.title = ''
    invalidateCurrentTree()
    toast.success('Konu oluşturuldu')
  } catch (err) {
    handleError('Konu oluşturulamadı', err)
  } finally {
    topicCreatingFor.value = null
  }
}

async function onUpdateTopic(topicId: string, currentOrder: number | null) {
  const draft = topicDraft(topicId)
  if (!draft.title.trim()) {
    toast.error('Konu başlığı boş bırakılamaz')
    return
  }
  topicSavingId.value = topicId
  try {
    await CurriculumAPI.updateTopic(topicId, { title: draft.title.trim(), sort_order: currentOrder })
    invalidateCurrentTree()
    toast.success('Konu güncellendi')
  } catch (err) {
    handleError('Konu güncellenemedi', err)
  } finally {
    topicSavingId.value = null
  }
}

async function onMoveTopic(topicId: string, lessonId: number, direction: 'up' | 'down') {
  const lesson = findLessonById(lessonId)
  if (!lesson) return
  const sorted = getSortedTopics(lesson)
  const currentIndex = sorted.findIndex((t) => t.id === topicId)
  if (currentIndex === -1) return
  const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1
  if (targetIndex < 0 || targetIndex >= sorted.length) return

  const orderMap: Record<string, number> = {}
  sorted.forEach((topic, index) => {
    orderMap[topic.id] = topic.sort_order ?? index + 1
  })

  const updated = [...sorted]
  const currentTopic = updated[currentIndex]!
  const targetTopic = updated[targetIndex]!
  updated[currentIndex] = targetTopic
  updated[targetIndex] = currentTopic

  const updates = updated
    .map((topic, index) => ({
      id: topic.id,
      newOrder: index + 1,
      oldOrder: orderMap[topic.id]
    }))
    .filter((rec) => rec.newOrder !== rec.oldOrder)

  if (!updates.length) return

  topicSavingId.value = topicId
  try {
    await Promise.all(
      updates.map((rec) =>
        CurriculumAPI.updateTopic(rec.id, {
          sort_order: rec.newOrder
        })
      )
    )
    invalidateCurrentTree()
    toast.success('Konu sıralaması güncellendi')
  } catch (err) {
    handleError('Konu sıralaması güncellenemedi', err)
  } finally {
    topicSavingId.value = null
  }
}

async function onDeleteTopic(topicId: string) {
  if (!confirm('Bu konuyu silmek istediğinizden emin misiniz?')) return
  topicDeletingId.value = topicId
  try {
    await CurriculumAPI.deleteTopic(topicId)
    invalidateCurrentTree()
    toast.success('Konu silindi')
  } catch (err) {
    handleError('Konu silinemedi', err)
  } finally {
    topicDeletingId.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-slate-50 flex flex-col">
    <header class="px-4">
      <Navbar />
    </header>

    <main class="flex-grow px-4 py-8">
      <div class="mx-auto w-full max-w-6xl space-y-6">
        <section class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
          <div class="space-y-2">
            <p class="text-xs font-semibold uppercase tracking-[0.2em] text-sky-500">Yönetici</p>
            <h1 class="text-3xl font-bold text-slate-900">Müfredat Yönetimi</h1>
            <p class="text-sm text-slate-600">
              Müfredatlar, bölümler, dersler ve konular üzerinde düzenlemeler yapın. Yeni müfredatlar
              oluşturabilir, mevcutları güncelleyebilir veya kaldırabilirsiniz.
            </p>
          </div>
        </section>

        <section class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl">
          <div class="flex items-center justify-between gap-4">
            <div>
              <h2 class="text-xl font-semibold text-slate-900">Müfredat Listesi</h2>
              <p class="text-sm text-slate-500">Satırları tıklayarak düzenlemek istediğiniz müfredatı seçin.</p>
            </div>
            <button
              @click="beginNewCurriculum"
              class="rounded-full bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white shadow hover:bg-sky-700"
            >
              Yeni Müfredat
            </button>
          </div>
          <div class="mt-6 space-y-4">
            <div v-if="curriculaLoading" class="text-sm text-slate-500">Müfredatlar yükleniyor…</div>
            <div v-else-if="curriculaError" class="text-sm text-red-600">
              {{ (curriculaError as any)?.message ?? curriculaError }}
            </div>
            <div v-else>
              <div v-if="!curriculaList.length" class="text-sm text-slate-500">
                Henüz müfredat yok. Yeni müfredat oluşturun.
              </div>
              <div v-else class="overflow-x-auto">
                <table class="min-w-full text-sm text-left">
                  <thead class="text-xs uppercase tracking-[0.2em] text-slate-500">
                    <tr>
                      <th class="px-4 py-3">ID</th>
                      <th class="px-4 py-3">Sınav</th>
                      <th class="px-4 py-3">Versiyon</th>
                      <th class="px-4 py-3">Notlar</th>
                      <th class="px-4 py-3 text-right">Durum</th>
                    </tr>
                  </thead>
                  <tbody class="text-slate-700">
                    <tr
                      v-for="curriculum in curriculaList"
                      :key="curriculum.id"
                      @click="selectCurriculum(curriculum.id)"
                      class="cursor-pointer border-t border-slate-100 transition hover:bg-slate-50"
                      :class="{
                        'bg-sky-50 border-sky-300': !creatingNew && selectedCurriculumId === curriculum.id
                      }"
                    >
                      <td class="px-4 py-3 font-semibold text-slate-900">{{ curriculum.id }}</td>
                      <td class="px-4 py-3">{{ curriculum.exam || '—' }}</td>
                      <td class="px-4 py-3">{{ curriculum.version || '—' }}</td>
                      <td class="px-4 py-3 text-xs text-slate-500">
                        <span v-if="curriculum.notes?.length">{{ curriculum.notes.length }} not</span>
                        <span v-else>Not yok</span>
                      </td>
                      <td class="px-4 py-3 text-right text-xs uppercase tracking-[0.2em] text-slate-500">
                        {{ selectedCurriculumId === curriculum.id ? 'Seçili' : 'Tıkla' }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        <section class="rounded-[28px] border border-slate-200 bg-white p-6 shadow-2xl space-y-6">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-2xl font-semibold text-slate-900">
                {{ creatingNew ? 'Yeni Müfredat' : 'Müfredat Detayı' }}
              </h2>
              <p class="text-sm text-slate-500">
                {{ creatingNew ? 'ID girerek yeni müfredat oluşturun.' : (selectedCurriculumId || 'Bir müfredat seçin.') }}
              </p>
            </div>
            <div class="text-right text-xs uppercase tracking-[0.2em] text-slate-400">
              {{ treeStats.sections }} / {{ treeStats.lessons }} / {{ treeStats.topics }}
            </div>
          </div>

          <div class="grid gap-3 md:grid-cols-3">
            <label class="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              ID
              <input
                v-model="formState.id"
                readonly
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-400"
                placeholder="Otomatik UUID"
              />
              <div v-if="creatingNew" class="pt-2">
                <button
                  type="button"
                  class="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-600 hover:border-slate-300"
                  @click="formState.id = generateCurriculumId()"
                >
                  ID Yenile
                </button>
              </div>
              <span class="text-[11px] font-normal text-slate-500">UUID otomatik uretilir.</span>
            </label>
            <label class="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Sınav
              <input
                v-model="formState.exam"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-400"
                placeholder="örn. KPSS Ön Lisans"
              />
            </label>
            <label class="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
              Versiyon
              <input
                v-model="formState.version"
                class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-400"
                placeholder="örn. 2025-1"
              />
            </label>
          </div>

          <div class="space-y-1 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Notlar
            <textarea
              v-model="formState.notesText"
              rows="3"
              class="w-full rounded-2xl border border-slate-200 px-3 py-2 text-sm transition focus:border-sky-400"
              placeholder="Her satır bir not"
            ></textarea>
          </div>

          <div class="flex flex-wrap items-center gap-3">
            <button
              @click="onSaveCurriculum"
              :disabled="curriculumSaving || !canSaveCurriculum"
              class="rounded-2xl bg-sky-600 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ curriculumSaving ? 'Kaydediliyor…' : (creatingNew ? 'Oluştur' : 'Güncelle') }}
            </button>
            <button
              v-if="!creatingNew"
              @click="onDeleteCurriculum"
              :disabled="curriculumDeleting"
              class="rounded-2xl border border-red-300 px-5 py-2.5 text-sm font-semibold uppercase tracking-[0.2em] text-red-600 transition hover:border-red-500 hover:text-red-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {{ curriculumDeleting ? 'Siliniyor…' : 'Sil' }}
            </button>
            <span class="text-xs text-slate-500">
              {{ creatingNew ? 'Yeni müfredat listede görünecek.' : 'Kaydetmeden önce değişiklikleri kontrol edin.' }}
            </span>
          </div>

          <div v-if="creatingNew || !selectedCurriculumId" class="text-sm text-slate-500">
            Bölümler, dersler ve konular seçtikten sonra görüntülenir.
          </div>

          <div v-else class="space-y-6">
            <div class="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 space-y-3">
              <div class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Yeni Bölüm</div>
              <div class="grid gap-3 md:grid-cols-2">
                <input
                  v-model="newSection.code"
                  class="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Kod"
                />
                <input
                  v-model="newSection.name"
                  class="rounded-xl border border-slate-200 px-3 py-2 text-sm"
                  placeholder="Bölüm adı"
                />
              </div>
              <button
                class="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
                @click="onCreateSection"
              >
                Bölüm Oluştur
              </button>
            </div>

            <div v-if="!sectionList.length" class="text-sm text-slate-500">
              Bu müfredat için henüz bölüm yok.
            </div>

            <div v-else class="space-y-4">
              <div
                v-for="section in sectionList"
                :key="section.id"
                class="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4"
              >
                <div class="flex flex-wrap items-end justify-between gap-3">
                  <div class="grid flex-1 gap-3 md:grid-cols-2">
                    <label class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Kod
                      <input
                        v-model="sectionDraft(section.id).code"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                    <label class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                      Ad
                      <input
                        v-model="sectionDraft(section.id).name"
                        class="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      />
                    </label>
                  </div>
                  <div class="flex items-center gap-2">
                    <button
                      @click="onUpdateSection(section.id)"
                      :disabled="sectionSavingId === section.id"
                      class="rounded-2xl bg-sky-600 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-sky-700 disabled:opacity-60"
                    >
                      {{ sectionSavingId === section.id ? 'Kaydediliyor…' : 'Kaydet' }}
                    </button>
                    <button
                      @click="onDeleteSection(section.id)"
                      :disabled="sectionDeletingId === section.id"
                      class="rounded-2xl border border-red-200 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-red-600 transition hover:border-red-400 hover:text-red-700 disabled:opacity-60"
                    >
                      Sil
                    </button>
                  </div>
                </div>

                <div class="overflow-x-auto rounded-2xl border border-slate-200">
                  <table class="min-w-full text-sm text-left">
                    <thead class="bg-slate-50 text-xs uppercase tracking-[0.2em] text-slate-500">
                      <tr>
                        <th class="px-4 py-3">Kod</th>
                        <th class="px-4 py-3">Ders</th>
                        <th class="px-4 py-3 text-right">İşlemler</th>
                      </tr>
                    </thead>
                    <tbody>
                      <template v-for="lesson in section.lessons" :key="`lesson-${lesson.id}`">
                        <tr class="border-t border-slate-100">
                          <td class="px-4 py-3">
                            <input
                              v-model="lessonDraft(lesson.id).code"
                              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Kod"
                            />
                          </td>
                          <td class="px-4 py-3">
                            <input
                              v-model="lessonDraft(lesson.id).name"
                              class="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Ders adı"
                            />
                          </td>
                          <td class="px-4 py-3">
                            <div class="flex flex-wrap justify-end gap-2">
                              <button
                                @click="onUpdateLesson(lesson.id)"
                                :disabled="lessonSavingId === lesson.id"
                                class="rounded-2xl bg-sky-600 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-sky-700 disabled:opacity-60"
                              >
                                {{ lessonSavingId === lesson.id ? 'Kaydediliyor…' : 'Kaydet' }}
                              </button>
                              <button
                                @click="onDeleteLesson(lesson.id)"
                                :disabled="lessonDeletingId === lesson.id"
                                class="rounded-2xl border border-red-200 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-red-600 transition hover:border-red-400 hover:text-red-700 disabled:opacity-60"
                              >
                                Sil
                              </button>
                            </div>
                          </td>
                        </tr>
                        <tr class="bg-slate-50">
                          <td colspan="3" class="px-4 py-3">
                            <div class="space-y-3">
                              <div class="flex items-center justify-between">
                                <span class="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                                  Konular ({{ getSortedTopics(lesson).length }})
                                </span>
                                <span class="text-xs text-slate-400">
                                  {{ getSortedTopics(lesson).length ? '' : 'Henüz konu yok' }}
                                </span>
                              </div>
                              <div class="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
                                <table class="min-w-full text-xs text-left">
                                  <thead class="bg-slate-50 text-[0.6rem] uppercase tracking-[0.3em] text-slate-500">
                                    <tr>
                                      <th class="px-3 py-2 w-12">Sıra</th>
                                      <th class="px-3 py-2">Konu</th>
                                      <th class="px-3 py-2 text-right">İşlemler</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    <tr
                                      v-for="(topic, index) in getSortedTopics(lesson)"
                                      :key="topic.id"
                                      class="border-t border-slate-100"
                                    >
                                      <td class="px-3 py-2 text-[0.75rem] text-slate-400">
                                        {{ topic.sort_order ?? index + 1 }}
                                      </td>
                                      <td class="px-3 py-2">
                                        <input
                                          v-model="topicDraft(topic.id).title"
                                          class="w-full rounded-xl border border-slate-200 px-2 py-1 text-xs"
                                          placeholder="Konu başlığı"
                                        />
                                      </td>
                                      <td class="px-3 py-2">
                                        <div class="flex flex-wrap justify-end gap-1">
                                          <button
                                            @click="onUpdateTopic(topic.id, topic.sort_order ?? index + 1)"
                                            :disabled="topicSavingId === topic.id"
                                            class="rounded-2xl bg-slate-100 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                                          >
                                            {{ topicSavingId === topic.id ? 'Kaydediliyor…' : 'Kaydet' }}
                                          </button>
                                          <button
                                            @click="onDeleteTopic(topic.id)"
                                            :disabled="topicDeletingId === topic.id"
                                            class="rounded-2xl border border-red-200 px-3 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-red-600 transition hover:border-red-400 hover:text-red-700 disabled:opacity-60"
                                          >
                                            Sil
                                          </button>
                                          <button
                                            @click="onMoveTopic(topic.id, lesson.id, 'up')"
                                            :disabled="topicSavingId === topic.id"
                                            class="rounded-2xl border border-slate-200 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-400 disabled:opacity-60"
                                          >
                                            ▲
                                          </button>
                                          <button
                                            @click="onMoveTopic(topic.id, lesson.id, 'down')"
                                            :disabled="topicSavingId === topic.id"
                                            class="rounded-2xl border border-slate-200 px-2 py-1 text-[0.6rem] font-semibold uppercase tracking-[0.3em] text-slate-600 transition hover:border-slate-400 disabled:opacity-60"
                                          >
                                            ▼
                                          </button>
                                        </div>
                                      </td>
                                    </tr>
                                  </tbody>
                                </table>
                              </div>
                              <div class="flex flex-wrap gap-2">
                                <input
                                  v-model="hydrateNewTopicInput(lesson.id).title"
                                  class="flex-1 min-w-[180px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                                  placeholder="Yeni konu"
                                />
                                <button
                                  @click="onCreateTopic(lesson.id)"
                                  :disabled="topicCreatingFor === lesson.id"
                                  class="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                                >
                                  {{ topicCreatingFor === lesson.id ? 'Ekleniyor…' : 'Konu Ekle' }}
                                </button>
                              </div>
                            </div>
                          </td>
                        </tr>
                      </template>
                      <tr class="bg-slate-50">
                        <td colspan="3" class="px-4 py-3">
                          <div class="flex flex-wrap gap-2">
                            <input
                              v-model="hydrateNewLessonInput(section.id).code"
                              class="flex-1 min-w-[150px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Yeni ders kodu"
                            />
                            <input
                              v-model="hydrateNewLessonInput(section.id).name"
                              class="flex-1 min-w-[150px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                              placeholder="Yeni ders adı"
                            />
                            <button
                              @click="onCreateLesson(section.id)"
                              :disabled="lessonSavingId === section.id"
                              class="rounded-2xl bg-slate-100 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-700 transition hover:bg-slate-200 disabled:opacity-60"
                            >
                              {{ lessonSavingId === section.id ? 'Ekleniyor…' : 'Ders Ekle' }}
                            </button>
                          </div>
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
