// src/api/sprints.ts
import { supabase } from '../lib/supabase'
import { StudyPlansAPI, type StudyTask, type StudyPlanDTO, type DayKey } from './studyPlans'
import { CurriculumAPI, type Section, type Lesson, type Topic } from './curriculum'

/** ============== Types ============== */
export type LessonTeacherMap = Record<number, string>

export type SprintSelection = {
    curriculumId: string
    sectionIds?: number[]
    lessonIds?: number[]
    topicIds?: string[]
    lessonTeacherMap?: LessonTeacherMap
}

export type SprintGenerateInput = {
    userId: string
    title: string
    startDateISO: string
    dailyMinutes: number
    lessonDailyMinutes?: Record<number, number>
    selection: SprintSelection
}

export type SprintGenerateResult = {
    sprint_id: string
    created_plan_week_starts: string[]
}

export type SprintSelectionVideo = {
    order: number
    playlistId: string
    videoId: string
    title: string | null
    durationMinutes: number
    lessonId: number | null
    lessonName: string | null
    lessonCode: string | null
    sectionId: number | null
    sectionCode: string | null
    topicUuid: string
    topicTitle: string | null
    topicOrder: number | null
}

export type SprintSelectionEstimate = {
    topicCount: number
    videoCount: number
    totalMinutes: number
}

export type SprintScope = {
    curriculum_id: string | null
    sections: number[]
    lessons: number[]
    topics: string[]
    lesson_teachers?: LessonTeacherMap
}

export type SprintCadence = {
    start_date: string | null
    daily_minutes: number | null
    lesson_daily_minutes: Record<number, number>
}

export type SprintSummary = {
    id: string
    title: string
    status: string
    created_at: string
    updated_at: string
    scope: SprintScope
    cadence: SprintCadence
    scopeCounts: { sections: number; lessons: number; topics: number }
    stats: { totalTasks: number; completedTasks: number; completionRate: number }
}

/** ============== Helpers ============== */
class SprintError extends Error { code?: string; constructor(m: string, c?: string) { super(m); this.code = c } }
const withTimeout = <T>(p: PromiseLike<T>, ms = 10000) =>
    Promise.race<T>([p, new Promise<T>((_, rej) => setTimeout(() => rej(new SprintError('TIMEOUT', 'TIMEOUT')), ms))])

const dayKeys: DayKey[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']
type DayIndex = 0 | 1 | 2 | 3 | 4 | 5 | 6
const dayKeyByIndex: Record<DayIndex, DayKey> = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
}

const toDayKey = (d: Date): DayKey => {
    const idx = d.getDay()
    if (idx >= 0 && idx <= 6) {
        return dayKeyByIndex[idx as DayIndex]
    }
    return 'monday'
}

const mondayOf = (d: Date): Date => {
    const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
    const day = copy.getUTCDay()
    const diff = (day === 0 ? -6 : 1 - day)
    copy.setUTCDate(copy.getUTCDate() + diff)
    return copy
}

const isoDate = (d: Date) => d.toISOString().slice(0, 10)

const uuid = () => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
    // simple fallback
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        const r = (Math.random() * 16) | 0, v = c === 'x' ? r : (r & 0x3 | 0x8); return v.toString(16)
    })
}

type FlatVideo = {
    topic_uuid: string
    playlist_id: string
    video_id: string
    title: string | null
    duration_minutes: number
    url: string | null
    sort_order?: number | null
    lesson_id?: number | null
    section_id?: number | null
    topic_title?: string | null
}

type ScheduledVideo = FlatVideo & {
    partIndex?: number
    original_minutes?: number
}

async function fetchVideosByTopics(topicIds: string[]): Promise<FlatVideo[]> {
    if (!topicIds.length) return []
    const { data, error } = await withTimeout(
        supabase
            .from('playlist_videos')
            .select('playlist_id,video_id,title,duration_minutes,url,topic_uuid,sort_order')
            .in('topic_uuid', topicIds)
            .order('sort_order', { ascending: true, nullsFirst: false })
            .order('video_id', { ascending: true })
    ) as any
    if (error) throw error
    return (data ?? []).map((r: any) => ({
        topic_uuid: r.topic_uuid ? String(r.topic_uuid) : '',
        playlist_id: String(r.playlist_id),
        video_id: String(r.video_id),
        title: r.title ?? null,
        duration_minutes: Number(r.duration_minutes ?? 0),
        url: r.url ?? null,
        sort_order: typeof r.sort_order === 'number' ? r.sort_order : null
    })).filter((v: FlatVideo) => !!v.topic_uuid)
}

