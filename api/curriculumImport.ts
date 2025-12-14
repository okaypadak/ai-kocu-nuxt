// src/api/curriculumImport.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type CurriculumDoc = {
    id?: string           // opsiyonel – tek doküman için override edilebilir
    exam?: string
    title?: string
    version?: string
    notes?: string[]
    sections?: Array<{
        code?: string
        name?: string
        lessons?: Array<{
            code?: string
            name?: string
            topics?: Array<{ id: string; title: string }>
        }>
    }>
}

export type ImportOptions = {
    id?: string          // tek doküman için zorlayacağın id (override)
    merge?: boolean      // true ise mevcut curriculum_json.payload ile merge
    preferExamTitle?: boolean // true ise title'ı exam ile eşitler (client-side)
}

export type ImportResult = { ids: string[] }

export class CurriculumImportError extends Error {
    public code?: string;

    constructor(message: string, code?: string) {
        super(message)
        this.code = code;
    }
}

function normalizeError(e: any) {
    const msg = e?.message || e?.error?.message || 'İçe aktarma başarısız.'
    const code = e?.code || e?.error?.code
    return new CurriculumImportError(msg, code)
}

function withTimeout<T>(p: PromiseLike<T>, ms = 20_000) {
    return Promise.race<T>([
        p,
        new Promise<T>((_, rej) =>
            setTimeout(() => rej(new CurriculumImportError('İstek zaman aşımına uğradı.', 'TIMEOUT')), ms)
        ),
    ])
}

/** Türkçe karakterler için basit slugify */
export function slugify(input: string) {
    const map: Record<string, string> = {
        'ğ': 'g', 'Ğ': 'g', 'ü': 'u', 'Ü': 'u', 'ş': 's', 'Ş': 's',
        'ı': 'i', 'İ': 'i', 'ö': 'o', 'Ö': 'o', 'ç': 'c', 'Ç': 'c',
    }
    return (input || '')
        .replace(/[ğĞüÜşŞıİöÖçÇ]/g, (m) => map[m] || m)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '')
        .slice(0, 120)
}

/** Tek doküman için id önerisi */
export function suggestIdForOne(raw: CurriculumDoc): string {
    const exam = (raw?.exam ?? raw?.title ?? '').toString()
    const version = (raw?.version ?? '').toString()
    const base = [exam, version].filter(Boolean).join('-') || 'curriculum'
    return slugify(base)
}

/** Basit derin birleştirme (array’leri gelen ile değiştirir) */
function deepMerge(a: any, b: any): any {
    if (Array.isArray(a) && Array.isArray(b)) return b
    if (a && b && typeof a === 'object' && typeof b === 'object') {
        const out: any = { ...a }
        for (const k of Object.keys(b)) out[k] = deepMerge(a?.[k], b[k])
        return out
    }
    return b ?? a
}

/** stats hesaplama */
export function computeStats(list: CurriculumDoc[]) {
    let sections = 0, lessons = 0, topics = 0
    for (const doc of list) {
        const ss = Array.isArray(doc.sections) ? doc.sections : []
        sections += ss.length
        for (const s of ss) {
            const ls = Array.isArray(s?.lessons) ? s.lessons : []
            lessons += ls.length
            for (const l of ls) {
                const ts = Array.isArray(l?.topics) ? l.topics : []
                topics += ts.length
            }
        }
    }
    return { sections, lessons, topics }
}

/** curriculum_json tablosundan mevcut payload oku (merge için) */
async function getExistingPayload(client: SupabaseClient, id: string): Promise<any | null> {
    const { data, error } = await withTimeout(
        client.from('curriculum_json').select('payload').eq('id', id).maybeSingle()
    )
    if (error) throw error
    return data?.payload ?? null
}

/** RPC çağrısı: public.upsert_curriculum_json(p_id, p_json) */
async function rpcUpsert(client: SupabaseClient, id: string, payload: any) {
    const { error } = await withTimeout(
        client.rpc('upsert_curriculum_json', { p_id: id, p_json: payload })
    )
    if (error) throw error
}

export const CurriculumImportAPI = {
    /**
     * Tek doküman upsert:
     * - preferExamTitle true ise title=exam
     * - merge true ise mevcut payload ile merge ederek gönder
     */
    async upsertOne(client: SupabaseClient, raw: CurriculumDoc, opts: ImportOptions = {}): Promise<string> {
        try {
            const id = (opts.id || raw.id || suggestIdForOne(raw)).trim()
            if (!id) throw new CurriculumImportError('Geçerli bir id üretilemedi.')

            // client-side küçük düzenlemeler:
            const payload = { ...raw }
            if (opts.preferExamTitle && payload.exam) {
                payload.title = payload.exam
            }

            let finalPayload: any = payload
            if (opts.merge) {
                const existing = await getExistingPayload(client, id)
                finalPayload = existing ? deepMerge(existing, payload) : payload
            }

            await rpcUpsert(client, id, finalPayload)
            return id
        } catch (e) {
            throw normalizeError(e)
        }
    },

    /** Çoklu upsert: her dokümana id öner ve sırayla RPC çağır */
    async upsertMany(client: SupabaseClient, list: CurriculumDoc[], opts: Omit<ImportOptions, 'id'> = {}): Promise<string[]> {
        try {
            const ids: string[] = []
            for (const raw of list) {
                const id = await this.upsertOne(client, raw, { ...opts, id: undefined })
                ids.push(id)
            }
            return ids
        } catch (e) {
            throw normalizeError(e)
        }
    },
}
