<!-- src/views/DersProgramiView.vue -->
<script setup lang="ts">
import { ref, computed, watch, nextTick, onBeforeUnmount, shallowRef } from 'vue'
import { useToast } from 'vue-toastification'
import Navbar from '../components/Navbar.vue'
import CurriculumPicker from '../components/CurriculumPicker.vue'
import { useAuthStore } from '../stores/auth.store'
import { useStudyPlan, useUpsertStudyPlan, useTopicDurationsForWeek } from '../queries/useStudyPlans'
import { useRouter } from 'vue-router'
import { StudyPlansAPI, type StudyTask } from '../api/studyPlans'
import { qk } from '../queries/keys'
import { useCreateStudySessionFromTimer, useUpdateStudySession } from '../queries/useStudySessions'
import { secondsToMinutesRounded, todayISO } from '../api/studySessions'
import { CurriculumAPI, type Lesson } from '../api/curriculum'
import { useAsyncData, useSupabaseClient, refreshNuxtData } from '#imports'

type DayKey = 'monday'|'tuesday'|'wednesday'|'thursday'|'friday'|'saturday'|'sunday'
const days: { key: DayKey; label: string }[] = [
  { key:'monday', label:'Pazartesi' }, { key:'tuesday', label:'Salı' }, { key:'wednesday', label:'Çarşamba' },
  { key:'thursday', label:'Perşembe' }, { key:'friday', label:'Cuma' }, { key:'saturday', label:'Cumartesi' }, { key:'sunday', label:'Pazar' }
]
const TURKEY_TZ = 'Europe/Istanbul'

declare global {
  interface Window {
    YT?: any
    onYouTubeIframeAPIReady?: () => void
  }
}

/* === Auth & Hafta === */
const auth = useAuthStore()
const isPremiumActive = computed(() => auth.isPremiumActive)
const weekStart = ref(formatDate(getStartOfWeekTurkey(new Date())))
const weekRangeLabel = computed(() => {
  const s = parseDate(weekStart.value); const e = addDaysUtc(s, 6)
  return `${formatDisplayDate(s)} - ${formatDisplayDate(e)}`
})

/* === Plan & Durations === */
const { data: planDTO, isLoading: isPlannerLoading } = useStudyPlan(() => auth.userId, weekStart)
// Alias for template compatibility
const isPending = isPlannerLoading

const upsertMut = useUpsertStudyPlan(() => auth.userId, weekStart)
const { data: topicDurations } = useTopicDurationsForWeek(() => auth.userId, weekStart)

const toast = useToast()
const router = useRouter()

/* === Günlere göre görev map === */
const dayLabels: Record<DayKey, string> = {
  monday: 'Pazartesi', tuesday: 'Sali', wednesday: 'Carsamba',
  thursday: 'Persembe', friday: 'Cuma', saturday: 'Cumartesi', sunday: 'Pazar'
}
/* === Curriculum seçimi === */
const sel = ref<{ curriculumId: string|null; section: any; lesson: any; topic: any } | null>(null)
function onCurriculumChange(payload: any) { sel.value = payload }

/* === Ekle / Sil / Güncelle === */
function ensurePremiumPlan(action = 'Ders programini duzenlemek') {
  if (auth.isPremiumActive) return true
  toast.warning(`${action} icin lutfen premium kullanicisi olunuz.`)
  return false
}
function addSelected(day: DayKey) {
  const s = sel.value
  if (!s?.lesson || !s?.topic) { toast.warning('Önce bölüm/ders/konu seçin'); return }
  const task: StudyTask = {
    id: crypto.randomUUID(),
    day, title: s.topic.title, notes: buildNotes(s), completed: false,
    curriculum_id: s.curriculumId,
    section_id: s.section?.id ?? null,
    lesson_id: s.lesson?.id ?? null,
    topic_uuid: s.topic?.uuid ?? null
  }
  persistPlan(tasksAll().concat([task]), 'Müfredattan ders eklendi')
}
function removeTask(_day: DayKey, id: string) {
  persistPlan(tasksAll().filter(t => t.id !== id), 'Görev silindi')
}
function toggleTask(_day: DayKey, id: string, completed: boolean) {
  const next = tasksAll().map(t => t.id === id ? { ...t, completed } : t)
  persistPlan(next, completed ? 'Harika! Ders tamamlandı.' : 'Ders güncellendi')
}
function onToggleTask(day: DayKey, id: string, event: Event) {
  const target = event.target as HTMLInputElement
  toggleTask(day, id, target.checked)
}
function tasksAll(): StudyTask[] { return (planDTO.value?.tasks ?? []) }
function persistPlan(nextTasks: StudyTask[], successMsg?: string) {
  if (!ensurePremiumPlan()) return
  const daily = computeDaily(nextTasks)
  upsertMut.mutate({ tasks: nextTasks, daily }, { onSuccess: () => { if (successMsg) toast(successMsg) } })
}

type NoteMeta = { text: string | null; youtubeUrl: string | null }
const YOUTUBE_LINK_REGEX = /(https?:\/\/(?:www\.)?(?:youtube\.com\/[^\s]+|youtu\.be\/[^\s]+))/i

function extractNoteMeta(notes: string | null): NoteMeta {
  if (!notes) return { text: null, youtubeUrl: null }
  const match = notes.match(YOUTUBE_LINK_REGEX)
  const youtubeUrl = match ? match[0] : null
  const cleaned = youtubeUrl
    ? notes.replace(youtubeUrl, '').replace(/\s{2,}/g, ' ').trim()
    : notes.trim()
  return { text: cleaned || null, youtubeUrl }
}

