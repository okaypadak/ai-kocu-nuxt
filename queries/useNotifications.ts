// src/queries/useNotifications.ts
import { computed, onUnmounted, watch, unref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useQuery, useMutation, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../lib/supabase'

type UUID = string

export type NotificationRow = {
  id: UUID
  user_id: UUID
  sender_id?: UUID | null
  conversation_id?: string | null
  is_broadcast?: boolean | null
  type: 'system' | 'badge' | 'ai_comment' | 'message' | string
  level: 'info' | 'success' | 'warning' | 'error' | string
  title: string
  body: string | null
  status?: string | null
  action_url: string | null
  created_at: string
  read_at: string | null
  seen_at: string | null
}

export const qk = {
  notifications: {
    root: ['notifications'] as const,
    list: (
      uid: string,
      limit: number,
      onlyUnread: boolean,
      cursor: string | null,
      searchTitle: string,
      searchBody: string,
      onlyAi: boolean
    ) =>
      [
        'notifications',
        'list',
        uid,
        String(limit),
        String(onlyUnread),
        cursor ?? '',
        searchTitle,
        searchBody,
        String(onlyAi),
      ] as const,
    unreadCount: (uid: string) => ['notifications', 'unreadCount', uid] as const,
    byId: (id: string) => ['notifications', 'byId', id] as const,
  },
}

function shouldHideFromNotifications(row: NotificationRow) {
  if (row.type !== 'support') return false
  if (row.sender_id && row.sender_id === row.user_id) return true
  return false
}

/* ================= Fetchers ================= */
async function fetchList(params: {
  userId: string
  limit?: number
  onlyUnread?: boolean
  cursor?: string | null
  searchTitle?: string
  searchBody?: string
  onlyAi?: boolean
}): Promise<{ items: NotificationRow[]; nextCursor: string | null }> {
  const {
    userId,
    limit = 50,
    onlyUnread = false,
    cursor = null,
    searchTitle = '',
    searchBody = '',
    onlyAi = false,
  } = params
  let q = supabase
    .from('notifications')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (onlyUnread) q = q.is('read_at', null)
  if (cursor) q = q.lt('created_at', cursor)
  if (searchTitle) q = q.ilike('title', `%${searchTitle}%`)
  if (searchBody) q = q.ilike('body', `%${searchBody}%`)
  if (onlyAi) q = q.ilike('type', '%ai%')

  const { data, error } = await q
  if (error) throw error
  const rawItems = (data ?? []) as NotificationRow[]
  const items = rawItems.filter((row) => !shouldHideFromNotifications(row))
  const nextCursor =
    rawItems.length === limit && rawItems.length > 0
      ? rawItems[rawItems.length - 1]!.created_at
      : null
  return { items, nextCursor }
}

async function fetchUnreadCount(userId: string): Promise<number> {
  const { count, error } = await supabase
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
  return count ?? 0
}

async function fetchById(id: string): Promise<NotificationRow | null> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return (data ?? null) as NotificationRow | null
}

/* ================= Queries ================= */
type ListOpts = {
  limit?: number
  onlyUnread?: boolean
  cursor?: string | null
  searchTitle?: string
  searchBody?: string
  onlyAi?: boolean
}

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

export function useNotificationsList(userId: MaybeRef<string | undefined>, opts?: MaybeRef<ListOpts>) {
  const resolvedUserId = computed(() => unref(userId))
  const resolvedOpts = computed(() => unref(opts) ?? {})

  const limit = computed(() => resolvedOpts.value.limit ?? 50)
  const onlyUnread = computed(() => resolvedOpts.value.onlyUnread ?? false)
  const cursor = computed(() => resolvedOpts.value.cursor ?? null)
  const searchTitle = computed(() => resolvedOpts.value.searchTitle ?? '')
  const searchBody = computed(() => resolvedOpts.value.searchBody ?? '')
  const onlyAi = computed(() => resolvedOpts.value.onlyAi ?? false)

  return useQuery({
    enabled: computed(() => !!resolvedUserId.value),
    queryKey: computed(() =>
      qk.notifications.list(
        resolvedUserId.value ?? '',
        limit.value,
        onlyUnread.value,
        cursor.value,
        searchTitle.value,
        searchBody.value,
        onlyAi.value
      )
    ),
    queryFn: () => {
      const uid = resolvedUserId.value
      if (!uid) throw new Error('Missing user id for notification list')
      return fetchList({
        userId: uid,
        limit: limit.value,
        onlyUnread: onlyUnread.value,
        cursor: cursor.value,
        searchTitle: searchTitle.value,
        searchBody: searchBody.value,
        onlyAi: onlyAi.value,
      })
    },
    placeholderData: (prev) => prev,
  })
}

