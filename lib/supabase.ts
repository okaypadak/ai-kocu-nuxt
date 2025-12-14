import { createClient } from '@supabase/supabase-js'

const getEnv = (...keys: string[]) => {
    for (const key of keys) {
        if (typeof process !== 'undefined' && process.env?.[key]) return process.env[key] as string
        if (typeof import.meta !== 'undefined' && (import.meta as any).env?.[key]) return (import.meta as any).env[key] as string
    }
    return ''
}

const supabaseUrl = getEnv(
    'NUXT_PUBLIC_SUPABASE_URL',
    'SUPABASE_URL',
    'NUXT_SUPABASE_URL',
    'VITE_SUPABASE_URL'
)

const supabaseAnonKey = getEnv(
    'NUXT_PUBLIC_SUPABASE_ANON_KEY',
    'SUPABASE_ANON_KEY',
    'SUPABASE_KEY',
    'NUXT_SUPABASE_KEY',
    'VITE_SUPABASE_ANON_KEY'
)

if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Supabase config missing: set NUXT_PUBLIC_SUPABASE_URL/SUPABASE_URL and NUXT_PUBLIC_SUPABASE_ANON_KEY/SUPABASE_ANON_KEY')
}

const proxyUrl = (
    (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_PROXY_URL) ??
    process.env?.VITE_SUPABASE_PROXY_URL ??
    '/api/supabase-proxy'
).trim()

const shouldProxy = proxyUrl.length > 0

const proxiedFetch: typeof fetch = (input, init) => {
    if (!shouldProxy) return fetch(input, init)

    const url = typeof input === 'string' ? input : input.toString()
    const isSupabaseRequest = url.startsWith(supabaseUrl)

    if (!isSupabaseRequest) {
        return fetch(input, init)
    }

    const forwardedPath = url.replace(supabaseUrl, '')
    const targetUrl = `${proxyUrl}${forwardedPath}`

    return fetch(targetUrl, {
        ...init,
        credentials: 'include'
    })
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        flowType: 'pkce'
    },
    global: {
        fetch: proxiedFetch
    },
    realtime: {
        params: { eventsPerSecond: 10 }
    }
})