const noteMetaById = computed<Record<string, NoteMeta>>(() => {
  const map: Record<string, NoteMeta> = {}
  for (const task of tasksAll()) {
    map[task.id] = extractNoteMeta(task.notes)
  }
  return map
})

const lessonIds = computed<number[]>(() => {
  const set = new Set<number>()
  for (const task of tasksAll()) {
    const raw = task.lesson_id
    const id = typeof raw === 'number' ? raw : typeof raw === 'string' ? Number(raw) : null
    if (id !== null && Number.isFinite(id)) set.add(id)
  }
  return Array.from(set).sort((a, b) => a - b)
})

const { data: lessonMap } = useAsyncData<Record<number, Lesson>>(
  computed(() => ['curriculumLessonsById', lessonIds.value.join(',')].join(':')),
  async () => {
    if (!lessonIds.value.length) return {}
    const client = useSupabaseClient()
    const lessons = await CurriculumAPI.fetchLessonsByIds(client, lessonIds.value)
    const map: Record<number, Lesson> = {}
    for (const l of lessons) map[l.id] = l
    return map
  },
  {
    watch: [lessonIds]
  }
)

/* === Ders gruplama / gorunum === */
const lessonPalette = ['#0ea5e9', '#10b981', '#f59e0b', '#a855f7', '#ef4444', '#14b8a6', '#f97316', '#3b82f6']
const expandedLessons = ref<Record<DayKey, string[]>>({
  monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
})

function lessonKey(task: StudyTask) {
  if (task.lesson_id === null || task.lesson_id === undefined) return 'no-lesson'
  return String(task.lesson_id)
}

function lessonLabel(task: StudyTask) {
  const rawId = task.lesson_id
  const lessonId = typeof rawId === 'number' ? rawId : typeof rawId === 'string' ? Number(rawId) : null
  const lessonNameFromDb = lessonId !== null ? lessonMap.value?.[lessonId]?.name : null
  if (lessonNameFromDb) return lessonNameFromDb
  const { lessonName } = extractSectionLesson(task)
  if (lessonName) return lessonName
  if (rawId !== null && rawId !== undefined) return `Ders ${rawId}`
  return 'Ders secilmemis'
}

const lessonColorMap = computed<Record<string, string>>(() => {
  const map: Record<string, string> = {}
  let idx = 0
  for (const task of tasksAll()) {
    const key = lessonKey(task)
    if (!map[key]) {
      const paletteColor = lessonPalette[idx % lessonPalette.length] ?? '#475569'
      map[key] = paletteColor
      idx++
    }
  }
  return map
})

function colorForLesson(key: string) {
  return lessonColorMap.value[key] ?? '#475569'
}

function colorWithAlpha(hex: string, alpha: number) {
  const cleaned = hex.replace('#', '')
  if (cleaned.length !== 6) return `rgba(71, 85, 105, ${alpha})`
  const parts = cleaned.match(/.{2}/g)
  if (!parts) return `rgba(71, 85, 105, ${alpha})`
  const [r, g, b] = parts.map(p => parseInt(p, 16))
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

const groupedTasksByDay = computed<Record<DayKey, { lessonKey: string; lessonLabel: string; color: string; tasks: StudyTask[] }[]>>(() => {
  const result: Record<DayKey, { lessonKey: string; lessonLabel: string; color: string; tasks: StudyTask[] }[]> = {
    monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: []
  }
  const lookup: Record<DayKey, Record<string, { lessonKey: string; lessonLabel: string; color: string; tasks: StudyTask[] }>> = {
    monday: {}, tuesday: {}, wednesday: {}, thursday: {}, friday: {}, saturday: {}, sunday: {}
  }

  for (const task of tasksAll()) {
    const day = task.day
    const key = lessonKey(task)
    const dayMap = lookup[day]
    if (!dayMap[key]) {
      dayMap[key] = {
        lessonKey: key,
        lessonLabel: lessonLabel(task),
        color: colorForLesson(key),
        tasks: []
      }
      result[day].push(dayMap[key])
    }
    dayMap[key].tasks.push(task)
  }
  return result
})

function isLessonOpen(day: DayKey, key: string) {
  return expandedLessons.value[day]?.includes(key)
}

function toggleLesson(day: DayKey, key: string) {
  const current = expandedLessons.value[day] ?? []
  const exists = current.includes(key)
  const next = exists ? current.filter(k => k !== key) : current.concat(key)
  expandedLessons.value = { ...expandedLessons.value, [day]: next }
}

watch(groupedTasksByDay, (next) => {
  const updated: Record<DayKey, string[]> = { ...expandedLessons.value }
  for (const day of Object.keys(next) as DayKey[]) {
    const openSet = new Set(expandedLessons.value[day] ?? [])
    const filtered = next[day].map(g => g.lessonKey).filter(key => openSet.has(key))
    updated[day] = filtered
  }
  expandedLessons.value = updated
})

/* === YouTube Modülü === */
const youtubeModalOpen = ref(false)
const youtubeVideoId = ref<string | null>(null)
const youtubeTask = ref<StudyTask | null>(null)
const youtubeWatchedSeconds = ref(0)
const youtubeSavedSeconds = ref(0)
const youtubePendingSeconds = ref(0)
const youtubePlayer = shallowRef<any>(null)
const youtubeStatus = ref<'idle'|'loading'|'ready'>('idle')
const youtubeSaving = ref(false)
const youtubeSessionId = ref<string | null>(null)
const youtubeNoteBase = ref('')
const youtubePlayerElId = 'studyplan-youtube-player'
let youtubeApiPromise: Promise<any> | null = null
let youtubeTickHandle: number | null = null
let youtubePlayStartedAt: number | null = null
const createFromYoutube = useCreateStudySessionFromTimer(() => auth.userId)
const updateYoutubeSession = useUpdateStudySession()

const youtubeLikeUrl = computed(() => {
  if (!youtubeVideoId.value) return null
  return `https://www.youtube.com/watch?v=${youtubeVideoId.value}`
})

function openYoutubeLikeWindow() {
  const url = youtubeLikeUrl.value
  if (!url) return
  window.open(url, '_blank', 'noopener,noreferrer')
}

function extractYoutubeId(url: string | null | undefined): string | null {
  if (!url) return null
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /v=([a-zA-Z0-9_-]{11})/,
    /\/embed\/([a-zA-Z0-9_-]{11})/,
  ]
  for (const rx of patterns) {
    const match = url.match(rx)
    if (match?.[1]) return match[1]
  }
  return null
}

