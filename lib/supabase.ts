import type { SupabaseClient } from '@supabase/supabase-js'
import { resolveSupabaseClient } from '../utils/supabase-client'

let cachedClient: SupabaseClient | null = null

const ensureClient = (): SupabaseClient => {
  if (!cachedClient) {
    cachedClient = resolveSupabaseClient()
  }
  return cachedClient
}

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    const client = ensureClient()
    const value = Reflect.get(client as any, prop, client)
    if (typeof value === 'function') {
      return value.bind(client)
    }
    return value
  }
}) as SupabaseClient
