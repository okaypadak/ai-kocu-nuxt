import { createClient } from '@supabase/supabase-js'

// Helper to safely access env vars in both Node (SSR) and Client (Vite)
const getEnv = (key: string, viteKey: string) => {
    // Priority 1: process.env (Node/SSR) - often most reliable for secrets/config in server context
    if (typeof process !== 'undefined' && process.env) {
        if (process.env[key]) return process.env[key]
        if (process.env[viteKey]) return process.env[viteKey]
    }
    // Priority 2: import.meta.env (Vite Client)
    if (import.meta.env) {
        if (import.meta.env[key]) return import.meta.env[key]
        if (import.meta.env[viteKey]) return import.meta.env[viteKey]
    }
    return ''
}

const supabaseUrl = (typeof process !== 'undefined' && process.env?.NUXT_PUBLIC_SUPABASE_URL) || 
                      import.meta.env?.NUXT_PUBLIC_SUPABASE_URL || 
                      import.meta.env?.VITE_SUPABASE_URL || ''
const supabaseAnonKey = (typeof process !== 'undefined' && process.env?.NUXT_PUBLIC_SUPABASE_ANON_KEY) || 
                        import.meta.env?.NUXT_PUBLIC_SUPABASE_ANON_KEY || 
                        import.meta.env?.VITE_SUPABASE_ANON_KEY || ''

if (!supabaseUrl) console.error('FATAL: supabaseUrl is missing. Check .env and nuxt.config.ts')
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
