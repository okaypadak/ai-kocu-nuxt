// src/api/youtubePlaylists.ts
import { supabase } from '../lib/supabase'

export type YoutubeVideo = {
  id: string
  title: string
  duration: string
  durationMinutes: number
  url: string
  topicId?: string
  code?: string
  sortOrder?: number | null
}

export type SavedPlaylist = {
  id: string
  teacher: string | null
  curriculum_id: string | null
  section_id: number | null
  lesson_id: number | null
  section?: { id: number; code: string; name: string } | null
  lesson?: { id: number; code: string; name: string } | null
}

export type LessonTeacher = {
  lessonId: number
  sectionId: number | null
  teacher: string
}

/** ISO8601 PT.. süreyi dakikaya çevirir (float) */
export function parseIsoDurationToMinutes(iso: string): number {
  const m = iso.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/)
  const h = parseInt(m?.[1] || '0', 10)
  const min = parseInt(m?.[2] || '0', 10)
  const s = parseInt(m?.[3] || '0', 10)
  return h * 60 + min + s / 60
}

/** Playlist’teki TÜM videoId’leri sayfalayarak çeker */
export async function fetchAllPlaylistVideoIds(playlistId: string, apiKey: string): Promise<string[]> {
  const ids = new Set<string>()
  let pageToken: string | undefined = undefined
  const base = 'https://www.googleapis.com/youtube/v3/playlistItems'

  do {
    const url = new URL(base)
    url.searchParams.set('part', 'snippet')
    url.searchParams.set('maxResults', '50')
    url.searchParams.set('playlistId', playlistId)
    url.searchParams.set('key', apiKey)
    if (pageToken) url.searchParams.set('pageToken', pageToken)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`YouTube playlistItems ${res.status}`)
    const json: any = await res.json()
    for (const it of json.items ?? []) {
      const vid = it?.snippet?.resourceId?.videoId
      if (vid) ids.add(String(vid))
    }
    pageToken = json.nextPageToken ?? undefined
  } while (pageToken)

  return Array.from(ids)
}

/** /videos ile detayları 50’lik chunk’larla çeker ve map’ler */
export async function fetchVideosDetails(videoIds: string[], apiKey: string): Promise<YoutubeVideo[]> {
  const base = 'https://www.googleapis.com/youtube/v3/videos'
  const details = new Map<string, YoutubeVideo>()
  for (let i = 0; i < videoIds.length; i += 50) {
    const chunk = videoIds.slice(i, i + 50)
    const url = new URL(base)
    url.searchParams.set('part', 'contentDetails,snippet')
    url.searchParams.set('id', chunk.join(','))
    url.searchParams.set('key', apiKey)

    const res = await fetch(url.toString())
    if (!res.ok) throw new Error(`YouTube videos ${res.status}`)
    const json: any = await res.json()
    for (const v of json.items ?? []) {
      const id = String(v.id)
      const title = String(v.snippet?.title ?? '')
      const durationIso = String(v.contentDetails?.duration ?? 'PT0S')
      const durationMinutes = parseIsoDurationToMinutes(durationIso)
      details.set(id, {
        id,
        title,
        duration: durationIso,
        durationMinutes,
        url: `https://www.youtube.com/watch?v=${id}`,
        topicId: undefined,
        code: '',
        sortOrder: null,
      })
    }
  }
  const ordered: YoutubeVideo[] = []
  for (let idx = 0; idx < videoIds.length; idx += 1) {
    const id = videoIds[idx]
    if (typeof id !== 'string') continue
    const item = details.get(id)
    if (!item) continue
    ordered.push({
      ...item,
      sortOrder: idx + 1,
    })
  }
  return ordered
}

/** Supabase: kayıtlı playlist summary listesini getirir */
export async function listSavedPlaylists(): Promise<SavedPlaylist[]> {
  const { data, error } = await supabase
    .from('playlists')
    .select(
      `
        id,
        teacher,
        curriculum_id,
        section_id,
        lesson_id,
        section:curriculum_sections ( id, code, name ),
        lesson:curriculum_lessons ( id, code, name )
      `
    )
    .order('id', { ascending: true })
  if (error) throw error
  return (data ?? []).map((row: any) => ({
    id: String(row.id),
    teacher: row.teacher ?? null,
    curriculum_id: row.curriculum_id ?? null,
    section_id: typeof row.section_id === 'number' ? row.section_id : null,
    lesson_id: typeof row.lesson_id === 'number' ? row.lesson_id : null,
    section: row.section
      ? {
          id: Number(row.section.id),
          code: String(row.section.code ?? ''),
          name: String(row.section.name ?? ''),
        }
      : null,
    lesson: row.lesson
      ? {
          id: Number(row.lesson.id),
          code: String(row.lesson.code ?? ''),
          name: String(row.lesson.name ?? ''),
        }
      : null,
  })) as SavedPlaylist[]
}