function ensureYoutubeApi(): Promise<any> {
  if (window.YT?.Player) {
    youtubeStatus.value = 'ready'
    return Promise.resolve(window.YT)
  }
  if (youtubeApiPromise) return youtubeApiPromise
  youtubeStatus.value = 'loading'
  youtubeApiPromise = new Promise((resolve, reject) => {
    const existing = document.getElementById('youtube-iframe-api')
    if (!existing) {
      const tag = document.createElement('script')
      tag.id = 'youtube-iframe-api'
      tag.src = 'https://www.youtube.com/iframe_api'
      tag.onerror = () => reject(new Error('YouTube API yüklenemedi'))
      document.head.appendChild(tag)
    }
    window.onYouTubeIframeAPIReady = () => {
      youtubeStatus.value = 'ready'
      resolve(window.YT)
    }
    // Eğer script daha önce yüklendiyse ve callback çağrılmışsa kısa devre
    if (window.YT?.Player) {
      youtubeStatus.value = 'ready'
      resolve(window.YT)
    }
  })
  return youtubeApiPromise
}

async function openYoutubeModal(task: StudyTask) {
  if (!auth.userId) {
    toast.error('YouTube modülünü kullanmak için giriş yapın.')
    return
  }
  const meta = noteMetaById.value[task.id]
  const videoId = extractYoutubeId(meta?.youtubeUrl ?? null)
  if (!videoId) {
    toast.error('Geçerli bir YouTube bağlantısı bulunamadı.')
    return
  }
  youtubeTask.value = task
  youtubeVideoId.value = videoId
  youtubeWatchedSeconds.value = 0
  youtubeSavedSeconds.value = 0
  youtubePendingSeconds.value = 0
  youtubeSessionId.value = null
  youtubeNoteBase.value = `YouTube: ${task.title ?? ''}`
  youtubeModalOpen.value = true
  try {
    const api = await ensureYoutubeApi()
    await nextTick()
    initYoutubePlayer(api, videoId)
  } catch (e:any) {
    youtubeApiPromise = null
    toast.error(e?.message ?? 'YouTube oynatıcı yüklenemedi.')
    youtubeModalOpen.value = false
  }
}

function initYoutubePlayer(api: any, videoId: string) {
  destroyYoutubePlayer()
  youtubePlayer.value = new api.Player(youtubePlayerElId, {
    videoId,
    playerVars: { rel: 0, modestbranding: 1, playsinline: 1 },
    events: {
      onReady: () => { youtubeStatus.value = 'ready' },
      onStateChange: onYoutubeStateChange
    }
  })
}

function onYoutubeStateChange(event: any) {
  const state = event?.data
  if (state === window.YT?.PlayerState?.PLAYING) {
    startYoutubeTracking()
  } else {
    stopYoutubeTracking()
    if (state === window.YT?.PlayerState?.PAUSED) {
      flushYoutubeProgress('pause')
    }
    if (state === window.YT?.PlayerState?.ENDED) {
      flushYoutubeProgress('ended')
    }
  }
}

function startYoutubeTracking() {
  if (youtubePlayStartedAt === null) youtubePlayStartedAt = performance.now()
  if (youtubeTickHandle) return
  youtubeTickHandle = window.setInterval(accumulateYoutubeWatch, 1000)
}
function stopYoutubeTracking() {
  accumulateYoutubeWatch()
  if (youtubeTickHandle) {
    clearInterval(youtubeTickHandle)
    youtubeTickHandle = null
  }
  youtubePlayStartedAt = null
}
function accumulateYoutubeWatch() {
  if (youtubePlayStartedAt === null) return
  const now = performance.now()
  const diff = (now - youtubePlayStartedAt) / 1000
  if (diff <= 0) return
  youtubePlayStartedAt = now
  registerWatchedSeconds(diff)
}
function registerWatchedSeconds(sec: number) {
  if (sec <= 0) return
  youtubeWatchedSeconds.value += sec
  youtubePendingSeconds.value += sec
  if (youtubePendingSeconds.value >= 60) {
    flushYoutubeProgress('auto')
  }
}

