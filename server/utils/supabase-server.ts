import { createServerClient } from '@supabase/ssr'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { CookieSerializeOptions } from 'cookie'
import cookie from 'cookie'
import type { H3Event } from 'h3'
import { parseCookies } from 'h3'
import { createHmac, timingSafeEqual } from 'node:crypto'

const SUPABASE_URL = process.env.VITE_SUPABASE_URL ?? process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY ?? process.env.SUPABASE_ANON_KEY
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
const PREMIUM_COOKIE_SECRET = process.env.PREMIUM_COOKIE_SECRET

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error('Supabase URL ve anon anahtar .env ortamında tanımlı olmalı')
}

if (!PREMIUM_COOKIE_SECRET) {
  throw new Error('PREMIUM_COOKIE_SECRET env var is required for signing the premium cookie')
}

const isProd = process.env.NODE_ENV === 'production'

export const PREMIUM_COOKIE_NAME = isProd ? '__Host-premium_status' : 'premium_status'
const PREMIUM_COOKIE_VERSION = 'v1'

const resolveCookieDomain = (event: H3Event) => {
  const hostHeader = event.node.req.headers.host
  const host = hostHeader?.split(':')?.[0]
  if (!host) return undefined
  if (host === 'localhost' || host === '127.0.0.1') return undefined
  return host
}

const isLocalhost = (host: string) => host === 'localhost' || host === '127.0.0.1'

const shouldUseSecureCookies = (event: H3Event) => {
  const forced = process.env.FORCE_SECURE_COOKIES
  if (forced === 'true') return true
  if (forced === 'false') return false

  const host = event.node.req.headers.host?.split(':')?.[0]?.toLowerCase() ?? ''
  if (host && !isLocalhost(host)) return true

  const forwardedProto = `${event.node.req.headers['x-forwarded-proto'] || ''}`.toLowerCase()
  if (forwardedProto === 'https') return true

  // @ts-expect-error - Node req type union (Nitro provides encrypted flag when TLS terminates upstream)
  return event.node.req.socket?.encrypted === true
}

type CookieAdapter = {
  get(name: string): string | undefined
  set(name: string, value: string, options?: CookieSerializeOptions): void
  remove(name: string, options?: CookieSerializeOptions): void
  apply(): void
}

const createCookieAdapter = (event: H3Event): CookieAdapter => {
  const cookiesFromRequest = parseCookies(event)
  const jar = new Map<string, string>()
  const secureCookies = shouldUseSecureCookies(event)
  const domain = isProd ? undefined : resolveCookieDomain(event)

  const baseOptions: CookieSerializeOptions = {
    httpOnly: true,
    sameSite: secureCookies ? 'none' : 'lax',
    secure: secureCookies,
    path: '/'
  }

  if (!isProd && domain) {
    baseOptions.domain = domain
  }

  const setCookieString = (name: string, value: string, options?: CookieSerializeOptions) => {
    jar.set(
      name,
      cookie.serialize(name, value, {
        ...baseOptions,
        ...options
      })
    )
  }

  return {
    get: (name: string) => cookiesFromRequest[name],
    set: (name, value, options) => setCookieString(name, value, options),
    remove: (name, options) =>
      setCookieString(name, '', {
        ...options,
        expires: new Date(0)
      }),
    apply: () => {
      if (jar.size === 0) return
      const existing = event.node.res.getHeader('set-cookie')
      const serialized = Array.from(jar.values())
      if (!existing) {
        event.node.res.setHeader('set-cookie', serialized)
        return
      }

      if (Array.isArray(existing)) {
        event.node.res.setHeader('set-cookie', existing.concat(serialized))
      } else {
        event.node.res.setHeader('set-cookie', [existing, ...serialized])
      }
    }
  }
}

export const createSupabaseServerClient = (event: H3Event) => {
  const cookieAdapter = createCookieAdapter(event)

  const supabase = createServerClient(SUPABASE_URL!, SUPABASE_ANON_KEY!, {
    cookies: {
      get: (name) => cookieAdapter.get(name),
      set: (name, value, options) => cookieAdapter.set(name, value, options),
      remove: (name, options) => cookieAdapter.remove(name, options)
    }
  })

  return { supabase, cookieAdapter }
}

