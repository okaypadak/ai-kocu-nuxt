import { defineEventHandler, readRawBody, setHeader, setResponseStatus, type H3Event } from 'h3'
import {
  createSupabaseServerClient,
  SUPABASE_URL,
  SUPABASE_ANON_KEY,
  PREMIUM_COOKIE_NAME
} from '~/server/utils/supabase-server'

const FORBIDDEN_HEADERS = new Set(['host', 'connection', 'content-length'])

export default defineEventHandler(async (event) => {
  const method = event.node.req.method ?? 'GET'
  const { supabase, cookieAdapter } = createSupabaseServerClient(event)

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
  } catch (err) {
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

  const accessToken = sessionData.session.access_token
  const forwardedProtocol = (event.node.req.headers['x-forwarded-proto'] as string) || 'http'
  const host = event.node.req.headers.host || 'localhost'
  const url = new URL(event.node.req.url || '/', `${forwardedProtocol}://${host}`)
  const forwardedPath = url.pathname.replace(/^\/api\/supabase-proxy/, '') || '/'
  const targetUrl = `${SUPABASE_URL}${forwardedPath}${url.search}`

  const filteredHeaders: Record<string, string> = {}
  for (const [key, value] of Object.entries(event.node.req.headers)) {
    if (!value) continue
    if (FORBIDDEN_HEADERS.has(key.toLowerCase())) continue
    filteredHeaders[key] = Array.isArray(value) ? value.join(',') : value
  }
  filteredHeaders.authorization = `Bearer ${accessToken}`
  filteredHeaders.apikey = SUPABASE_ANON_KEY!

  const bodyBuffer =
    ['GET', 'HEAD'].includes(method) || event.node.req.headers['content-length'] === '0'
      ? undefined
      : await readRawBody(event)

  const response = await fetch(targetUrl, {
    method,
    headers: filteredHeaders,
    body: bodyBuffer as any
  })

  const responseBody = Buffer.from(await response.arrayBuffer())
  setResponseStatus(event, response.status)
  setHeader(event, 'content-type', response.headers.get('content-type') ?? 'application/json')
  cookieAdapter.apply()
  return responseBody
})

const respond = (event: H3Event, cookieAdapter: { apply: () => void }, status: number, body: any) => {
  cookieAdapter.apply()
  setResponseStatus(event, status)
  setHeader(event, 'content-type', 'application/json')
  return body
}
