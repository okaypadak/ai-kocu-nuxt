// src/api/notifications.ts
import type { SupabaseClient } from '@supabase/supabase-js'

export type NotificationRow = {
  id: string
  user_id: string
  sender_id?: string | null
  conversation_id?: string | null
  is_broadcast?: boolean | null
  type: string
  level: 'info'|'success'|'warning'|'error'|'danger'|string
  title: string
  body: string | null
  status: string
  action_url: string | null
  created_at: string
  read_at: string | null
  seen_at: string | null
}

class NotifError extends Error { code?: string; constructor(m:string,c?:string){ super(m); this.code=c } }
const toErr = (e:any)=> new NotifError(e?.message || e?.error?.message || 'Beklenmeyen hata', e?.code || e?.error?.code)
const timeout = <T>(p:PromiseLike<T>, ms=10_000)=>Promise.race<T>([
  p, new Promise<T>((_,rej)=>setTimeout(()=>rej(new NotifError('İstek zaman aşımı','TIMEOUT')),ms))
])

/** Realtime dönüş tipi */
export type RealtimeUnsubscribe = () => void

export const NotificationsAPI = {
  /* ========== READ ========== */
  async listForUser(client: SupabaseClient, userId: string, opts?: { limit?: number }) {
    const { data, error } = await timeout(
      client.from('notifications')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(opts?.limit ?? 100)
    )
    if (error) throw toErr(error)
    return (data ?? []) as NotificationRow[]
  },

  async fetchById(client: SupabaseClient, userId: string, id: string) {
    const { data, error } = await timeout(
      client.from('notifications')
        .select('*')
        .eq('user_id', userId)
        .eq('id', id)
        .single()
    )
    if (error) throw toErr(error)
    return data as NotificationRow
  },

  async countUnread(client: SupabaseClient, userId: string) {
    const { count, error } = await timeout(
      client
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId)
        .is('read_at', null)
    )
    if (error) throw toErr(error)
    return count ?? 0
  },

  /* ========== WRITE ========== */
  async create(client: SupabaseClient, row: {
    user_id: string
    title: string
    body?: string | null
    type?: string
    level?: 'info'|'success'|'warning'|'error'|'danger'|string
    action_url?: string | null
  }) {
    const payload = {
      user_id: row.user_id,
      title: row.title,
      body: row.body ?? null,
      type: row.type ?? 'system',
      level: row.level ?? 'info',
      action_url: row.action_url ?? null,
    }
    const { data, error } = await timeout(
      client.from('notifications').insert(payload).select('*').single()
    )
    if (error) throw toErr(error)
    return data as NotificationRow
  },

  /** Çoklu insert (örn. Hoş geldiniz mesajları) */
  async bulkInsert(
    client: SupabaseClient,
    rows: Array<{
    user_id: string
    title: string
    body?: string | null
    type?: string
    level?: 'info'|'success'|'warning'|'error'|'danger'|string
    action_url?: string | null
  }>) {
    if (!rows?.length) return []
    const cleaned = rows.map(r => ({
      user_id: r.user_id,
      title: r.title,
      body: r.body ?? null,
      type: r.type ?? 'system',
      level: r.level ?? 'info',
      action_url: r.action_url ?? null
    }))
    const { data, error } = await timeout(
      client.from('notifications').insert(cleaned).select('*')
    )
    if (error) throw toErr(error)
    return (data ?? []) as NotificationRow[]
  },

  async markSeen(client: SupabaseClient, id: string) {
    const { error } = await timeout(
      client.from('notifications').update({ seen_at: new Date().toISOString() }).eq('id', id)
    )
    if (error) throw toErr(error)
  },

  async markRead(client: SupabaseClient, id: string) {
    const { error } = await timeout(
      client.from('notifications').update({ read_at: new Date().toISOString() }).eq('id', id)
    )
    if (error) throw toErr(error)
  },

  async markManySeen(client: SupabaseClient, ids: string[]) {
    if (!ids.length) return
    const { error } = await timeout(
      client.from('notifications').update({ seen_at: new Date().toISOString() }).in('id', ids)
    )
    if (error) throw toErr(error)
  },

  async markManyRead(client: SupabaseClient, ids: string[]) {
    if (!ids.length) return
    const { error } = await timeout(
      client.from('notifications').update({ read_at: new Date().toISOString() }).in('id', ids)
    )
    if (error) throw toErr(error)
  },

  /* ========== REALTIME ========== */
  /**
   * Kullanıcının bildirimleri için realtime aboneliği kurar.
   * INSERT/UPDATE/DELETE olaylarında cb(trigger, row) çağrılır.
   * Geri dönüş: aboneliği kapatmak için unsubscribe().
   */
  subscribeUser(client: SupabaseClient, userId: string, cb: (evt: 'INSERT'|'UPDATE'|'DELETE', row: any)=>void): RealtimeUnsubscribe {
    const channel = client.channel(`notifications-${userId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const evt = (payload.eventType as 'INSERT'|'UPDATE'|'DELETE')
          cb(evt, payload.new ?? payload.old)
        }
      )
      .subscribe()
    return () => { try { client.removeChannel(channel) } catch { /* noop */ } }
  }
}