export const createSupabaseAdminClient = () => {
  if (!SUPABASE_SERVICE_ROLE_KEY) return null
  return createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

const base64UrlEncode = (buf: Buffer) =>
  buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')

const base64UrlDecode = (value: string) => {
  const padded = value.padEnd(value.length + ((4 - (value.length % 4)) % 4), '=')
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

const signPremiumPayload = (payload: string) =>
  base64UrlEncode(createHmac('sha256', PREMIUM_COOKIE_SECRET!).update(payload).digest())

export const normalizePremiumEndsAt = (value?: string | null) => {
  if (!value) return null
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return null
  if (parsed.getTime() <= Date.now()) return null
  return parsed.toISOString()
}

export const serializePremiumCookie = (userId?: string | null, premiumEndsAtIso?: string | null) => {
  const normalized = normalizePremiumEndsAt(premiumEndsAtIso)
  if (!normalized || !userId) return null
  const payload = `${userId}|${normalized}`
  const signature = signPremiumPayload(payload)
  return `${PREMIUM_COOKIE_VERSION}:${payload}:${signature}`
}

export const readPremiumFromCookie = (cookieAdapter: CookieAdapter, userId?: string | null) => {
  if (!userId) return null
  const raw = cookieAdapter.get(PREMIUM_COOKIE_NAME)
  if (!raw || typeof raw !== 'string') return null

  const [version, payload, signature] = raw.split(':')
  if (version !== PREMIUM_COOKIE_VERSION || !payload || !signature) return null

  const [cookieUserId, expiresIso] = payload.split('|')
  if (!cookieUserId || !expiresIso || cookieUserId !== userId) return null

  const normalized = normalizePremiumEndsAt(expiresIso)
  if (!normalized) return null

  const expectedSignature = signPremiumPayload(payload)
  const providedSigBuf = base64UrlDecode(signature)
  const expectedSigBuf = base64UrlDecode(expectedSignature)
  if (providedSigBuf.length !== expectedSigBuf.length) return null
  if (!timingSafeEqual(providedSigBuf, expectedSigBuf)) return null

  return normalized
}

export const persistPremiumCookie = (
  cookieAdapter: CookieAdapter,
  userId?: string | null,
  premiumEndsAtIso?: string | null
) => {
  const serialized = serializePremiumCookie(userId, premiumEndsAtIso)
  if (!serialized) {
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    return null
  }
  const normalized = normalizePremiumEndsAt(premiumEndsAtIso)
  if (!normalized) return null
  cookieAdapter.set(PREMIUM_COOKIE_NAME, serialized, { path: '/', expires: new Date(normalized) })
  return normalized
}

export const refreshPremiumCookieOnce = async (
  supabase: SupabaseClient,
  cookieAdapter: CookieAdapter,
  { forceQuery = false, userId }: { forceQuery?: boolean; userId?: string | null } = {}
) => {
  if (!userId) {
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    return null
  }

  const existing = forceQuery ? null : readPremiumFromCookie(cookieAdapter, userId)
  if (existing) return existing

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('premium_ends_at')
      .eq('user_id', userId)
      .limit(1)
      .maybeSingle()

    if (error) throw error

    const premiumEndsAt = normalizePremiumEndsAt(data?.premium_ends_at as string | null | undefined)
    if (!premiumEndsAt) {
      cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
      return null
    }

    return persistPremiumCookie(cookieAdapter, userId, premiumEndsAt)
  } catch (err: any) {
    console.warn('[auth] premium cookie sync skipped:', err?.message ?? err)
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    return null
  }
}

export const isMissingAuthSessionError = (err?: { message?: string }) => {
  const msg = typeof err?.message === 'string' ? err.message.toLowerCase() : ''
  return (
    msg.includes('auth session missing') ||
    msg.includes('refresh token not found') ||
    msg.includes('invalid refresh token')
  )
}

export { SUPABASE_URL, SUPABASE_ANON_KEY }
