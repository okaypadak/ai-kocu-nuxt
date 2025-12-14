import type { SupabaseClient } from '@supabase/supabase-js'
import { getSupabaseClient } from '~/server/utils/supabase'

/**
 * Shared helper to lazily fetch the Supabase client from the unified utils entry.
 * Always call inside composables/functions to ensure useRuntimeConfig has context.
 */
export const resolveSupabaseClient = (): SupabaseClient => getSupabaseClient()
