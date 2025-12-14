
// Moved from server/utils/supabase.ts
// Premium/Cookie logic only.

/* ------------------------------------------------------------------ */
/* CONFIG & HELPERS                                                  */
/* ------------------------------------------------------------------ */

const getPremiumSecret = () => {
    const config = useRuntimeConfig()
    const PREMIUM_COOKIE_SECRET = (config.premiumCookieSecret as string | undefined)?.trim()
    if (!PREMIUM_COOKIE_SECRET) {
      throw new Error('PREMIUM_COOKIE_SECRET eksik (premium cookie imzalama için gerekli).')
    }
    return PREMIUM_COOKIE_SECRET
}
  
const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'
  
export const PREMIUM_COOKIE_NAME = isProd ? '__Host-premium_status' : 'premium_status'
const PREMIUM_COOKIE_VERSION = 'v1'
  
type CookieAdapter = {
    get(name: string): string | undefined
    set(name: string, value: string, options?: any): void
    remove(name: string, options?: any): void
}

import { getCookie, setCookie, deleteCookie } from 'h3'
import type { H3Event } from 'h3'

export const createCookieAdapter = (event: H3Event): CookieAdapter => ({
    get: (name) => getCookie(event, name),
    set: (name, value, opts) => setCookie(event, name, value, opts),
    remove: (name, opts) => deleteCookie(event, name, opts)
})
  
/* ------------------------------------------------------------------ */
/* EDGE-SAFE BASE64 + CONST-TIME COMPARE                               */
/* ------------------------------------------------------------------ */
  
const toBase64 = (bytes: Uint8Array) => {
    if (typeof Buffer !== 'undefined') return Buffer.from(bytes).toString('base64')
    let s = ''
    for (const b of bytes) s += String.fromCharCode(b)
    return btoa(s)
}
  
const fromBase64 = (b64: string) => {
    if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'))
    const bin = atob(b64)
    return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}
  
const base64UrlEncode = (bytes: Uint8Array) =>
    toBase64(bytes).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  
const base64UrlDecode = (value: string) => {
    const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
    const b64 = padded.replace(/-/g, '+').replace(/_/g, '/')
    return fromBase64(b64)
}
  
const timingSafeEqual = (a: Uint8Array, b: Uint8Array) => {
    if (a.length !== b.length) return false
    let diff = 0
    for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i]
    return diff === 0
}
  
const signPremiumPayload = async (payload: string) => {
    const PREMIUM_COOKIE_SECRET = getPremiumSecret()
  
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(PREMIUM_COOKIE_SECRET),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )
  
    const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload))
    return base64UrlEncode(new Uint8Array(sig))
}
  
/* ------------------------------------------------------------------ */
/* PREMIUM LOGIC                                                       */
/* ------------------------------------------------------------------ */
  
export const normalizePremiumEndsAt = (value?: string | null) => {
    if (!value) return null
    const d = new Date(value)
    if (Number.isNaN(d.getTime()) || d.getTime() <= Date.now()) return null
    return d.toISOString()
}
  
export const serializePremiumCookie = async (userId?: string | null, endsAt?: string | null) => {
    const normalized = normalizePremiumEndsAt(endsAt)
    if (!normalized || !userId) return null
  
    const payload = `${userId}|${normalized}`
    const sig = await signPremiumPayload(payload)
  
    return `${PREMIUM_COOKIE_VERSION}:${payload}:${sig}`
}
  
export const readPremiumFromCookie = async (cookieAdapter: CookieAdapter, userId?: string | null) => {
    if (!userId) return null
    const raw = cookieAdapter.get(PREMIUM_COOKIE_NAME)
    if (!raw) return null
  
    const [version, payload, sig] = raw.split(':')
    if (version !== PREMIUM_COOKIE_VERSION) return null
  
    const [uid, expires] = payload.split('|')
    if (uid !== userId) return null
  
    const normalized = normalizePremiumEndsAt(expires)
    if (!normalized) return null
  
    const expected = base64UrlDecode(await signPremiumPayload(payload))
    const provided = base64UrlDecode(sig)
  
    return timingSafeEqual(expected, provided) ? normalized : null
}
  
export const persistPremiumCookie = async (
    cookieAdapter: CookieAdapter,
    userId?: string | null,
    endsAt?: string | null
) => {
    const serialized = await serializePremiumCookie(userId, endsAt)
    if (!serialized) {
      cookieAdapter.remove(PREMIUM_COOKIE_NAME)
      return null
    }
  
    const normalized = normalizePremiumEndsAt(endsAt)
    if (!normalized) return null
  
    cookieAdapter.set(PREMIUM_COOKIE_NAME, serialized, { expires: new Date(normalized) })
    return normalized
}
  
import type { SupabaseClient } from '@supabase/supabase-js'

export const refreshPremiumCookieOnce = async (
    supabase: SupabaseClient,
    cookieAdapter: CookieAdapter,
    { forceQuery = false, userId }: { forceQuery?: boolean; userId?: string | null } = {}
) => {
    if (!userId) {
      cookieAdapter.remove(PREMIUM_COOKIE_NAME)
      return null
    }
  
    if (!forceQuery) {
      const cached = await readPremiumFromCookie(cookieAdapter, userId)
      if (cached) return cached
    }
  
    const { data } = await supabase.from('profiles').select('premium_ends_at').eq('user_id', userId).maybeSingle()
    return persistPremiumCookie(cookieAdapter, userId, data?.premium_ends_at)
}
