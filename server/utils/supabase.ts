// ~/utils/supabase.ts
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { useRuntimeConfig } from '#imports'

/* ------------------------------------------------------------------ */
/* ENV + PUBLIC CONFIG (local + canlı uyumlu)                          */
/* ------------------------------------------------------------------ */

const pickFirst = (...values: Array<string | undefined | null>) =>
  values.map((v) => (typeof v === 'string' ? v.trim() : v)).find((v) => Boolean(v))

const readServerEnv = (...keys: string[]) => {
  if (typeof process === 'undefined') return undefined
  return pickFirst(...keys.map((k) => process.env?.[k]))
}

const readClientEnv = (...keys: string[]) => {
  // Vite/Nuxt client build-time env fallback (opsiyonel)
  const metaEnv = (typeof import.meta !== 'undefined' ? (import.meta as any).env : undefined) as Record<
    string,
    string | undefined
  >
  if (!metaEnv) return undefined
  return pickFirst(...keys.map((k) => metaEnv[k]))
}

export const resolveSupabasePublicConfig = () => {
  const config = useRuntimeConfig()

  const supabaseUrl =
    pickFirst(
      config.public?.supabaseUrl,
      readServerEnv('NUXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'NUXT_SUPABASE_URL', 'VITE_SUPABASE_URL'),
      readClientEnv('NUXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL', 'NUXT_SUPABASE_URL', 'VITE_SUPABASE_URL')
    ) ?? undefined

  const supabaseAnonKey =
    pickFirst(
      config.public?.supabaseAnonKey,
      readServerEnv(
        'NUXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_ANON_KEY',
        'SUPABASE_KEY',
        'NUXT_SUPABASE_KEY',
        'VITE_SUPABASE_ANON_KEY'
      ),
      readClientEnv(
        'NUXT_PUBLIC_SUPABASE_ANON_KEY',
        'SUPABASE_ANON_KEY',
        'SUPABASE_KEY',
        'NUXT_SUPABASE_KEY',
        'VITE_SUPABASE_ANON_KEY'
      )
    ) ?? undefined

  const supabaseProxyUrl =
    pickFirst(
      config.public?.supabaseProxyUrl,
      readServerEnv('NUXT_PUBLIC_SUPABASE_PROXY_URL', 'VITE_SUPABASE_PROXY_URL'),
      readClientEnv('NUXT_PUBLIC_SUPABASE_PROXY_URL', 'VITE_SUPABASE_PROXY_URL'),
      '/api/supabase-proxy'
    ) ?? '/api/supabase-proxy'

  return { supabaseUrl, supabaseAnonKey, supabaseProxyUrl }
}

const getConfigServerOnly = () => {
  if (typeof process !== 'undefined' && (process as any).client) {
    throw new Error('getConfigServerOnly yalnızca server-side kullanılmalıdır.')
  }

  const config = useRuntimeConfig()
  const { supabaseUrl: SUPABASE_URL, supabaseAnonKey: SUPABASE_ANON_KEY } = resolveSupabasePublicConfig()

  const SUPABASE_SERVICE_ROLE_KEY =
    pickFirst(
      config.supabaseServiceRoleKey as string | undefined,
      readServerEnv('SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY')
    ) ?? undefined

  const PREMIUM_COOKIE_SECRET =
    pickFirst(config.premiumCookieSecret as string | undefined, readServerEnv('PREMIUM_COOKIE_SECRET')) ?? undefined

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error(
      'Supabase public config eksik: runtimeConfig.public.supabaseUrl ve runtimeConfig.public.supabaseAnonKey (veya NUXT_PUBLIC_SUPABASE_URL / NUXT_PUBLIC_SUPABASE_ANON_KEY).'
    )
  }

  if (!PREMIUM_COOKIE_SECRET) {
    throw new Error('PREMIUM_COOKIE_SECRET eksik (premium cookie imzalama için gerekli).')
  }

  return {
    SUPABASE_URL,
    SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY,
    PREMIUM_COOKIE_SECRET
  }
}