/** Supabase: müfredat + ders filtrasyonuyla öğretmen listesi (duplikasyonlar ayıklanır) */
export async function listLessonTeachers(params: {
  curriculumId: string
  lessonIds?: number[]
}): Promise<LessonTeacher[]> {
  const { curriculumId, lessonIds = [] } = params
  if (!curriculumId) return []
  if (lessonIds.length === 0) return []

  const { data, error } = await supabase
    .from('playlists')
    .select('teacher, section_id, lesson_id')
    .eq('curriculum_id', curriculumId)
    .in('lesson_id', lessonIds)
    .not('teacher', 'is', null)
    .not('lesson_id', 'is', null)
  if (error) throw error

  const map = new Map<string, LessonTeacher>()
  for (const row of data ?? []) {
    const lessonId = typeof row.lesson_id === 'number' ? row.lesson_id : Number(row.lesson_id)
    const teacher = String(row.teacher ?? '').trim()
    if (!lessonId || !teacher) continue
    const key = `${lessonId}::${teacher.toLocaleLowerCase('tr')}`
    if (map.has(key)) continue
    map.set(key, {
      lessonId,
      sectionId: typeof row.section_id === 'number' ? row.section_id : null,
      teacher,
    })
  }

  return Array.from(map.values()).sort((a, b) => {
    if (a.lessonId !== b.lessonId) return a.lessonId - b.lessonId
    return a.teacher.localeCompare(b.teacher, 'tr', { sensitivity: 'base' })
  })
}

/** Supabase: bir playlist’in kayıtlı videolarını getirir (prefill için) */
export async function listPlaylistVideos(playlistId: string): Promise<YoutubeVideo[]> {
  const { data, error } = await supabase
    .from('playlist_videos')
    .select('*')
    .eq('playlist_id', playlistId)
    .order('sort_order', { ascending: true })
    .order('video_id', { ascending: true })
  if (error) throw error
  return (data ?? []).map((r: any) => ({
    id: String(r.video_id),
    title: String(r.title ?? ''),
    duration: String(r.duration_minutes ?? 0),
    durationMinutes: Number(r.duration_minutes ?? 0),
    url: String(r.url ?? ''),
    topicId: r.topic_uuid ?? undefined,
    code: r.topic_uuid ? String(r.topic_uuid) : '',
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : null,
  }))
}

/** Prefill: Supabase’te olan kayıtlarla YouTube’tan gelenleri birleştir */
export async function prefillFromSupabase(playlistId: string, fresh: YoutubeVideo[]): Promise<YoutubeVideo[]> {
  const existing = await listPlaylistVideos(playlistId)
  const byId = new Map(fresh.map(v => [v.id, v]))
  for (const ex of existing) {
    const hit = byId.get(ex.id)
    if (!hit) continue
    hit.topicId = ex.topicId ?? hit.topicId
    hit.code = ex.topicId ?? ''
    if (typeof ex.sortOrder === 'number') {
      hit.sortOrder = ex.sortOrder
    }
  }
  return Array.from(byId.values())
}

/** Supabase: videoları upsert eder ve playlist özetini günceller */
export async function savePlaylistBundle(params: {
  playlistId: string
  teacher: string
  curriculumId?: string | null
  sectionId?: number | null
  lessonId?: number | null
  videos: YoutubeVideo[]
}) {
  const { playlistId, teacher, curriculumId = null, sectionId = null, lessonId = null, videos } = params

  // 1) playlist summary upsert
  {
    const summary: Record<string, any> = {
      id: playlistId,
      teacher,
    }

    const trimmedCurr = (curriculumId ?? '').toString().trim()
    if (trimmedCurr) {
      summary.curriculum_id = trimmedCurr
    } else {
      summary.curriculum_id = null
    }

    summary.section_id = typeof sectionId === 'number' ? sectionId : null
    summary.lesson_id = typeof lessonId === 'number' ? lessonId : null

    const { error } = await supabase
      .from('playlists')
      .upsert(summary)

    if (error) {
      const msg = String(error.message ?? '')
      if (!msg.includes('playlists')) throw error

      const fallback = { ...summary }
      const missing: string[] = []
      if (msg.includes("'curriculum_id'")) {
        delete fallback.curriculum_id
        missing.push('curriculum_id')
      }
      if (msg.includes("'section_id'")) {
        delete fallback.section_id
        missing.push('section_id')
      }
      if (msg.includes("'lesson_id'")) {
        delete fallback.lesson_id
        missing.push('lesson_id')
      }

      if (!missing.length) throw error

      const { error: fallbackError } = await supabase.from('playlists').upsert(fallback)
      if (fallbackError) throw fallbackError
      console.warn(
        `[playlists] ${missing.join(', ')} alan(lar)ı Supabase şemasında bulunamadı, bu alan(lar) kaydedilmedi.`,
        error
      )
    }
  }

  // 2) videos replace (delete all + insert new)
  // Mevcut videoları sil
  const { error: delError } = await supabase
    .from('playlist_videos')
    .delete()
    .eq('playlist_id', playlistId)

  if (delError) throw delError

  const rows = videos.map(v => ({
    playlist_id: playlistId,
    video_id: v.id,
    title: v.title,
    duration_minutes: Number.isFinite(v.durationMinutes) ? Math.round(v.durationMinutes) : null,
    url: v.url,
    topic_uuid: v.topicId ?? null,
    sort_order: typeof v.sortOrder === 'number' ? v.sortOrder : null,
  }))

  // Chunk’layıp insert et
  const CHUNK = 500
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK)
    const { error } = await supabase
      .from('playlist_videos')
      .insert(chunk)
    if (error) throw error
  }
}
