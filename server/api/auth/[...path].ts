import { defineEventHandler, readBody, setResponseStatus } from 'h3'
import {
  createSupabaseServerClient,
  refreshPremiumCookieOnce,
  isMissingAuthSessionError,
  PREMIUM_COOKIE_NAME
} from '~/server/utils/supabase-server'

export default defineEventHandler(async (event) => {
  const method = event.node.req.method ?? 'GET'
  const rawParam = event.context.params?.path ?? ''
  const pathname = rawParam ? `/${rawParam}` : '/'
  const { supabase, cookieAdapter } = createSupabaseServerClient(event)

  const send = (status: number, body: any) => {
    cookieAdapter.apply()
    setResponseStatus(event, status)
    return body
  }

  let parsedBody: Record<string, any> = {}
  if (!['GET', 'HEAD'].includes(method)) {
    try {
      parsedBody = (await readBody<Record<string, any>>(event)) ?? {}
    } catch {
      return send(400, { error: 'Geçersiz JSON' })
    }
  }

  if (method === 'POST' && pathname === '/login') {
    const { email, password } = parsedBody
    if (!email || !password) return send(400, { error: 'email ve password zorunlu' })

    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      const msg =
        typeof error.message === 'string' && error.message.toLowerCase() === 'invalid login credentials'
          ? 'E-posta veya şifre yanlış'
          : error.message
      return send(error.status ?? 400, { error: msg })
    }

    const userId = data.user?.id ?? data.session?.user?.id ?? null
    const premiumEndsAt = userId
      ? await refreshPremiumCookieOnce(supabase, cookieAdapter, { forceQuery: true, userId })
      : null

    return send(200, {
      session: data.session ?? null,
      user: data.user ?? data.session?.user ?? null,
      premiumEndsAt
    })
  }

  if (method === 'POST' && pathname === '/signup') {
    const { email, password, data: userData } = parsedBody
    if (!email || !password) return send(400, { error: 'email ve password zorunlu' })

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: userData }
    })

    if (error) return send(error.status ?? 400, { error: error.message })

    const userId = data.session?.user?.id ?? data.user?.id ?? null
    const premiumEndsAt =
      data.session && userId
        ? await refreshPremiumCookieOnce(supabase, cookieAdapter, { forceQuery: true, userId })
        : null

    return send(200, {
      session: data.session ?? null,
      user: data.user ?? data.session?.user ?? null,
      premiumEndsAt
    })
  }

  if (method === 'POST' && pathname === '/logout') {
    const { error } = await supabase.auth.signOut({ scope: 'global' })
    cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
    if (error) return send(error.status ?? 400, { error: error.message })
    return send(200, { success: true })
  }

  if (method === 'POST' && pathname === '/resend') {
    const { email } = parsedBody
    if (!email) return send(400, { error: 'email zorunlu' })

    const { error } = await supabase.auth.resend({ email, type: 'signup' })
    if (error) return send(error.status ?? 400, { error: error.message })
    return send(200, { success: true })
  }

  if (method === 'POST' && pathname === '/reset-password') {
    const { email } = parsedBody
    if (!email) return send(400, { error: 'email zorunlu' })

    const protocol = (event.node.req.headers['x-forwarded-proto'] as string) || 'http'
    const host = event.node.req.headers.host
    const redirectUrl = `${protocol}://${host}/guncelle-sifre`

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl
    })

    if (error) return send(error.status ?? 400, { error: error.message })
    return send(200, { success: true })
  }

  if (method === 'POST' && pathname === '/recover-session') {
    const { access_token, refresh_token } = parsedBody
    if (!access_token || !refresh_token) {
      return send(400, { error: 'tokenlar zorunlu' })
    }

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token })
    if (error) return send(error.status ?? 400, { error: error.message })

    const userId = data.user?.id ?? data.session?.user?.id ?? null
    const premiumEndsAt = userId
      ? await refreshPremiumCookieOnce(supabase, cookieAdapter, { forceQuery: true, userId })
      : null

    return send(200, {
      session: data.session ?? null,
      user: data.user ?? data.session?.user ?? null,
      premiumEndsAt
    })
  }

  if (method === 'POST' && pathname === '/exchange-code') {
    const { code } = parsedBody
    if (!code) return send(400, { error: 'code zorunlu' })

    const { data, error } = await supabase.auth.exchangeCodeForSession(code)
    if (error) return send(error.status ?? 400, { error: error.message })

    const userId = data.user?.id ?? data.session?.user?.id ?? null
    const premiumEndsAt = userId
      ? await refreshPremiumCookieOnce(supabase, cookieAdapter, { forceQuery: true, userId })
      : null

    return send(200, {
      session: data.session ?? null,
      user: data.user ?? data.session?.user ?? null,
      premiumEndsAt
    })
  }

  if (method === 'POST' && pathname === '/update-user') {
    const { attributes } = parsedBody
    if (!attributes) return send(400, { error: 'attributes zorunlu' })

    const { data, error } = await supabase.auth.updateUser(attributes)
    if (error) return send(error.status ?? 400, { error: error.message })

    return send(200, { user: data.user })
  }

  if (method === 'GET' && (pathname === '/' || pathname === '/session')) {
    let sessionData, sessionError, userData, userError
    try {
      const results = await Promise.all([supabase.auth.getSession(), supabase.auth.getUser()])
      sessionData = results[0].data
      sessionError = results[0].error
      userData = results[1].data
      userError = results[1].error
    } catch (err) {
      console.warn('[auth] session fetch failed:', err)
      cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
      return send(200, { session: null, user: null, premiumEndsAt: null })
    }
    const resolvedError = userError ?? sessionError
    if (resolvedError) {
      cookieAdapter.remove(PREMIUM_COOKIE_NAME, { path: '/' })
      if (isMissingAuthSessionError(resolvedError)) {
        return send(200, { session: null, user: null, premiumEndsAt: null })
      }
      return send(resolvedError.status ?? 401, { error: resolvedError.message })
    }

    let session = sessionData?.session ?? null
    if (session && typeof session === 'object') {
      try {
        delete (session as any).user
      } catch {
        /* noop */
      }
    }
    const user = userData?.user ?? null
    const userId = user?.id ?? null
    const premiumEndsAt = userId
      ? await refreshPremiumCookieOnce(supabase, cookieAdapter, { userId, forceQuery: false })
      : null

    return send(200, { session, user, premiumEndsAt })
  }

  return send(404, { error: 'not_found' })
})