async function flushYoutubeProgress(reason: 'auto'|'pause'|'ended'|'close' = 'auto') {
  accumulateYoutubeWatch()
  if (!youtubeTask.value) return
  const seconds = Math.floor(youtubePendingSeconds.value)
  if (seconds <= 0) return
  if (youtubeSaving.value) return
  youtubePendingSeconds.value = 0
  youtubeSaving.value = true
  const task = youtubeTask.value
  const { sectionName, lessonName } = extractSectionLesson(task)
  const note = youtubeNoteBase.value || `YouTube: ${task.title}`
  const totalSeconds = youtubeSavedSeconds.value + seconds
  const duration_minutes = secondsToMinutesRounded(totalSeconds)
  try {
    if (youtubeSessionId.value) {
      await updateYoutubeSession.mutateAsync({
        id: youtubeSessionId.value,
        patch: {
          duration_minutes,
          note,
          date: todayISO(),
          curriculum_id: task.curriculum_id ?? null,
          topic_uuid: task.topic_uuid ?? null,
          topic_title: task.title ?? null,
          section_id: task.section_id ?? null,
          section_name: sectionName,
          lesson_id: task.lesson_id ?? null,
          lesson_name: lessonName,
        }
      }).then(() => {
        refreshNuxtData(qk.studySessions.root.join(':'))
        refreshNuxtData(qk.studyPlan.root.join(':'))
        // topicDurations and others are likely string keys or triggers in my refack
      })
    } else {
      const created = await createFromYoutube.mutateAsync({
        duration_seconds: totalSeconds,
        note,
        curriculum_id: task.curriculum_id ?? null,
        topic_uuid: task.topic_uuid ?? null,
        topic_title: task.title ?? null,
        section_id: task.section_id ?? null,
        section_name: sectionName,
        lesson_id: task.lesson_id ?? null,
        lesson_name: lessonName,
      })
      youtubeSessionId.value = created?.id ?? null
      refreshNuxtData(qk.studySessions.root.join(':'))
      refreshNuxtData(qk.studyPlan.root.join(':'))
    }
    youtubeSavedSeconds.value += seconds
    if (reason !== 'auto') toast.success('İzleme süresi kaydedildi.')
  } catch (e:any) {
    youtubePendingSeconds.value += seconds
    toast.error(e?.message ?? 'YouTube süresi kaydedilemedi.')
  } finally {
    youtubeSaving.value = false
    if (youtubePendingSeconds.value >= 60) {
      // Kalan kuyruk varsa asenkron olarak devam et
      flushYoutubeProgress('auto')
    }
  }
}

async function closeYoutubeModal() {
  stopYoutubeTracking()
  for (let i = 0; i < 5 && youtubeSaving.value; i++) {
    await new Promise(res => setTimeout(res, 200))
  }
  await flushYoutubeProgress('close')
  destroyYoutubePlayer()
  youtubeModalOpen.value = false
  youtubeTask.value = null
  youtubeVideoId.value = null
}

function destroyYoutubePlayer() {
  stopYoutubeTracking()
  if (youtubePlayer.value?.destroy) {
    youtubePlayer.value.destroy()
  }
  youtubePlayer.value = null
}

/* === Sürükle & Bırak (günler arası taşıma) === */
import { ref as vueRef } from 'vue'
const dragOver = vueRef<DayKey | null>(null)

function onDragStart(e: DragEvent, id: string) {
  try {
    e.dataTransfer?.setData('text/plain', id)
    e.dataTransfer!.effectAllowed = 'move'
  } catch (err) {
    // ignore
  }
}

function onDragOver(e: DragEvent, day: DayKey) {
  e.preventDefault()
  dragOver.value = day
}

function onDragLeave(_e: DragEvent, day: DayKey) {
  if (dragOver.value === day) dragOver.value = null
}

function onDrop(e: DragEvent, toDay: DayKey) {
  e.preventDefault()
  dragOver.value = null
  const id = e.dataTransfer?.getData('text/plain')
  if (!id) return
  const source = tasksAll().find(t => t.id === id)
  if (!source) return
  if (source.day === toDay) return
  const next = tasksAll().map(t => t.id === id ? { ...t, day: toDay } : t)
  persistPlan(next, 'Ders günü güncellendi')
}

/* === Hafta değişimi === */
function changeWeek(offset:number){
  const c = parseDate(weekStart.value)
  const shifted = addDaysUtc(c, offset*7)
  weekStart.value = formatDate(getStartOfWeekTurkey(shifted))
}

watch([() => auth.userId, weekStart], ([uid, start]) => {
  if (!uid || !start) return
  // Prefetch logic removed for simplicity with Nuxt
}, { immediate: true })

/* === Esneklik / Ertele === */
const postponeModalOpen = ref(false)
const postponeTargetDay = ref<DayKey | null>(null)
const postponeMode = ref<'skip' | 'limit'>('skip')
const postponeMinutes = ref(30)
const DEFAULT_TASK_MINUTES = 25

const postponeTargetLabel = computed(() => postponeTargetDay.value ? dayLabels[postponeTargetDay.value] : '')

function openPostponeModal(day: DayKey) {
  postponeTargetDay.value = day
  postponeMode.value = 'skip'
  postponeMinutes.value = 30
  postponeModalOpen.value = true
}

function closePostponeModal() {
  postponeModalOpen.value = false
}

function dayOrder(key: DayKey) {
  return days.findIndex(d => d.key === key)
}

function nextDays(from: DayKey) {
  const idx = dayOrder(from)
  return days.slice(idx + 1).map(d => d.key)
}

function countByDay(list: StudyTask[]) {
  const counts: Record<DayKey, number> = {
    monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0
  }
  for (const t of list) counts[t.day]++
  return counts
}