async function expandSelectionToTopics(sel: SprintSelection): Promise<{
    sections: Section[]
    lessons: Lesson[]
    topics: Topic[]
}> {
    const sections: Section[] = []
    const lessons: Lesson[] = []
    const topics: Topic[] = []
    const { curriculumId } = sel

    if (sel.sectionIds?.length) {
        const allSecs = await CurriculumAPI.fetchSectionsByCurriculumId(curriculumId)
        const secPick = allSecs.filter(s => sel.sectionIds!.includes(s.id))
        sections.push(...secPick)
        for (const s of secPick) {
            const ls = await CurriculumAPI.fetchLessonsBySectionId(s.id)
            lessons.push(...ls)
            for (const l of ls) {
                const ts = await CurriculumAPI.fetchTopicsByLessonId(l.id)
                topics.push(...ts)
            }
        }
    }

    if (sel.lessonIds?.length) {
        // tüm dersleri curriculum’dan topla, filtrele
        const allSecs = await CurriculumAPI.fetchSectionsByCurriculumId(curriculumId)
        for (const s of allSecs) {
            const ls = await CurriculumAPI.fetchLessonsBySectionId(s.id)
            const only = ls.filter(l => sel.lessonIds!.includes(l.id))
            lessons.push(...only)
            for (const l of only) {
                const ts = await CurriculumAPI.fetchTopicsByLessonId(l.id)
                topics.push(...ts)
            }
        }
    }

    if (sel.topicIds?.length) {
        for (const tid of sel.topicIds) {
            const t = await CurriculumAPI.findTopicById(tid)
            if (t) topics.push(t)
        }
    }

    const uniq = <T, K extends string | number>(arr: T[], key: (x: T) => K) => {
        const m = new Map<K, T>()
        for (const a of arr) m.set(key(a), a)
        return [...m.values()]
    }

    return {
        sections: uniq(sections, s => s.id),
        lessons: uniq(lessons, l => l.id),
        topics: uniq(topics, t => t.id)
    }
}

async function buildLessonMeta(curriculumId: string) {
    const sections = await CurriculumAPI.fetchSectionsByCurriculumId(curriculumId)
    const lessonMap = new Map<number, Lesson>()
    const sectionMap = new Map<number, Section>()
    const sectionOrder = new Map<number, number>()
    const lessonOrder = new Map<number, number>()
    sections.forEach((s, idx) => {
        sectionOrder.set(s.id, idx)
        sectionMap.set(s.id, s)
    })
    let lessonIdx = 0
    for (const s of sections) {
        const ls = await CurriculumAPI.fetchLessonsBySectionId(s.id)
        ls.forEach((l) => {
            lessonMap.set(l.id, l)
            lessonOrder.set(l.id, lessonIdx++)
        })
    }
    return { lessonMap, sectionMap, sectionOrder, lessonOrder }
}

async function sumVideoDurationsByTopicIds(topicIds: string[]) {
    if (!topicIds.length) return { totalMinutes: 0, videoCount: 0 }
    const chunkSize = 99
    let totalMinutes = 0
    let videoCount = 0
        for (let i = 0; i < topicIds.length; i += chunkSize) {
            const chunk = topicIds.slice(i, i + chunkSize)
            const { data, error } = await withTimeout(
                supabase
                    .from('playlist_videos')
                    .select('duration_minutes')
                    .in('topic_uuid', chunk)
            ) as any
        if (error) throw error
        const rows = data ?? []
        for (const row of rows) {
            totalMinutes += Number(row.duration_minutes ?? 0)
        }
        videoCount += rows.length
    }
    return { totalMinutes, videoCount }
}

type SprintRow = {
    id: string
    user_id: string
    title: string
    scope: SprintScope
    cadence: SprintCadence
    status: string
    created_at: string
    updated_at: string
}

const toNumberArray = (val: any): number[] =>
    Array.isArray(val)
        ? val
            .map((v) => Number(v))
            .filter((num) => Number.isFinite(num))
        : []

const toStringArray = (val: any): string[] =>
    Array.isArray(val)
        ? val
            .map((v) => {
                if (v === null || v === undefined) return null
                const str = String(v)
                return str.length ? str : null
            })
            .filter((v): v is string => !!v)
        : []

const normalizeLessonTeachers = (raw: any): LessonTeacherMap => {
    const map: LessonTeacherMap = {}
    if (raw && typeof raw === 'object') {
        for (const [key, value] of Object.entries(raw)) {
            const id = Number(key)
            const teacher = typeof value === 'string' ? value : String(value ?? '')
            const trimmed = teacher.trim()
            if (Number.isFinite(id) && trimmed) {
                map[id] = trimmed
            }
        }
    }
    return map
}

const toLessonTeacherMap = (raw?: LessonTeacherMap): Map<number, string> => {
    const m = new Map<number, string>()
    if (!raw) return m
    for (const [key, value] of Object.entries(raw)) {
        const id = Number(key)
        const teacher = typeof value === 'string' ? value.trim() : String(value ?? '').trim()
        if (Number.isFinite(id) && teacher) {
            m.set(id, teacher)
        }
    }
    return m
}