/* ------------------------------------------------------------------ */
/* CLIENT (BROWSER) SUPABASE CLIENT + PROXY FETCH                      */
/* ------------------------------------------------------------------ */

let _browserClient: SupabaseClient | null = null

export const getSupabaseClient = () => {
  const { supabaseUrl, supabaseAnonKey, supabaseProxyUrl } = resolveSupabasePublicConfig()

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase config missing: runtimeConfig.public.supabaseUrl ve public.supabaseAnonKey ayarlanmalı.')
  }

  const isServer = typeof process !== 'undefined' && Boolean((process as any).server)

  // Server tarafında singleton tutmuyoruz (request’ler arası state riski).
  if (isServer) {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce'
      }
    })
  }

  if (_browserClient) return _browserClient

  const proxyUrl = (supabaseProxyUrl || '/api/supabase-proxy').trim()
  const shouldProxy = proxyUrl.length > 0

  const proxiedFetch: typeof fetch = (input, init) => {
    if (!shouldProxy) return fetch(input, init)

    const url = typeof input === 'string' ? input : input.toString()
    const isSupabaseRequest = url.startsWith(supabaseUrl)
    if (!isSupabaseRequest) return fetch(input, init)

    const forwardedPath = url.replace(supabaseUrl, '')
    const targetUrl = `${proxyUrl}${forwardedPath}`

    return fetch(targetUrl, {
      ...init,
      credentials: 'include'
    })
  }

  _browserClient = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
      flowType: 'pkce'
    },
    global: { fetch: proxiedFetch },
    realtime: { params: { eventsPerSecond: 10 } }
  })

  return _browserClient
}

/* ------------------------------------------------------------------ */
/* SERVER (SSR) COOKIE + SUPABASE SERVER CLIENT                         */
/* ------------------------------------------------------------------ */

const isProd = typeof process !== 'undefined' && process.env.NODE_ENV === 'production'

export const PREMIUM_COOKIE_NAME = isProd ? '__Host-premium_status' : 'premium_status'
const PREMIUM_COOKIE_VERSION = 'v1'

type CookieAdapter = {
  get(name: string): string | undefined
  set(name: string, value: string, options?: any): void
  remove(name: string, options?: any): void
  apply(): void
}

const resolveCookieDomain = async (event: any) => {
  const host = event?.node?.req?.headers?.host?.split?.(':')?.[0]
  if (!host || host === 'localhost' || host === '127.0.0.1') return undefined
  return host
}

const shouldUseSecureCookies = (event: any) => {
  const forced = typeof process !== 'undefined' ? process.env.FORCE_SECURE_COOKIES : undefined
  if (forced === 'true') return true
  if (forced === 'false') return false

  const proto = String(event?.node?.req?.headers?.['x-forwarded-proto'] || '')
  if (proto === 'https') return true

  return event?.node?.req?.socket?.encrypted === true
}

const createCookieAdapter = async (event: any): Promise<CookieAdapter> => {
  const { parseCookies } = await import('h3')
  const cookie = (await import('cookie')).default

  const cookies = parseCookies(event)
  const jar = new Map<string, string>()
  const secure = shouldUseSecureCookies(event)
  const domain = !isProd ? await resolveCookieDomain(event) : undefined

  const base = {
    httpOnly: true,
    secure,
    sameSite: secure ? 'none' : 'lax',
    path: '/',
    domain
  }

  const setCookie = (name: string, value: string, options?: any) => {
    jar.set(name, cookie.serialize(name, value, { ...base, ...options }))
  }

  return {
    get: (name) => cookies[name],
    set: setCookie,
    remove: (name, options) => setCookie(name, '', { ...options, expires: new Date(0) }),
    apply: () => {
      if (!jar.size) return
      const existing = event.node.res.getHeader('set-cookie')
      const values = [...jar.values()]
      event.node.res.setHeader(
        'set-cookie',
        existing ? (Array.isArray(existing) ? existing.concat(values) : [existing, ...values]) : values
      )
    }
  }
}

