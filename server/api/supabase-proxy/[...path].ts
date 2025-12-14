import {
  defineEventHandler,
  readRawBody,
  setHeader,
  setResponseStatus,
  type H3Event
} from 'h3'
import { createSupabaseServerClient, PREMIUM_COOKIE_NAME } from '~/server/utils/supabase-server'
import { useRuntimeConfig } from '#imports'

const FORBIDDEN_HEADERS = new Set(['host', 'connection', 'content-length'])

export default defineEventHandler(async (event) => {
  const method = event.node.req.method ?? 'GET'
  const { supabase, cookieAdapter } = createSupabaseServerClient(event)
  const config = useRuntimeConfig()

  /* ------------------------------------------------------------ */
  /* AUTH CHECK                                                   */
  /* ------------------------------------------------------------ */

  let userData, userError, sessionData, sessionError

  try {
    const [userResult, sessionResult] = await Promise.all([
      supabase.auth.getUser(),
      supabase.auth.getSession()
    ])
    userData = userResult.data
    userError = userResult.error
    sessionData = sessionResult.data
    sessionError = sessionResult.error
  } catch {
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    return respond(event, cookieAdapter, 401, { error: 'Oturum geçersiz' })
  }

  const resolvedError = userError ?? sessionError
  if (resolvedError || !userData?.user || !sessionData?.session) {
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    return respond(event, cookieAdapter, 401, {
      error: resolvedError?.message ?? 'Oturum bulunamadı'
    })
  }

  /* ------------------------------------------------------------ */
  /* TARGET URL                                                   */
  /* ------------------------------------------------------------ */

  const forwardedProto =
    (event.node.req.headers['x-forwarded-proto'] as string) || 'http'
  const host = event.node.req.headers.host || 'localhost'

  const url = new URL(event.node.req.url || '/', `${forwardedProto}://${host}`)
  const forwardedPath =
    url.pathname.replace(/^\/api\/supabase-proxy/, '') || '/'

  const supabaseUrl = config.public.supabaseUrl
  const targetUrl = `${supabaseUrl}${forwardedPath}${url.search}`

  /* ------------------------------------------------------------ */
  /* HEADERS                                                      */
  /* ------------------------------------------------------------ */

  const filteredHeaders: Record<string, string> = {}

  for (const [key, value] of Object.entries(event.node.req.headers)) {
    if (!value) continue
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) continue
    filteredHeaders[key] = Array.isArray(value) ? value.join(',') : value
  }

  filteredHeaders.authorization = `Bearer ${sessionData.session.access_token}`
  filteredHeaders.apikey = config.public.supabaseAnonKey

  /* ------------------------------------------------------------ */
  /* BODY                                                         */
  /* ------------------------------------------------------------ */

  const body =
    ['GET', 'HEAD'].includes(method) ||
      event.node.req.headers['content-length'] === '0'
      ? undefined
      : await readRawBody(event)

  /* ------------------------------------------------------------ */
  /* FETCH                                                        */
  /* ------------------------------------------------------------ */

  const response = await fetch(targetUrl, {
    method,
    headers: filteredHeaders,
    body
  })

  /* ------------------------------------------------------------ */
  /* RESPONSE                                                     */
  /* ------------------------------------------------------------ */

  const contentType =
    response.headers.get('content-type') ?? 'application/octet-stream'

  setResponseStatus(event, response.status)
  setHeader(event, 'content-type', contentType)

  cookieAdapter.apply()

  // Edge + Node uyumlu response body
  if (method === 'HEAD' || response.status === 204 || response.headers.get('content-length') === '0') {
    return null
  }

  if (contentType.includes('application/json')) {
    const text = await response.text()
    return text ? JSON.parse(text) : ''
  }

  return new Uint8Array(await response.arrayBuffer())
})

/* ------------------------------------------------------------------ */

const respond = (
  event: H3Event,
  cookieAdapter: { apply: () => void },
  status: number,
  body: any
) => {
  cookieAdapter.apply()
  setResponseStatus(event, status)
  setHeader(event, 'content-type', 'application/json')
  return body
}
