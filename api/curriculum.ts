// src/api/curriculum.ts
import type { SupabaseClient } from '@supabase/supabase-js'
import { StudySessionsAPI } from './studySessions'

/** ============ Types (timestamps YOK) ============ */
export type Curriculum = {
    id: string
    exam: string
    version: string
    notes?: string[] | null
}

export type Section = {
    id: number
    curriculum_id: string
    code: string
    name: string
}

export type Lesson = {
    id: number
    section_id: number
    code: string
    name: string
}

export type Topic = {
    id: string               // uuid (curriculum_topics.new_id)
    uuid: string             // alias to id for backward compatibility
    lesson_id: number
    title: string
    sort_order: number | null
}

/** Ağaç görünümleri */
export type LessonWithTopics = Lesson & { topics: Topic[] }
export type SectionWithLessons = Section & { lessons: LessonWithTopics[] }
export type CurriculumTree = Curriculum & { sections: SectionWithLessons[] }

/** ============ Errors & helpers ============ */
class CurriculumError extends Error {
    public code?: string
    constructor(msg: string, code?: string) {
        super(msg)
        this.code = code
    }
}

function withTimeout<T>(p: PromiseLike<T>, ms = 10_000) {
    return Promise.race<T>([
        p,
        new Promise<T>((_, rej) =>
            setTimeout(() => rej(new CurriculumError('İstek zaman aşımına uğradı.', 'TIMEOUT')), ms)
        )
    ])
}

function normalizeError(e: any): CurriculumError {
    const msg = e?.message || e?.error?.message || 'Beklenmeyen bir hata oluştu.'
    const code = e?.code || e?.error?.code
    return new CurriculumError(msg, code)
}

const mapTopic = (row: any): Topic => {
    const newId = row?.new_id ?? row?.id
    const uuid = newId ? String(newId) : ''
    return {
        id: uuid,
        uuid,
        lesson_id: Number(row?.lesson_id ?? 0),
        title: String(row?.title ?? ''),
        sort_order: row?.sort_order ?? null
    }
}

