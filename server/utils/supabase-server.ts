import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { CookieSerializeOptions } from 'cookie'
import cookie from 'cookie'
import type { H3Event } from 'h3'
import { parseCookies } from 'h3'
import { useRuntimeConfig } from '#imports'

const env = (...keys: string[]) => keys.map((k) => process.env[k]).find(Boolean)

/* ------------------------------------------------------------------ */
/* RUNTIME CONFIG                                                      */
/* ------------------------------------------------------------------ */

export const resolveSupabasePublicConfig = () => {
  const config = useRuntimeConfig()
  const supabaseUrl =
    config.public.supabaseUrl ||
    env(
      'NUXT_PUBLIC_SUPABASE_URL',
      'SUPABASE_URL',
      'NUXT_SUPABASE_URL',
      'VITE_SUPABASE_URL'
    )

  const supabaseAnonKey =
    config.public.supabaseAnonKey ||
    env(
      'NUXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_ANON_KEY',
      'SUPABASE_KEY',
      'NUXT_SUPABASE_KEY',
      'VITE_SUPABASE_ANON_KEY'
    )

  return { supabaseUrl, supabaseAnonKey }
}

const getConfig = () => {
  const config = useRuntimeConfig()
  const { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY } =
    resolveSupabasePublicConfig()

  const SUPABASE_SERVICE_ROLE_KEY =
    config.supabaseServiceRoleKey ||
    env('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')

  const PREMIUM_COOKIE_SECRET =
    config.premiumCookieSecret || env('PREMIUM_COOKIE_SECRET')

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase public config eksik (NUXT_PUBLIC_SUPABASE_URL/SUPABASE_URL ve NUXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY)'
    )
  }

  if (!PREMIUM_COOKIE_SECRET) {
    throw new Error('PREMIUM_COOKIE_SECRET eksik')
  }

  return {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    PREMIUM_COOKIE_SECRET
  }
}

const isProd = process.env.NODE_ENV === 'production'

export const PREMIUM_COOKIE_NAME = isProd
  ? '__Host-premium_status'
  : 'premium_status'

const PREMIUM_COOKIE_VERSION = 'v1'

/* ------------------------------------------------------------------ */
/* COOKIE ADAPTER                                                      */
/* ------------------------------------------------------------------ */

const resolveCookieDomain = (event: H3Event) => {
  const host = event.node.req.headers.host?.split(':')[0]
  if (!host || host === 'localhost' || host === '127.0.0.1') return undefined
  return host
}

const shouldUseSecureCookies = (event: H3Event) => {
  const forced = process.env.FORCE_SECURE_COOKIES
  if (forced === 'true') return true
  if (forced === 'false') return false

  const proto = String(event.node.req.headers['x-forwarded-proto'] || '')
  if (proto === 'https') return true

  // @ts-expect-error Nitro TLS flag
  return event.node.req.socket?.encrypted === true
}

type CookieAdapter = {
  get(name: string): string | undefined
  set(name: string, value: string, options?: CookieSerializeOptions): void
  remove(name: string, options?: CookieSerializeOptions): void
  apply(): void
}

const createCookieAdapter = (event: H3Event): CookieAdapter => {
  const cookies = parseCookies(event)
  const jar = new Map<string, string>()
  const secure = shouldUseSecureCookies(event)
  const domain = !isProd ? resolveCookieDomain(event) : undefined

  const base: CookieSerializeOptions = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    domain
  }

  const setCookie = (name: string, value: string, options?: CookieSerializeOptions) => {
    jar.set(name, cookie.serialize(name, value, { ...base, ...options }))
  }

  return {
    get: (name) => cookies[name],
    set: setCookie,
    remove: (name, options) =>
      setCookie(name, '', { ...options, expires: new Date(0) }),
    apply: () => {
      if (!jar.size) return
      const existing = event.node.res.getHeader('set-cookie')
      const values = [...jar.values()]
      event.node.res.setHeader(
        'set-cookie',
        existing
          ? Array.isArray(existing)
            ? existing.concat(values)
            : [existing, ...values]
          : values
      )
    }
  }
}

/* ------------------------------------------------------------------ */
/* SUPABASE CLIENTS                                                    */
/* ------------------------------------------------------------------ */

export const createSupabaseServerClient = (event: H3Event) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfig()
  const cookieAdapter = createCookieAdapter(event)

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    cookies: {
      get: cookieAdapter.get,
      set: cookieAdapter.set,
      remove: cookieAdapter.remove
    }
  })

  return { supabase, cookieAdapter }
}

export const createSupabaseAdminClient = () => {
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfig()
  if (!SUPABASE_SERVICE_ROLE_KEY) return null

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

/* ------------------------------------------------------------------ */
/* EDGE-SAFE CRYPTO                                                    */
/* ------------------------------------------------------------------ */

const base64UrlEncode = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')

const base64UrlDecode = (value: string) => {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  const bin = atob(padded.replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(bin, (c) => c.charCodeAt(0))
}

const signPremiumPayload = async (payload: string) => {
  const { PREMIUM_COOKIE_SECRET } = getConfig()

  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(PREMIUM_COOKIE_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign(
    'HMAC',
    key,
    new TextEncoder().encode(payload)
  )

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

export const serializePremiumCookie = async (
  userId?: string | null,
  endsAt?: string | null
) => {
  const normalized = normalizePremiumEndsAt(endsAt)
  if (!normalized || !userId) return null

  const payload = `${userId}|${normalized}`
  const sig = await signPremiumPayload(payload)

  return `${PREMIUM_COOKIE_VERSION}:${payload}:${sig}`
}

export const readPremiumFromCookie = async (
  cookieAdapter: CookieAdapter,
  userId?: string | null
) => {
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

  if (expected.length !== provided.length) return null
  if (!crypto.timingSafeEqual(expected, provided)) return null

  return normalized
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

  cookieAdapter.set(PREMIUM_COOKIE_NAME, serialized, {
    expires: new Date(normalized)
  })

  return normalized
}

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

  const { data } = await supabase
    .from('profiles')
    .select('premium_ends_at')
    .eq('user_id', userId)
    .maybeSingle()

  return persistPremiumCookie(cookieAdapter, userId, data?.premium_ends_at)
}

export const isMissingAuthSessionError = (err?: { message?: string }) => {
  const msg = err?.message?.toLowerCase() ?? ''
  return (
    msg.includes('auth session missing') ||
    msg.includes('refresh token not found') ||
    msg.includes('invalid refresh token')
  )
}
