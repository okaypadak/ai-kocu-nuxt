import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const proxyUrl = (import.meta.env.VITE_SUPABASE_PROXY_URL ?? '/api/supabase-proxy').trim()

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