/** ============ API ============ */
export const CurriculumAPI = {
    /** ---- Curricula ---- */
    async fetchAll(client: SupabaseClient): Promise<Curriculum[]> {
        try {
            const { data, error } = await withTimeout(
                client.from('curricula').select('id,exam,version,notes').order('id')
            )
            if (error) throw error
            return (data ?? []) as Curriculum[]
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async fetchById(client: SupabaseClient, id: string): Promise<Curriculum | null> {
        try {
            const { data, error } = await withTimeout(
                client.from('curricula').select('id,exam,version,notes').eq('id', id).single()
            )
            if (error) throw error
            return (data ?? null) as Curriculum | null
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** sections/lessons/topics sayıları — timestamps olmadan */
    async fetchStats(client: SupabaseClient, curriculumId: string): Promise<{ sections: number; lessons: number; topics: number }> {
        try {
            // 1) Sections: sadece id listesi ve sayım
            const secIdsRes = await withTimeout(
                client.from('curriculum_sections').select('id').eq('curriculum_id', curriculumId)
            ) as any
            if (secIdsRes.error) throw secIdsRes.error
            const sectionIds: number[] = (secIdsRes.data ?? []).map((r: any) => r.id as number)

            const secCountRes = await withTimeout(
                client
                    .from('curriculum_sections')
                    .select('id', { count: 'exact', head: true })
                    .eq('curriculum_id', curriculumId)
            ) as any
            if (secCountRes.error) throw secCountRes.error
            const sections = (secCountRes.count ?? 0) as number

            // 2) Lessons
            let lessons = 0
            let lessonIds: number[] = []
            if (sectionIds.length) {
                const lesIdsRes = await withTimeout(
                    client.from('curriculum_lessons').select('id').in('section_id', sectionIds)
                ) as any
                if (lesIdsRes.error) throw lesIdsRes.error
                lessonIds = (lesIdsRes.data ?? []).map((r: any) => r.id as number)

                const lesCountRes = await withTimeout(
                    client
                        .from('curriculum_lessons')
                        .select('id', { count: 'exact', head: true })
                        .in('section_id', sectionIds)
                ) as any
                if (lesCountRes.error) throw lesCountRes.error
                lessons = (lesCountRes.count ?? 0) as number
            }

            // 3) Topics
            let topics = 0
            if (lessonIds.length) {
                const topCountRes = await withTimeout(
                    client
                        .from('curriculum_topics')
                        .select('new_id', { count: 'exact', head: true })
                        .in('lesson_id', lessonIds)
                ) as any
                if (topCountRes.error) throw topCountRes.error
                topics = (topCountRes.count ?? 0) as number
            }

            return { sections, lessons, topics }
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** JSON -> DB upsert (admin gerektirir; RLS politikaları bunu yönetir) */
    async upsertFromJson(client: SupabaseClient, id: string, payload: any): Promise<void> {
        try {
            const { error } = await withTimeout(
                client.rpc('upsert_curriculum_json', { p_id: id, p_json: payload })
            )
            if (error) throw error
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** (opsiyonel) Admin silme */
    async removeCurriculum(client: SupabaseClient, id: string): Promise<void> {
        try {
            const { error } = await withTimeout(
                client.from('curricula').delete().eq('id', id)
            )
            if (error) throw error
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** Müfredat kaydet (insert veya update) */
    async saveCurriculum(client: SupabaseClient, payload: Curriculum): Promise<Curriculum> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curricula')
                    .upsert({ ...payload, notes: payload.notes ?? null })
                    .select('id,exam,version,notes')
                    .single()
            )
            if (error) throw error
            return data as Curriculum
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** ---- Sections yönetimi ---- */
    async createSection(client: SupabaseClient, curriculumId: string, payload: { code: string; name: string }): Promise<Section> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_sections')
                    .insert([{ curriculum_id: curriculumId, code: payload.code, name: payload.name }])
                    .select('id,curriculum_id,code,name')
                    .single()
            )
            if (error) throw error
            return data as Section
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async updateSection(client: SupabaseClient, sectionId: number, payload: Partial<{ code: string; name: string }>): Promise<Section> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_sections')
                    .update(payload)
                    .eq('id', sectionId)
                    .select('id,curriculum_id,code,name')
                    .single()
            )
            if (error) throw error
            return data as Section
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async deleteSection(client: SupabaseClient, sectionId: number): Promise<void> {
        try {
            const { error } = await withTimeout(
                client.from('curriculum_sections').delete().eq('id', sectionId)
            )
            if (error) throw error
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** ---- Lessons yönetimi ---- */
    async createLesson(client: SupabaseClient, sectionId: number, payload: { code: string; name: string }): Promise<Lesson> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_lessons')
                    .insert([{ section_id: sectionId, code: payload.code, name: payload.name }])
                    .select('id,section_id,code,name')
                    .single()
            )
            if (error) throw error
            return data as Lesson
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async updateLesson(client: SupabaseClient, lessonId: number, payload: Partial<{ code: string; name: string }>): Promise<Lesson> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_lessons')
                    .update(payload)
                    .eq('id', lessonId)
                    .select('id,section_id,code,name')
                    .single()
            )
            if (error) throw error
            return data as Lesson
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async deleteLesson(client: SupabaseClient, lessonId: number): Promise<void> {
        try {
            const { error } = await withTimeout(
                client.from('curriculum_lessons').delete().eq('id', lessonId)
            )
            if (error) throw error
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** ---- Topics yönetimi ---- */
    async createTopic(client: SupabaseClient, lessonId: number, payload: { id: string; title: string; sort_order?: number | null }): Promise<Topic> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_topics')
                    .insert([{
                        lesson_id: lessonId,
                        new_id: payload.id,
                        title: payload.title,
                        sort_order: payload.sort_order ?? null
                    }])
                    .select('new_id,lesson_id,title,sort_order')
                    .single()
            )
            if (error) throw error
            return mapTopic(data)
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async updateTopic(client: SupabaseClient, topicId: string, payload: Partial<{ title: string; sort_order: number | null }>): Promise<Topic> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_topics')
                    .update(payload)
                    .eq('new_id', topicId)
                    .select('new_id,lesson_id,title,sort_order')
                    .single()
            )
            if (error) throw error
            return mapTopic(data)
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async deleteTopic(client: SupabaseClient, topicId: string): Promise<void> {
        try {
            // Önce ilgili çalışma oturumlarını sil (cascade benzeri işlem)
            // Note: StudySessionsAPI MUST also be updated or handled here. 
            // However, assuming StudySessionsAPI is a separate module that we will handle later.
            // Wait, StudySessionsAPI is imported. We need to pass client to it too if it's refactored.
            // For now, let's assume usage of StudySessionsAPI needs update here.
            await StudySessionsAPI.deleteByTopicId(client, topicId)
            
            const { error } = await withTimeout(
                client.from('curriculum_topics').delete().eq('new_id', topicId)
            )
            if (error) throw error
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** ---- Sections ---- */
    async fetchSectionsByCurriculumId(client: SupabaseClient, curriculumId: string): Promise<Section[]> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_sections')
                    .select('id,curriculum_id,code,name')
                    .eq('curriculum_id', curriculumId)
                    .order('code', { ascending: true })
            )
            if (error) throw error
            return (data ?? []) as Section[]
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async fetchSectionByCode(client: SupabaseClient, curriculumId: string, sectionCode: string): Promise<Section | null> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_sections')
                    .select('id,curriculum_id,code,name')
                    .eq('curriculum_id', curriculumId)
                    .eq('code', sectionCode)
                    .single()
            )
            if (error) throw error
            return (data ?? null) as Section | null
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** ---- Lessons ---- */
    async fetchLessonsBySectionId(client: SupabaseClient, sectionId: number): Promise<Lesson[]> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_lessons')
                    .select('id,section_id,code,name')
                    .eq('section_id', sectionId)
                    .order('code', { ascending: true })
            )
            if (error) throw error
            return (data ?? []) as Lesson[]
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async fetchLessonsByIds(client: SupabaseClient, lessonIds: number[]): Promise<Lesson[]> {
        if (!lessonIds?.length) return []
        try {
            const uniqueIds = Array.from(new Set(lessonIds))
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_lessons')
                    .select('id,section_id,code,name')
                    .in('id', uniqueIds)
            )
            if (error) throw error
            return (data ?? []) as Lesson[]
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async fetchLessonsBySectionCode(client: SupabaseClient, curriculumId: string, sectionCode: string): Promise<Lesson[]> {
        try {
            const section = await this.fetchSectionByCode(client, curriculumId, sectionCode)
            if (!section) return []
            return this.fetchLessonsBySectionId(client, section.id)
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** ---- Topics ---- */
    async fetchTopicsByLessonId(client: SupabaseClient, lessonId: number): Promise<Topic[]> {
        try {
            const { data, error } = await withTimeout(
                client
                    .from('curriculum_topics')
                    .select('new_id,lesson_id,title,sort_order')
                    .eq('lesson_id', lessonId)
                    .order('sort_order', { ascending: true })
                    .order('new_id', { ascending: true })
            )
            if (error) throw error
            return (data ?? []).map(mapTopic)
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async fetchTopicsByCodes(
        client: SupabaseClient,
        curriculumId: string,
        sectionCode: string,
        lessonCode: string
    ): Promise<Topic[]> {
        try {
            const section = await this.fetchSectionByCode(client, curriculumId, sectionCode)
            if (!section) return []
            const lessons = await this.fetchLessonsBySectionId(client, section.id)
            const lesson = lessons.find((l) => l.code === lessonCode)
            if (!lesson) return []
            return this.fetchTopicsByLessonId(client, lesson.id)
        } catch (e) {
            throw normalizeError(e)
        }
    },

    async findTopicById(client: SupabaseClient, topicId: string): Promise<Topic | null> {
        try {
            const query = client
                .from('curriculum_topics')
                .select('new_id,lesson_id,title,sort_order')
                .eq('new_id', topicId)
                .maybeSingle()

            const { data, error } = await withTimeout(query)
            if (error) throw error
            return data ? mapTopic(data) : null
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** basit arama (title ILIKE) — curriculum filtresi opsiyonel */
    async searchTopics(client: SupabaseClient, q: string, opts?: { curriculumId?: string; limit?: number }): Promise<Topic[]> {
        try {
            const limit = opts?.limit ?? 50
            const base = client
                .from('curriculum_topics')
                .select(
                    `
          new_id, lesson_id, title, sort_order,
          lesson:curriculum_lessons!inner (
            id, code, name,
            section:curriculum_sections!inner (
              id, code, name, curriculum_id
            )
          )
        `
                )
                .ilike('title', `%${q}%`)
                .limit(limit)

            const query = opts?.curriculumId
                ? base.eq('lesson.section.curriculum_id', opts.curriculumId)
                : base

            const { data, error } = await withTimeout(query)
            if (error) throw error

            return (data ?? []).map((row: any) => mapTopic(row))
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** ---- Tree (curriculum -> sections -> lessons -> topics) ---- */
    async fetchTree(client: SupabaseClient, curriculumId: string): Promise<CurriculumTree> {
        try {
            const { data: cur, error: curErr } = await withTimeout(
                client.from('curricula').select('id,exam,version,notes').eq('id', curriculumId).single()
            )
            if (curErr) throw curErr
            if (!cur) throw new CurriculumError('Müfredat bulunamadı', 'NOT_FOUND')

            const { data: sections, error: secErr } = await withTimeout(
                client
                    .from('curriculum_sections')
                    .select(
                        `
            id, curriculum_id, code, name,
            lessons:curriculum_lessons (
              id, section_id, code, name,
              topics:curriculum_topics (
                new_id, lesson_id, title, sort_order
              )
            )
          `
                    )
                    .eq('curriculum_id', curriculumId)
                    .order('code', { ascending: true })
            )
            if (secErr) throw secErr

            const tree: CurriculumTree = {
                ...(cur as Curriculum),
                sections: (sections ?? []).map((s: any) => ({
                    id: s.id,
                    curriculum_id: s.curriculum_id,
                    code: s.code,
                    name: s.name,
                    lessons: (s.lessons ?? []).map((l: any) => ({
                        id: l.id,
                        section_id: l.section_id,
                        code: l.code,
                        name: l.name,
                        topics: (l.topics ?? [])
                            .sort((a: any, b: any) => {
                                const sa = a.sort_order ?? 9_999
                                const sb = b.sort_order ?? 9_999
                                return sa === sb
                                    ? String(a.new_id ?? '').localeCompare(String(b.new_id ?? ''))
                                    : sa - sb
                            })
                            .map((t: any) => mapTopic({ ...t, lesson_id: t.lesson_id ?? l.id }))
                    }))
                }))
            }

            return tree
        } catch (e) {
            throw normalizeError(e)
        }
    }
}