const normalizeScope = (raw: any): SprintScope => {
    return {
        curriculum_id: raw?.curriculum_id ? String(raw.curriculum_id) : null,
        sections: toNumberArray(raw?.sections),
        lessons: toNumberArray(raw?.lessons),
        topics: toStringArray(raw?.topics),
        lesson_teachers: normalizeLessonTeachers(raw?.lesson_teachers)
    }
}

const normalizeCadence = (raw: any): SprintCadence => {
    const lessonMap: Record<number, number> = {}
    if (raw?.lesson_daily_minutes && typeof raw.lesson_daily_minutes === 'object') {
        for (const [key, value] of Object.entries(raw.lesson_daily_minutes)) {
            const id = Number(key)
            const minutes = Number(value)
            if (Number.isFinite(id) && Number.isFinite(minutes)) {
                lessonMap[id] = Math.max(0, Math.round(minutes))
            }
        }
    }
    const daily = Number(raw?.daily_minutes)
    return {
        start_date: raw?.start_date ? String(raw.start_date) : null,
        daily_minutes: Number.isFinite(daily) ? Math.max(0, Math.round(daily)) : null,
        lesson_daily_minutes: lessonMap
    }
}

const normalizeSprintRow = (raw: any): SprintRow => ({
    id: String(raw.id),
    user_id: String(raw.user_id),
    title: raw?.title ? String(raw.title) : 'Sprint',
    scope: normalizeScope(raw?.scope ?? {}),
    cadence: normalizeCadence(raw?.cadence ?? {}),
    status: raw?.status ? String(raw.status) : 'active',
    created_at: raw?.created_at ? String(raw.created_at) : new Date().toISOString(),
    updated_at: raw?.updated_at ? String(raw.updated_at) : new Date().toISOString()
})

const chunkArray = <T,>(arr: T[], size = 99): T[][] => {
    if (size <= 0) return [arr]
    const res: T[][] = []
    for (let i = 0; i < arr.length; i += size) {
        res.push(arr.slice(i, i + size))
    }
    return res
}

const toNumberOrNull = (value: any): number | null => {
    if (value === null || value === undefined || value === '') return null
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
        const num = Number(value)
        return Number.isFinite(num) ? num : null
    }
    return null
}

const normalizeCountValue = (value: any): number => {
    const num = Number(value)
    return Number.isFinite(num) ? num : 0
}

const fetchSprintContentStats = async (sprintId: string): Promise<{ sections: number; lessons: number; topics: number }> => {
    if (!sprintId) return { sections: 0, lessons: 0, topics: 0 }
    const { data, error } = await withTimeout(
        supabase.rpc('get_sprint_content_stats', { sprint_uuid: sprintId })
    ) as any
    if (error) throw error
    const row = Array.isArray(data) ? data[0] : data
    return {
        sections: normalizeCountValue(row?.section_count),
        lessons: normalizeCountValue(row?.lesson_count),
        topics: normalizeCountValue(row?.topic_count)
    }
}

const lessonLabel = (lessonMap: Map<number, Lesson> | undefined, lessonId: number) =>
    lessonMap?.get(lessonId)?.name ?? `Ders #${lessonId}`

const buildSprintTitle = (lessons: Lesson[], topics: Topic[], lessonMap: Map<number, Lesson>) => {
    const topicCount = topics.length
    if (!topicCount) return 'Koşu - 0 konu'
    const topicCounts = new Map<number, number>()
    for (const t of topics) {
        topicCounts.set(t.lesson_id, (topicCounts.get(t.lesson_id) ?? 0) + 1)
    }
    const lessonSummaries = Array.from(topicCounts.entries()).map(([lessonId, count]) => {
        const lesson = lessonMap.get(lessonId)
        const label = lesson?.code || lesson?.name || `Ders #${lessonId}`
        return { label, count }
    }).sort((a, b) => a.label.localeCompare(b.label, 'tr', { sensitivity: 'base' }))

    const parts: string[] = []
    for (const { label, count } of lessonSummaries.slice(0, 3)) {
        parts.push(`${label}:${count} konu`)
    }
    if (lessonSummaries.length > 3) {
        parts.push(`+${lessonSummaries.length - 3} ders`)
    }
    const summary = parts.join(', ')
    return `Koşu - ${summary || `${lessons.length} ders`} • ${topicCount} konu`
}

const orderVideosByCurriculum = (
    videos: FlatVideo[]
) => {
    const toSortVal = (v?: number | null) => Number.isFinite(v) ? Number(v) : Number.POSITIVE_INFINITY
    return [...videos].sort((a, b) => {
        const ao = toSortVal(a.sort_order)
        const bo = toSortVal(b.sort_order)
        if (ao !== bo) return ao - bo
        const titleCmp = (a.title || '').localeCompare(b.title || '', 'tr', { sensitivity: 'base' })
        if (titleCmp !== 0) return titleCmp
        return (a.video_id || '').localeCompare(b.video_id || '', 'tr', { sensitivity: 'base' })
    })
}