function redistributeTasks(fromDay: DayKey, mode: 'skip' | 'limit', minutes: number) {
  const all = tasksAll()
  const dayTasks = all.filter(t => t.day === fromDay && !t.completed)
  if (!dayTasks.length) {
    toast.info('Bu gunde ertelenecek tamamlanmamis gorev yok.')
    return
  }

  const keepCount = mode === 'limit' ? Math.max(0, Math.floor(minutes / DEFAULT_TASK_MINUTES)) : 0
  const toMove = mode === 'limit' ? dayTasks.slice(keepCount) : dayTasks

  if (!toMove.length) {
    toast.success('Tum gorevler bu gunde kalacak kadar sure icinde yapilabilir.')
    return
  }

  const targets = nextDays(fromDay)
  if (!targets.length) {
    toast.error('Haftanin kalan gunleri yok. Gorevleri ileri atayamadik.')
    return
  }

  const counts = countByDay(all)
  const assignments: Record<string, DayKey> = {}

  for (const task of toMove) {
    const best = targets.reduce((currentBest, candidate) => {
      return counts[candidate] < counts[currentBest] ? candidate : currentBest
    }, targets[0]!)
    assignments[task.id] = best
    counts[best]++
  }

  const nextTasks: StudyTask[] = all.map(t => {
    const assignedDay = assignments[t.id]
    return assignedDay ? { ...t, day: assignedDay } : t
  })
  persistPlan(nextTasks, 'Gorevler haftanin kalan gunlerine dagitildi')
  postponeModalOpen.value = false
}

function applyPostpone() {
  if (!ensurePremiumPlan('Gorevleri dagitmak')) return
  if (!postponeTargetDay.value) return
  redistributeTasks(postponeTargetDay.value, postponeMode.value, postponeMinutes.value)
}

/* === Zamanlayıcıya yönlendirme === */
function openTimer(task: StudyTask) {
  const { sectionName, lessonName } = extractSectionLesson(task)
  const query: Record<string, string> = { source: 'plan' }
  const sectionId = task.section_id ?? null
  const lessonId = task.lesson_id ?? null

  if (sectionId !== null && sectionId !== undefined) query.sectionId = String(sectionId)
  if (sectionName) query.sectionName = sectionName

  if (lessonId !== null && lessonId !== undefined) query.lessonId = String(lessonId)
  if (lessonName) query.lessonName = lessonName

  if (task.topic_uuid) query.topicId = String(task.topic_uuid)
  if (task.title) query.topicTitle = String(task.title)

  router.push({ name: 'zamanlayici', query })
}

/* === Helpers === */
function computeDaily(list: StudyTask[]) {
  const daily: Record<DayKey, { total:number; completed:number }> = {
    monday:{total:0,completed:0}, tuesday:{total:0,completed:0}, wednesday:{total:0,completed:0},
    thursday:{total:0,completed:0}, friday:{total:0,completed:0}, saturday:{total:0,completed:0}, sunday:{total:0,completed:0}
  }
  for (const t of list) { daily[t.day].total++; if (t.completed) daily[t.day].completed++ }
  return daily
}
function addDaysUtc(d: Date, days: number){ const r=new Date(d); r.setUTCDate(r.getUTCDate()+days); return r }
function getStartOfWeekTurkey(d: Date){
  const base = dateInTurkey(d)
  const diff = (base.getUTCDay()+6)%7
  base.setUTCDate(base.getUTCDate()-diff)
  return base
}
/* TS güvenli parse */
function parseDate(v:string){
  const [ys='',ms='',ds=''] = v.split('-') as [string,string,string]
  const y=Number(ys), m=Number(ms), dd=Number(ds)
  const now=new Date(), d=new Date(Date.UTC(
    Number.isFinite(y)?y:now.getFullYear(),
    (Number.isFinite(m)?m:1)-1,
    Number.isFinite(dd)?dd:1
  ))
  d.setUTCHours(0,0,0,0); return d
}
function formatDate(d:Date){ const y=d.getUTCFullYear(); const m=String(d.getUTCMonth()+1).padStart(2,'0'); const day=String(d.getUTCDate()).padStart(2,'0'); return `${y}-${m}-${day}` }
function formatDisplayDate(d:Date){
  return new Intl.DateTimeFormat('tr-TR',{day:'2-digit',month:'short', timeZone:TURKEY_TZ}).format(d)
}
function dateInTurkey(d: Date){
  const parts = new Intl.DateTimeFormat('en-CA', { timeZone: TURKEY_TZ, year:'numeric', month:'2-digit', day:'2-digit' }).formatToParts(d)
  const y = Number(parts.find(p => p.type === 'year')?.value ?? '')
  const m = Number(parts.find(p => p.type === 'month')?.value ?? '')
  const day = Number(parts.find(p => p.type === 'day')?.value ?? '')
  const safeY = Number.isFinite(y) ? y : d.getUTCFullYear()
  const safeM = Number.isFinite(m) ? m : (d.getUTCMonth()+1)
  const safeD = Number.isFinite(day) ? day : d.getUTCDate()
  return new Date(Date.UTC(safeY, safeM-1, safeD))
}
function buildNotes(s:any){ const arr=[s?.section?.code,s?.section?.name,s?.lesson?.code,s?.lesson?.name,s?.topic?.title].filter(Boolean); return arr.join(' • ') }
function readable(v: number) {
  const hrs = Math.floor(v/3600), mins=Math.floor((v%3600)/60), secs=v%60
  if (hrs>0) return `${hrs}sa ${String(mins).padStart(2,'0')}dk`
  if (mins>0) return `${mins}dk ${String(secs).padStart(2,'0')}sn`
  return `${secs}sn`
}
function extractSectionLesson(task: StudyTask): { sectionName: string | null; lessonName: string | null } {
  let sectionName: string | null = null
  let lessonName: string | null = null
  const legacySection = task.section_id as unknown
  const legacyLesson = task.lesson_id as unknown
  if (typeof legacySection === 'string') sectionName = legacySection || null
  if (typeof legacyLesson === 'string') lessonName = legacyLesson || null
  if (sectionName && lessonName) return { sectionName, lessonName }
  if (task.notes) {
    const parts = task.notes.split('•').map(p => p.trim()).filter(Boolean)
    if (!sectionName && parts[1]) sectionName = parts[1] || null
    if (!lessonName && parts[3]) lessonName = parts[3] || null
  }
  return { sectionName, lessonName }
}