export function useUnreadCount(userId: MaybeRef<string | undefined>) {
  const resolvedUserId = computed(() => unref(userId))
  return useQuery({
    enabled: computed(() => !!resolvedUserId.value),
    queryKey: computed(() => qk.notifications.unreadCount(resolvedUserId.value ?? '')),
    queryFn: () => fetchUnreadCount(resolvedUserId.value!),
    // Realtime invalidate already updates; keep interval as a safety net
    refetchInterval: 60_000,
    placeholderData: (prev) => prev ?? 0,
  })
}

export function useNotificationById(id: MaybeRef<string | undefined>) {
  const resolvedId = computed(() => unref(id))
  return useQuery({
    enabled: computed(() => !!resolvedId.value),
    queryKey: computed(() => qk.notifications.byId(resolvedId.value ?? '')),
    queryFn: () => fetchById(resolvedId.value!),
    placeholderData: (prev) => prev,
  })
}

/* ================= Mutations ================= */
async function markAsRead(id: UUID) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', id)
  if (error) throw error
}

async function markAllAsRead(userId: string) {
  const { error } = await supabase
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', userId)
    .is('read_at', null)
  if (error) throw error
}

async function removeOne(id: UUID) {
  const { error } = await supabase.from('notifications').delete().eq('id', id)
  if (error) throw error
}

export function useMarkAsRead() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: UUID) => markAsRead(id),
    onSuccess: (_data, _id) => {
      qc.invalidateQueries({ queryKey: qk.notifications.root })
    },
  })
}

/** Alias: bazı sayfalarda useMarkRead import ediliyor */
export function useMarkRead() {
  return useMarkAsRead()
}

export function useMarkAllAsRead(userId: MaybeRef<string | undefined>) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: () => {
      const uid = unref(userId)
      if (!uid) throw new Error('Missing user id for markAllAsRead')
      return markAllAsRead(uid)
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications.root })
    },
  })
}

export function useDeleteNotification() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (id: UUID) => removeOne(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.notifications.root })
    },
  })
}

/* ================= Realtime ================= */
export function useNotificationsRealtime(
  userId: MaybeRef<string | undefined>,
  opts?: { onEvent?: (evt: 'INSERT' | 'UPDATE' | 'DELETE', row: any) => void }
) {
  const qc = useQueryClient()
  const resolvedUserId = computed(() => unref(userId))

  let channel: ReturnType<typeof supabase.channel> | null = null
  let fallbackTimer: any = null
  const startFallback = () => {
    if (fallbackTimer) return
    fallbackTimer = setInterval(() => {
      qc.invalidateQueries({ queryKey: qk.notifications.root })
    }, 10_000)
  }
  const stopFallback = () => {
    if (!fallbackTimer) return
    clearInterval(fallbackTimer)
    fallbackTimer = null
  }
  const cleanup = () => {
    if (!channel) return
    try {
      supabase.removeChannel(channel)
    } catch {
      /* noop */
    } finally {
      channel = null
    }
  }

  const stop = watch(
    resolvedUserId,
    (uid) => {
      cleanup()
      if (!uid) return
      channel = supabase
        .channel(`notifs-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `user_id=eq.${uid}` },
          (payload) => {
            const evt = (payload.eventType as 'INSERT' | 'UPDATE' | 'DELETE')
            const row = payload.new ?? payload.old
            try { opts?.onEvent?.(evt, row) } catch { /* noop */ }
            qc.invalidateQueries({ queryKey: qk.notifications.root })
          }
        )
        .subscribe((status) => {
          if (import.meta && (import.meta as any).env?.DEV) {
            console.debug('[realtime] notifications', uid, 'status:', status)
          }
          if (status === 'SUBSCRIBED') {
            stopFallback()
          } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
            startFallback()
          }
        })
    },
    { immediate: true }
  )

  onUnmounted(() => {
    stop()
    cleanup()
    stopFallback()
  })
}