async function buildTeacherPlaylistAllowlist(
    curriculumId: string,
    lessonTeacherMap: Map<number, string>,
    lessonMap?: Map<number, Lesson>
): Promise<Map<number, Set<string>>> {
    if (!lessonTeacherMap.size) return new Map()
    const lessonIds = [...lessonTeacherMap.keys()]

    const { data, error } = await withTimeout(
        supabase
            .from('playlists')
            .select('id,lesson_id,teacher')
            .eq('curriculum_id', curriculumId)
            .in('lesson_id', lessonIds)
    ) as any
    if (error) throw error

    const allow = new Map<number, Set<string>>()
    for (const row of data ?? []) {
        const lid = toNumberOrNull(row?.lesson_id)
        const teacher = String(row?.teacher ?? '').trim()
        if (lid === null || !teacher) continue
        const wanted = lessonTeacherMap.get(lid)
        if (!wanted) continue
        const matches = teacher.localeCompare(wanted, 'tr', { sensitivity: 'base' }) === 0
        if (!matches) continue
        if (!allow.has(lid)) allow.set(lid, new Set())
        allow.get(lid)!.add(String(row.id))
    }

    const missing: number[] = []
    for (const lid of lessonIds) {
        if (!allow.get(lid)?.size) {
            missing.push(lid)
        }
    }
    if (missing.length) {
        const names = missing.map((lid) => {
            const teacher = lessonTeacherMap.get(lid)
            return `${lessonLabel(lessonMap, lid)} (${teacher})`
        })
        throw new SprintError(
            `${names.join(', ')} için seçilen öğretmene ait kayıtlı video bulunamadı.`,
            'TEACHER_PLAYLIST_MISSING'
        )
    }

    return allow
}

async function sumVideoDurationsWithTeacherFilter(
    topics: Topic[],
    allowedPlaylistsByLesson: Map<number, Set<string>>,
    teacherMap: Map<number, string>,
    lessonMap?: Map<number, Lesson>
): Promise<SprintSelectionEstimate> {
    if (!topics.length) return { totalMinutes: 0, videoCount: 0, topicCount: 0 }
    if (!allowedPlaylistsByLesson.size) {
        const { totalMinutes, videoCount } = await sumVideoDurationsByTopicIds(topics.map((t) => t.uuid))
        return { totalMinutes, videoCount, topicCount: topics.length }
    }

    const generalTopics: string[] = []
    const filteredByLesson = new Map<number, string[]>()
    for (const t of topics) {
        const allow = allowedPlaylistsByLesson.get(t.lesson_id)
        if (allow?.size) {
            const arr = filteredByLesson.get(t.lesson_id) ?? []
            arr.push(t.uuid)
            filteredByLesson.set(t.lesson_id, arr)
        } else {
            generalTopics.push(t.uuid)
        }
    }

    let totalMinutes = 0
    let videoCount = 0

    if (generalTopics.length) {
        const res = await sumVideoDurationsByTopicIds(generalTopics)
        totalMinutes += res.totalMinutes
        videoCount += res.videoCount
    }

    const lessonsWithFilter = new Set<number>(filteredByLesson.keys())
    const lessonsWithVideos = new Set<number>()

    for (const [lessonId, topicIds] of filteredByLesson.entries()) {
        const playlists = Array.from(allowedPlaylistsByLesson.get(lessonId) ?? [])
        if (!playlists.length || !topicIds.length) continue
        const chunks = chunkArray(topicIds, 99)
        for (const chunk of chunks) {
            const { data, error } = await withTimeout(
                supabase
                    .from('playlist_videos')
                    .select('duration_minutes')
                    .in('topic_uuid', chunk)
                    .in('playlist_id', playlists)
            ) as any
            if (error) throw error
            const rows = data ?? []
            for (const row of rows) {
                totalMinutes += Number(row.duration_minutes ?? 0)
            }
            if (rows.length) {
                lessonsWithVideos.add(lessonId)
            }
            videoCount += rows.length
        }
    }

    const missingLessons = [...lessonsWithFilter].filter((lid) => !lessonsWithVideos.has(lid))
    if (missingLessons.length) {
        const names = missingLessons.map((lid) => {
            const teacher = teacherMap.get(lid)
            return `${lessonLabel(lessonMap, lid)} (${teacher ?? 'öğretmen'})`
        })
        throw new SprintError(
            `${names.join(', ')} için seçilen öğretmene ait konu videosu bulunamadı.`,
            'TEACHER_VIDEO_MISSING'
        )
    }

    return { totalMinutes, videoCount, topicCount: topics.length }
}