onBeforeUnmount(() => {
  destroyYoutubePlayer()
})
</script>

<template>
  <div class="min-h-screen bg-white xl:bg-sky-100 flex flex-col px-0 sm:px-4">
    <header><Navbar /></header>

    <main class="flex-grow flex justify-center items-start px-0 py-6 xl:px-4 xl:py-8">
      <div
        class="w-full max-w-6xl bg-white p-4 xl:p-8 space-y-8 rounded-none shadow-none border-0 xl:rounded-3xl xl:shadow-2xl xl:border xl:border-slate-100"
      >
        <header class="space-y-2 text-center">
          <h1 class="text-3xl font-bold text-sky-700">🗓️ Ders Programı Planlayıcısı</h1>
          <p class="text-sm text-slate-600">
            Haftalık derslerini müfredattan seç, planını düzenle; tamamladıklarını işaretleyip süreleri kaydet.
          </p>
        </header>

        <!-- Müfredattan Ders Ekle -->
        <section class="bg-white border border-slate-200 xl:bg-sky-50 xl:border-sky-100 rounded-2xl p-6 space-y-4">
          <header class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div class="font-semibold text-sky-700">📚 Müfredattan Ders Ekle</div>
            <div class="text-xs text-slate-500">
              <span v-if="isPending">Müfredat yükleniyor…</span>
              <span v-else-if="!auth.preferredCurriculumId">Tercihli müfredat bulunamadı.</span>
            </div>
          </header>

          <CurriculumPicker @change="onCurriculumChange" />

          <div class="flex flex-wrap gap-2 pt-2">
            <button
                v-for="d in days" :key="d.key" type="button"
                class="weekday-btn disabled:opacity-60 disabled:cursor-not-allowed"
                :disabled="!isPremiumActive"
                @click="addSelected(d.key)"
            >
              + {{ d.label }}
            </button>
          </div>

          <div
            v-if="!isPremiumActive"
            class="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 md:flex-row md:items-center md:justify-between"
          >
            <p class="text-sm font-semibold">
              Ders programi duzenleme premium uyeler icindir. Premium'a gecerek gorevlerini kaydedebilirsin.
            </p>
            <RouterLink
              to="/profil"
              class="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              Premium'a gec
            </RouterLink>
          </div>
        </section>

        <!-- Hafta Seçimi -->
        <section class="bg-white border border-slate-200 rounded-2xl p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="text-slate-700 font-semibold text-center sm:text-left">{{ weekRangeLabel }}</div>
          <div class="flex items-center gap-2">
            <button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" @click="changeWeek(-1)">← Önceki Hafta</button>
            <button class="rounded-md border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-50" @click="changeWeek(1)">Sonraki Hafta →</button>
          </div>
        </section>

        <!-- Haftalık Plan -->
        <section class="space-y-4">
          <h2 class="text-xl font-semibold text-slate-800">🗓️ Haftalık Ders Programı</h2>
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <article
        v-for="d in days" :key="d.key"
        @dragover.prevent="onDragOver($event, d.key)"
        @drop="onDrop($event, d.key)"
        @dragleave="onDragLeave($event, d.key)"
        :class="[ 'group rounded-2xl border border-slate-200 bg-slate-50 p-4 space-y-3 transition-all duration-200 ease-out hover:bg-white hover:border-sky-200 hover:shadow-lg hover:shadow-sky-100/60', dragOver === d.key ? 'ring-2 ring-sky-200' : '' ]"
      >
              <header class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <h3 class="font-semibold text-slate-800 transition-colors duration-200 group-hover:text-sky-700">
                    {{ d.label }}
                  </h3>
                  <button
                    type="button"
                    class="rounded-full border border-slate-300 bg-white px-2 py-1 text-[11px] font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
                    title="Bugunu esnet/ertele"
                    @click.stop="openPostponeModal(d.key)"
                    :disabled="!isPremiumActive"
                  >
                    ⏳
                  </button>
                </div>
                <span class="text-xs text-slate-500">
                  {{ (planDTO?.daily?.[d.key]?.completed ?? 0) }} / {{ (planDTO?.daily?.[d.key]?.total ?? 0) }}
                </span>
              </header>

              <div class="space-y-3">
                <div
                  v-for="group in (groupedTasksByDay[d.key] || [])"
                  :key="group.lessonKey"
                  class="rounded-2xl border shadow-inner transition-all duration-200 backdrop-blur-sm"
                  :style="{ backgroundColor: colorWithAlpha(group.color, 0.12), borderColor: colorWithAlpha(group.color, 0.24) }"
                >
                  <button
                    type="button"
                    class="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-white/50"
                    @click="toggleLesson(d.key, group.lessonKey)"
                  >
                    <div class="flex items-center gap-3">
                      <span class="h-2.5 w-2.5 rounded-full shadow-sm" :style="{ backgroundColor: colorWithAlpha(group.color, 0.9) }"></span>
                      <div class="leading-tight">
                        <div class="text-sm font-semibold text-slate-800">{{ group.lessonLabel }}</div>
                        <div class="text-[11px] text-slate-600">{{ group.tasks.length }} video</div>
                      </div>
                    </div>
                    <span class="text-xs font-semibold text-slate-600">
                      {{ isLessonOpen(d.key, group.lessonKey) ? 'Gizle' : 'Goster' }}
                    </span>
                  </button>
                  <transition name="fade-slide">
                    <div
                      v-if="isLessonOpen(d.key, group.lessonKey)"
                      class="border-t border-white/50 px-2 pb-3 pt-2"
                    >
                      <ul class="space-y-2">
                        <li
                          v-for="t in group.tasks"
                          :key="t.id"
                          :draggable="isPremiumActive"
                          @dragstart="onDragStart($event, t.id)"
                          class="rounded-xl border border-slate-200 bg-white/80 px-3 py-2 transition-colors duration-150 hover:border-sky-200 cursor-grab"
                        >
                          <div class="flex items-start justify-between gap-3">
                            <label class="flex items-start gap-2 flex-1">
                              <input type="checkbox" :checked="t.completed" @change="onToggleTask(d.key, t.id, $event)" :disabled="!isPremiumActive" />
                              <div class="space-y-0.5">
                                <div class="font-medium text-slate-800" :class="t.completed ? 'line-through' : ''">{{ t.title }}</div>
                                <div
                                  v-if="noteMetaById[t.id]?.text || noteMetaById[t.id]?.youtubeUrl"
                                  class="text-xs text-slate-500 flex items-center gap-2 flex-wrap"
                                >
                                  <span v-if="noteMetaById[t.id]?.text">{{ noteMetaById[t.id]?.text }}</span>
                                  <button
                                    v-if="noteMetaById[t.id]?.youtubeUrl"
                                    type="button"
                                    class="inline-flex items-center justify-center rounded-full border border-red-100 bg-red-50 px-1.5 py-0.5 text-red-600 hover:text-red-700 hover:border-red-200 transition disabled:opacity-60 disabled:cursor-not-allowed"
                                    @click.stop="openYoutubeModal(t)"
                                    :disabled="!isPremiumActive"
                                    aria-label="YouTube baglantisini modulde ac"
                                    title="YouTube baglantisini modulde ac"
                                  >
                                    <svg
                                      class="w-3.5 h-3.5"
                                      viewBox="0 0 24 24"
                                      fill="currentColor"
                                      aria-hidden="true"
                                      focusable="false"
                                    >
                                      <path
                                        d="M21.58 7.19a2.54 2.54 0 0 0-1.79-1.8C17.99 5 12 5 12 5s-5.99 0-7.79.39a2.54 2.54 0 0 0-1.79 1.8A26.35 26.35 0 0 0 2 12a26.35 26.35 0 0 0 .42 4.81 2.54 2.54 0 0 0 1.79 1.8C6.01 19 12 19 12 19s5.99 0 7.79-.39a2.54 2.54 0 0 0 1.79-1.8A26.35 26.35 0 0 0 22 12a26.35 26.35 0 0 0-.42-4.81Z"
                                      />
                                      <path d="M10 15.5v-7l6 3.5-6 3.5Z" fill="#fff" />
                                    </svg>
                                  </button>
                                </div>
                                <div class="text-[11px] text-slate-500">
                                  Sure: {{ readable(topicDurations?.[t.topic_uuid ?? ""] ?? 0) }}
                                </div>
                              </div>
                            </label>
                            <div class="flex items-center gap-2">
                              <button class="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50 disabled:opacity-60 disabled:cursor-not-allowed" @click="openTimer(t)" title="Zamanlayici" :disabled="!isPremiumActive">&#9201;</button>
                              <button class="rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-60 disabled:cursor-not-allowed" @click="removeTask(d.key, t.id)" title="Sil" :disabled="!isPremiumActive">Sil</button>
                            </div>
                          </div>
                        </li>
                      </ul>
                    </div>
                  </transition>
                </div>
              </div>

              <p v-if="!(groupedTasksByDay[d.key] || []).length" class="text-xs text-slate-500">Bu gune henuz gorev eklenmedi.</p>
            </article>
          </div>
        </section>

        <!-- Özet -->
        <section class="bg-white border border-slate-200 xl:bg-sky-50 xl:border-sky-100 rounded-2xl p-6 grid grid-cols-1 sm:grid-cols-3 gap-4 text-center">
          <div class="rounded-xl bg-white border border-slate-200 p-4">
            <div class="text-sm text-slate-500">Toplam Görev</div>
            <div class="text-2xl font-bold text-slate-800">{{ planDTO?.plan?.total_tasks ?? 0 }}</div>
          </div>
          <div class="rounded-xl bg-white border border-slate-200 p-4">
            <div class="text-sm text-slate-500">Tamamlanan</div>
            <div class="text-2xl font-bold text-emerald-700">{{ planDTO?.plan?.completed_tasks ?? 0 }}</div>
          </div>
          <div class="rounded-xl bg-white border border-slate-200 p-4">
            <div class="text-sm text-slate-500">Tamamlama Oranı</div>
            <div class="text-2xl font-bold text-sky-700">{{ Math.round(planDTO?.plan?.completion_rate ?? 0) }}%</div>
          </div>
        </section>
      </div>
    </main>

    <!-- Ertele/Esnet modal -->
    <div
      v-if="postponeModalOpen"
      class="fixed inset-0 z-40 flex items-center justify-center bg-slate-900/70 px-4 py-6"
    >
      <div class="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
        <div class="flex items-start justify-between gap-3">
          <div>
            <div class="text-sm font-semibold text-slate-700">Gunu ertele / esnet</div>
            <div class="text-lg font-bold text-slate-900">{{ postponeTargetLabel }}</div>
            <p class="text-xs text-slate-500 mt-1">
              Tamamlanmamis gorevler haftanin kalan gunlerine dengeli dagitilir.
            </p>
          </div>
          <button
            type="button"
            class="rounded-full border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 hover:text-slate-800 hover:border-slate-300"
            @click="closePostponeModal"
          >
            ✕
          </button>
        </div>

        <div class="space-y-3">
          <label class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input type="radio" value="skip" v-model="postponeMode" />
            <span>Bugun hic calisamadim (tum gorevleri ileri ata)</span>
          </label>

          <label class="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
            <input type="radio" value="limit" v-model="postponeMode" />
            <span>Bugun sinirli calisabilirim</span>
          </label>

          <div class="space-y-1 pl-6">
            <label class="text-xs font-semibold text-slate-600">Bugun calisma suresi (dakika)</label>
            <input
              type="number"
              min="5"
              step="5"
              class="w-32 rounded-md border border-slate-300 px-3 py-1.5 text-sm focus:border-sky-300 focus:ring-2 focus:ring-sky-200 disabled:bg-slate-100"
              v-model.number="postponeMinutes"
              :disabled="postponeMode === 'skip'"
            />
            <p class="text-[11px] text-slate-500">Varsayilan gorev suresi: {{ DEFAULT_TASK_MINUTES }} dk</p>
          </div>
        </div>

        <div class="flex justify-end gap-2 pt-2">
          <button
            type="button"
            class="rounded-md border border-slate-300 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50"
            @click="closePostponeModal"
          >
            Vazgec
          </button>
          <button
            type="button"
            class="rounded-md border border-sky-200 bg-sky-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700 disabled:opacity-60"
            :disabled="!postponeTargetDay || !isPremiumActive"
            @click="applyPostpone"
          >
            Dagit ve kaydet
          </button>
        </div>
      </div>
    </div>

    <!-- YouTube izleme modülü -->
    <div
      v-if="youtubeModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 px-4 py-6"
    >
      <div class="relative w-full max-w-5xl rounded-2xl bg-white p-4 md:p-6 shadow-2xl">
        <button
          type="button"
          class="absolute right-3 top-3 rounded-full border border-slate-200 bg-white px-2 py-1 text-sm text-slate-600 hover:text-slate-800 hover:border-slate-300"
          @click="closeYoutubeModal"
          :disabled="youtubeSaving"
        >
          ✕
        </button>

        <div class="space-y-3">
          <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div class="space-y-1">
              <div class="text-sm font-semibold text-slate-700">YouTube Modülü</div>
              <div class="text-lg font-bold text-slate-900">
                {{ youtubeTask?.title || 'Video' }}
              </div>
              <div
                v-if="noteMetaById[youtubeTask?.id || '']?.youtubeUrl"
                class="text-[11px] text-slate-500 break-all"
              >
                {{ noteMetaById[youtubeTask?.id || '']?.youtubeUrl }}
              </div>
            </div>
            <div class="text-xs text-slate-600 space-y-1 text-left md:text-right">
              <div>İzlenen: <span class="font-semibold text-slate-800">{{ readable(Math.floor(youtubeWatchedSeconds)) }}</span></div>
              <div>Kaydedilen: <span class="font-semibold text-emerald-700">{{ readable(Math.floor(youtubeSavedSeconds)) }}</span></div>
            </div>
          </div>

          <div class="aspect-video w-full overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
            <div :id="youtubePlayerElId" class="h-full w-full"></div>
          </div>

          <div class="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="space-y-1">
              <p class="font-semibold text-slate-800">Videoyu beğenelim</p>
              <p class="text-xs">
                Bu videoyu beğenerek daha fazla içerik üretmemizi destekle. Yeni sekmede açılan YouTube sayfasından kolayca beğen ve geri dön.
              </p>
            </div>
            <button
              type="button"
              class="inline-flex items-center justify-center rounded-full border border-sky-200 bg-white px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:border-sky-300 hover:bg-sky-50 disabled:border-slate-200 disabled:text-slate-500 disabled:bg-slate-100"
              @click="openYoutubeLikeWindow"
              :disabled="!youtubeLikeUrl"
            >
              Videoyu yeni sekmede aç & beğen
            </button>
          </div>

          <div class="flex flex-col gap-2 text-xs text-slate-600 md:flex-row md:items-center md:justify-between">
            <div class="flex items-center gap-2">
              <span
                class="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-2 py-1"
              >
                <span
                  class="h-2 w-2 rounded-full"
                  :class="youtubeSaving ? 'bg-amber-500 animate-pulse' : youtubeStatus === 'ready' ? 'bg-emerald-500' : 'bg-slate-400'"
                ></span>
                <span>{{ youtubeSaving ? 'Kaydediliyor…' : youtubeStatus === 'ready' ? 'Oynatıcı hazır' : 'Oynatıcı hazırlanıyor' }}</span>
              </span>
              <span v-if="youtubePendingSeconds >= 1" class="text-[11px] text-slate-500">
                Kaydedilecek: {{ readable(Math.floor(youtubePendingSeconds)) }}
              </span>
            </div>
            <div class="flex gap-2 md:justify-end">
              <button
                type="button"
                class="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:opacity-50"
                @click="flushYoutubeProgress('pause')"
                :disabled="youtubeSaving || youtubePendingSeconds < 5"
              >
                Şu ana kadar kaydet
              </button>
              <button
                type="button"
                class="rounded-md border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-semibold text-sky-700 transition hover:bg-sky-100 disabled:opacity-60"
                @click="closeYoutubeModal"
                :disabled="youtubeSaving"
              >
                Kapat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.weekday-btn {
  @apply rounded-full border border-sky-200 bg-white
  px-3 py-1.5 text-xs font-semibold text-sky-700
  shadow-sm
  transition-all duration-150 ease-out
  hover:bg-sky-50 hover:border-sky-300 hover:shadow
  active:scale-[0.98] hover:-translate-y-0.5
  focus:outline-none focus:ring-2 focus:ring-sky-300;
}

.fade-slide-enter-active,
.fade-slide-leave-active {
  transition: all 180ms ease-out;
}
.fade-slide-enter-from,
.fade-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

</style>