export const createSupabaseServerClient = async (event: any) => {
  const { SUPABASE_URL, SUPABASE_ANON_KEY } = getConfigServerOnly()
  const cookieAdapter = await createCookieAdapter(event)

  const { createServerClient } = await import('@supabase/ssr')

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
  const { SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY } = getConfigServerOnly()
  if (!SUPABASE_SERVICE_ROLE_KEY) return null

  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  })
}

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
  const { PREMIUM_COOKIE_SECRET } = getConfigServerOnly()

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

  const { data } = await supabase.from('profiles').select('premium_ends_at').eq('user_id', userId).maybeSingle()
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

/* ------------------------------------------------------------------ */
/* API: /api/supabase-proxy/** handler (server-side only at runtime)    */
/* ------------------------------------------------------------------ */

const FORBIDDEN_HEADERS = new Set(['host', 'connection', 'content-length'])

export const supabaseProxyHandler = async (eventInner: any) => {
  const { readRawBody, setHeader, setResponseStatus } = await import('h3')

  const method = eventInner.node.req.method ?? 'GET'
  const { supabase, cookieAdapter } = await createSupabaseServerClient(eventInner)
  const { supabaseUrl, supabaseAnonKey } = resolveSupabasePublicConfig()

  // AUTH CHECK (mevcut tasarımı koruyoruz)
  let userData: any, userError: any, sessionData: any, sessionError: any

  try {
    const [userResult, sessionResult] = await Promise.all([supabase.auth.getUser(), supabase.auth.getSession()])
    userData = userResult.data
    userError = userResult.error
    sessionData = sessionResult.data
    sessionError = sessionResult.error
  } catch {
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    return respond(eventInner, cookieAdapter, 401, { error: 'Oturum geçersiz' })
  }

  const resolvedError = userError ?? sessionError
  if (resolvedError || !userData?.user || !sessionData?.session) {
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    return respond(eventInner, cookieAdapter, 401, { error: resolvedError?.message ?? 'Oturum bulunamadı' })
  }

  // TARGET URL
  const forwardedProto = (eventInner.node.req.headers['x-forwarded-proto'] as string) || 'http'
  const host = eventInner.node.req.headers.host || 'localhost'
  const url = new URL(eventInner.node.req.url || '/', `${forwardedProto}://${host}`)

  const forwardedPath = url.pathname.replace(/^\/api\/supabase-proxy/, '') || '/'
  const targetUrl = `${supabaseUrl}${forwardedPath}${url.search}`

  // HEADERS
  const filteredHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(eventInner.node.req.headers)) {
    if (!value) continue
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) continue
    filteredHeaders[key] = Array.isArray(value) ? value.join(',') : String(value)
  }

  filteredHeaders.authorization = `Bearer ${sessionData.session.access_token}`
  filteredHeaders.apikey = supabaseAnonKey as string

  // BODY
  const body =
    ['GET', 'HEAD'].includes(method) || eventInner.node.req.headers['content-length'] === '0'
      ? undefined
      : await readRawBody(eventInner)

  // FETCH
  const response = await fetch(targetUrl, { method, headers: filteredHeaders, body })

  // RESPONSE
  const contentType = response.headers.get('content-type') ?? 'application/octet-stream'
  setResponseStatus(eventInner, response.status)
  setHeader(eventInner, 'content-type', contentType)

  cookieAdapter.apply()

  if (method === 'HEAD' || response.status === 204 || response.headers.get('content-length') === '0') {
    return null
  }

  if (contentType.includes('application/json')) {
    const text = await response.text()
    return text ? JSON.parse(text) : ''
  }

  return new Uint8Array(await response.arrayBuffer())
}

const respond = async (event: any, cookieAdapter: { apply: () => void }, status: number, body: any) => {
  const { setHeader, setResponseStatus } = await import('h3')
  cookieAdapter.apply()
  setResponseStatus(event, status)
  setHeader(event, 'content-type', 'application/json')
  return body
}