type PreparedVideos = {
    orderedVideos: FlatVideo[]
    lessonMap: Map<number, Lesson>
    sectionMap: Map<number, Section>
    topicOrder: Map<string, number>
    topicById: Map<string, Topic>
    topics: Topic[]
    lessons: Lesson[]
}

async function prepareOrderedVideos(selection: SprintSelection): Promise<PreparedVideos> {
    if (!selection.curriculumId) throw new SprintError('Müfredat seçin', 'NO_CURRICULUM')
    const lessonTeachers = toLessonTeacherMap(selection.lessonTeacherMap)
    const { topics, lessons } = await expandSelectionToTopics(selection)
    if (!topics.length) throw new SprintError('Seçimden konu bulunamadı.', 'NO_TOPICS')

    const videos = await fetchVideosByTopics(topics.map(t => t.uuid))
    if (!videos.length) throw new SprintError('Seçilen konulara ait video bulunamadı.', 'NO_VIDEOS')

    const { lessonMap, sectionMap } = await buildLessonMeta(selection.curriculumId)
    const topicById = new Map<string, Topic>(topics.map(t => [t.uuid, t]))
    const teacherAllowlist = await buildTeacherPlaylistAllowlist(
        selection.curriculumId,
        lessonTeachers,
        lessonMap
    )
    const topicOrder = new Map<string, number>()
    topics.forEach((t) => {
        const order = t.sort_order ?? Number.POSITIVE_INFINITY
        topicOrder.set(t.uuid, order)
    })

    const enriched: FlatVideo[] = videos.map(v => {
        const topic = topicById.get(v.topic_uuid)
        const lesson = topic ? lessonMap.get(topic.lesson_id) : undefined
        return {
            ...v,
            lesson_id: lesson?.id ?? null,
            section_id: lesson?.section_id ?? null,
            topic_title: topic?.title ?? null
        }
    })

    const teacherFilteredLessons = new Set<number>(teacherAllowlist.keys())
    const lessonsWithTeacherVideos = new Set<number>()
    const filteredVideos = enriched.filter((v) => {
        const lid = v.lesson_id ?? null
        if (lid === null) return true
        const allow = teacherAllowlist.get(lid)
        if (!allow?.size) return true
        const keep = allow.has(v.playlist_id)
        if (keep) lessonsWithTeacherVideos.add(lid)
        return keep
    })

    if (teacherFilteredLessons.size) {
        const missingLessons = [...teacherFilteredLessons].filter((lid) => !lessonsWithTeacherVideos.has(lid))
        if (missingLessons.length) {
            const names = missingLessons.map((lid) => `${lessonLabel(lessonMap, lid)} (${lessonTeachers.get(lid) ?? 'öğretmen'})`)
            throw new SprintError(
                `${names.join(', ')} için seçilen öğretmene ait video bulunamadı.`,
                'TEACHER_VIDEO_MISSING'
            )
        }
    }

    if (!filteredVideos.length) throw new SprintError('Seçilen öğretmenlere ait video bulunamadı.', 'NO_VIDEOS_TEACHER')

    const orderedVideos = orderVideosByCurriculum(filteredVideos)

    return { orderedVideos, lessonMap, sectionMap, topicOrder, topicById, topics, lessons }
}

type PlanBuildOptions = {
    userId: string
    sprintId: string
    selection: SprintSelection
    startDateISO: string
    dailyMinutes: number
    lessonDailyMinutes?: Record<number, number>
    orderedVideos: FlatVideo[]
    lessonMap: Map<number, Lesson>
    topicOrder: Map<string, number>
}

async function createStudyPlanFromVideos(opts: PlanBuildOptions): Promise<string[]> {
    const {
        userId,
        sprintId,
        selection,
        startDateISO,
        dailyMinutes,
        lessonDailyMinutes,
        orderedVideos,
        lessonMap,
        topicOrder
    } = opts

    if (typeof console !== 'undefined') {
        const debugList = orderedVideos.map((v, idx) => ({
            order: idx + 1,
            lesson_id: v.lesson_id,
            lesson_name: v.lesson_id ? lessonMap.get(v.lesson_id)?.name ?? null : null,
            topic_uuid: v.topic_uuid,
            topic_order: topicOrder.get(v.topic_uuid) ?? null,
            title: v.title,
            duration_minutes: v.duration_minutes,
            playlist_id: v.playlist_id,
            video_id: v.video_id
        }))
        console.info('[sprint] ders programına eklenecek sıralı videolar', debugList)
    }

    const perLessonCaps = new Map<number, number>()
    if (lessonDailyMinutes) {
        for (const [lessonKey, minutes] of Object.entries(lessonDailyMinutes)) {
            const lessonId = Number(lessonKey)
            if (!Number.isFinite(lessonId)) continue
            const safeMinutes = Math.max(0, Math.floor(Number(minutes) || 0))
            if (safeMinutes > 0) {
                perLessonCaps.set(lessonId, safeMinutes)
            }
        }
    }

    const start = new Date(startDateISO)
    if (Number.isNaN(start.getTime())) throw new SprintError('Geçersiz başlangıç tarihi', 'BAD_DATE')

    const MIN_SLICE_MINUTES = 5
    type DayBin = { date: string; items: ScheduledVideo[]; minutesUsed: number; lessonMinutesUsed: Map<number, number> }
    const dayBins: DayBin[] = []
    let cursor = new Date(start)
    let i = 0

    const dailyCap = Math.max(1, Math.floor(dailyMinutes))
    const partCounter = new Map<string, number>()
    for (const v of orderedVideos) {
        let remaining = Math.max(1, Math.round(v.duration_minutes || 0))
        const original = remaining
        const lessonId = v.lesson_id ?? null
        if (lessonId !== null && perLessonCaps.has(lessonId) && perLessonCaps.get(lessonId)! <= 0) {
            const lessonName = lessonMap.get(lessonId)?.name ?? `Ders #${lessonId}`
            throw new SprintError(`${lessonName} için günlük süre 0 olamaz.`, 'LESSON_CAP_ZERO')
        }

        while (remaining > 0) {
            if (!dayBins[i]) {
                dayBins[i] = { date: isoDate(cursor), items: [], minutesUsed: 0, lessonMinutesUsed: new Map() }
            }
            const bin = dayBins[i]
            if (!bin) throw new SprintError('Planlama sırasında gün slotu oluşturulamadı.', 'BIN_INIT_FAILED')

            const dayRemaining = Math.max(0, dailyCap - bin.minutesUsed)
            const lessonCap = lessonId != null ? perLessonCaps.get(lessonId) ?? null : null
            const usedLessonMinutes = lessonId != null ? bin.lessonMinutesUsed.get(lessonId) ?? 0 : 0
            const lessonRemaining = lessonCap == null ? dayRemaining : Math.max(0, lessonCap - usedLessonMinutes)
            const usable = Math.min(dayRemaining, lessonRemaining)

            if (usable < MIN_SLICE_MINUTES) {
                cursor.setDate(cursor.getDate() + 1)
                i += 1
                continue
            }

            const slice = Math.min(remaining, usable)
            const partIndex = (partCounter.get(v.video_id) ?? 0) + 1
            partCounter.set(v.video_id, partIndex)
            const chunk: ScheduledVideo = {
                ...v,
                duration_minutes: slice,
                original_minutes: original,
                partIndex
            }
            bin.items.push(chunk)
            bin.minutesUsed += slice
            if (lessonId != null) {
                bin.lessonMinutesUsed.set(lessonId, usedLessonMinutes + slice)
            }
            remaining -= slice
            if (remaining > 0) {
                cursor.setDate(cursor.getDate() + 1)
                i += 1
            }
        }
    }

    const totalPartsByVideo = new Map<string, number>()
    for (const bin of dayBins) {
        for (const it of bin.items) {
            if (it.video_id) {
                const idx = typeof (it as any).partIndex === 'number' ? (it as any).partIndex : 1
                const prev = totalPartsByVideo.get(it.video_id) ?? 0
                totalPartsByVideo.set(it.video_id, Math.max(prev, idx))
            }
        }
    }

    const bucket = new Map<string, Record<DayKey, StudyTask[]>>()
    for (const bin of dayBins) {
        const d = new Date(bin.date)
        const weekISO = isoDate(mondayOf(d))
        const dayKey = toDayKey(d)
        if (!bucket.has(weekISO)) {
            bucket.set(weekISO, { monday: [], tuesday: [], wednesday: [], thursday: [], friday: [], saturday: [], sunday: [] })
        }
        const weekMap = bucket.get(weekISO)
        if (!weekMap) continue
        const dayArr = weekMap[dayKey]
        for (const it of bin.items) {
            const totalParts = it.video_id ? totalPartsByVideo.get(it.video_id) ?? 1 : 1
            const partIndex = typeof (it as any).partIndex === 'number' ? (it as any).partIndex : 1
            const titleBase = it.title ?? it.topic_title ?? 'Video'
            const title = totalParts > 1 ? `${titleBase} (Parça ${partIndex}/${totalParts})` : titleBase

            const chunkMinutes = Math.max(0, Math.round((it as any).duration_minutes ?? 0))
            const originalMinutes = Math.max(chunkMinutes, Math.round((it as any).original_minutes ?? chunkMinutes))
            const partialNote = totalParts > 1
                ? `Parça: ${chunkMinutes} dk / Toplam: ${originalMinutes} dk`
                : null
            const notes = partialNote
                ? (it.url ? `${it.url} • ${partialNote}` : partialNote)
                : it.url ?? null

            const task: StudyTask = {
                id: uuid(),
                day: dayKey,
                title,
                notes,
                completed: false,
                curriculum_id: selection.curriculumId,
                section_id: it.section_id ?? null,
                lesson_id: it.lesson_id ?? null,
                topic_uuid: it.topic_uuid
            }
            dayArr.push(task)
        }
    }

    const affectedWeeks: string[] = []
    for (const [weekStartISO, dayMap] of bucket.entries()) {
        const tasks: StudyTask[] = []
        const daily: StudyPlanDTO['daily'] = {
            monday: { total: 0, completed: 0 }, tuesday: { total: 0, completed: 0 }, wednesday: { total: 0, completed: 0 },
            thursday: { total: 0, completed: 0 }, friday: { total: 0, completed: 0 }, saturday: { total: 0, completed: 0 },
            sunday: { total: 0, completed: 0 }
        }
        for (const dk of dayKeys) {
            const list = dayMap[dk] ?? []
            tasks.push(...list)
            daily[dk] = { total: list.length, completed: 0 }
        }
        await StudyPlansAPI.upsertPlan(userId, weekStartISO, tasks, daily, { sprintId, append: true })
        affectedWeeks.push(weekStartISO)
    }

    return affectedWeeks.sort()
}

/** ============== Core ============== */
export const SprintsAPI = {
    async estimateSelection(selection: SprintSelection): Promise<SprintSelectionEstimate> {
        if (!selection.curriculumId) throw new SprintError('Müfredat seçin', 'NO_CURRICULUM')
        const { topics, lessons } = await expandSelectionToTopics(selection)
        if (!topics.length) {
            return { topicCount: 0, videoCount: 0, totalMinutes: 0 }
        }
        const teacherMap = toLessonTeacherMap(selection.lessonTeacherMap)
        const lessonMap = new Map<number, Lesson>(lessons.map((l) => [l.id, l]))
        const allowlist = await buildTeacherPlaylistAllowlist(selection.curriculumId, teacherMap, lessonMap)
        const { totalMinutes, videoCount, topicCount } = await sumVideoDurationsWithTeacherFilter(
            topics,
            allowlist,
            teacherMap,
            lessonMap
        )
        return { totalMinutes, videoCount, topicCount }
    },

    async videosForSelection(selection: SprintSelection): Promise<SprintSelectionVideo[]> {
        const { orderedVideos, lessonMap, sectionMap, topicOrder, topicById } = await prepareOrderedVideos(selection)
        return orderedVideos.map((v, idx) => {
            const lesson = v.lesson_id ? lessonMap.get(v.lesson_id) : undefined
            const section = lesson?.section_id ? sectionMap.get(lesson.section_id) : undefined
            const topic = topicById.get(v.topic_uuid)
            return {
                order: idx + 1,
                playlistId: v.playlist_id,
                videoId: v.video_id,
                title: v.title,
                durationMinutes: v.duration_minutes,
                lessonId: v.lesson_id ?? null,
                lessonName: lesson?.name ?? null,
                lessonCode: lesson?.code ?? null,
                sectionId: v.section_id ?? null,
                sectionCode: section?.code ?? null,
                topicUuid: v.topic_uuid,
                topicTitle: topic?.title ?? v.topic_title ?? null,
                topicOrder: topicOrder.get(v.topic_uuid) ?? null,
            }
        })
    },

    async listByUser(userId: string): Promise<SprintSummary[]> {
        if (!userId) throw new SprintError('Kullanıcı bulunamadı', 'NO_USER')
        try {
            const { data, error } = await withTimeout(
                supabase
                    .from('sprints')
                    .select('*')
                    .eq('user_id', userId)
                    .order('created_at', { ascending: false })
            ) as any
            if (error) throw error
            const rows: SprintRow[] = (data ?? []).map((row: any) => normalizeSprintRow(row))
            if (!rows.length) return []

            const ids = rows.map(row => row.id)
            const planStats = new Map<string, { total: number; completed: number }>()
            const contentStats = new Map<string, { sections: number; lessons: number; topics: number }>()

            if (ids.length) {
                const { data: planRows, error: planErr } = await withTimeout(
                    supabase
                        .from('study_plans')
                        .select('id,sprint_id,total_tasks,completed_tasks')
                        .eq('user_id', userId)
                        .in('sprint_id', ids)
                ) as any
                if (planErr) throw planErr
                for (const plan of planRows ?? []) {
                    if (!plan?.sprint_id) continue
                    const sid = String(plan.sprint_id)
                    const prev = planStats.get(sid) ?? { total: 0, completed: 0 }
                    prev.total += Number(plan.total_tasks ?? 0)
                    prev.completed += Number(plan.completed_tasks ?? 0)
                    planStats.set(sid, prev)
                }
            }

            await Promise.all(rows.map(async (row) => {
                const stats = await fetchSprintContentStats(row.id)
                contentStats.set(row.id, stats)
            }))

            return rows.map(row => {
                const totals = planStats.get(row.id) ?? { total: 0, completed: 0 }
                const completionRate = totals.total ? (totals.completed / totals.total) * 100 : 0
                const content = contentStats.get(row.id)
                const scopeCounts = content
                    ? {
                        sections: content.sections,
                        lessons: content.lessons,
                        topics: content.topics
                    }
                    : {
                        sections: row.scope.sections.length,
                        lessons: row.scope.lessons.length,
                        topics: row.scope.topics.length
                    }
                return {
                    id: row.id,
                    title: row.title,
                    status: row.status,
                    created_at: row.created_at,
                    updated_at: row.updated_at,
                    scope: row.scope,
                    cadence: row.cadence,
                    scopeCounts,
                    stats: {
                        totalTasks: totals.total,
                        completedTasks: totals.completed,
                        completionRate
                    }
                }
            })
        } catch (e: any) {
            throw new SprintError(e?.message || 'Sprint listesi alınamadı.', e?.code)
        }
    },

    async deleteById(userId: string, sprintId: string): Promise<void> {
        if (!userId) throw new SprintError('Kullanıcı bulunamadı', 'NO_USER')
        if (!sprintId) throw new SprintError('Koşu bulunamadı', 'NO_SPRINT')
        try {
            const { data: planRows, error: planErr } = await withTimeout(
                supabase
                    .from('study_plans')
                    .select('id')
                    .eq('user_id', userId)
                    .eq('sprint_id', sprintId)
            ) as any
            if (planErr) throw planErr
            const planIds: string[] = (planRows ?? [])
                .map((row: any) => (row?.id ? String(row.id) : null))
                .filter((id: string | null): id is string => !!id)

            if (planIds.length) {
                const chunks = chunkArray(planIds, 99)
                for (const chunk of chunks) {
                    if (!chunk.length) continue
                    const taskRes = await withTimeout(
                        supabase.from('study_plan_tasks').delete().in('plan_id', chunk)
                    ) as any
                    if (taskRes.error) throw taskRes.error
                    const dailyRes = await withTimeout(
                        supabase.from('study_plan_daily_stats').delete().in('plan_id', chunk)
                    ) as any
                    if (dailyRes.error) throw dailyRes.error
                }
            }

            const deletePlans = await withTimeout(
                supabase.from('study_plans').delete().eq('user_id', userId).eq('sprint_id', sprintId)
            ) as any
            if (deletePlans.error) throw deletePlans.error

            const deleteSprint = await withTimeout(
                supabase.from('sprints').delete().eq('id', sprintId).eq('user_id', userId)
            ) as any
            if (deleteSprint.error) throw deleteSprint.error
        } catch (e: any) {
            throw new SprintError(e?.message || 'Sprint silinemedi.', e?.code)
        }
    },

    async generate(input: SprintGenerateInput): Promise<SprintGenerateResult> {
        try {
            if (!input.userId) throw new SprintError('Kullanıcı bulunamadı', 'NO_USER')
            if (!input.selection?.curriculumId) throw new SprintError('Müfredat seçin', 'NO_CURRICULUM')
            const prepared = await prepareOrderedVideos(input.selection)
            const sprintTitle = buildSprintTitle(prepared.lessons, prepared.topics, prepared.lessonMap)

            const { data: sprintRow, error: sprintErr } = await withTimeout(
                supabase.from('sprints').insert({
                    user_id: input.userId,
                    title: sprintTitle,
                    scope: {
                        curriculum_id: input.selection.curriculumId,
                        sections: input.selection.sectionIds ?? [],
                        lessons: input.selection.lessonIds ?? [],
                        topics: input.selection.topicIds ?? [],
                        lesson_teachers: input.selection.lessonTeacherMap ?? {}
                    },
                    cadence: {
                        start_date: input.startDateISO,
                        daily_minutes: input.dailyMinutes,
                        lesson_daily_minutes: input.lessonDailyMinutes ?? {}
                    },
                    status: 'active'
                }).select('id').single()
            ) as any
            if (sprintErr) throw sprintErr
            const sprintId = sprintRow.id as string

            const { orderedVideos, lessonMap, topicOrder } = prepared

            const affectedWeeks = await createStudyPlanFromVideos({
                userId: input.userId,
                sprintId,
                selection: input.selection,
                startDateISO: input.startDateISO,
                dailyMinutes: input.dailyMinutes,
                lessonDailyMinutes: input.lessonDailyMinutes,
                orderedVideos,
                lessonMap,
                topicOrder
            })

            return { sprint_id: sprintId, created_plan_week_starts: affectedWeeks }
        } catch (e: any) {
            throw new SprintError(e?.message || 'Sprint üretimi başarısız.', e?.code)
        }
    }
}
