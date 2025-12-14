// src/queries/useNotifications.ts
import { computed, onUnmounted, watch, unref, ref, onMounted } from 'vue'
import type { ComputedRef, Ref } from 'vue'
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
    // String keys for Nuxt
    root: 'notifications',
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
      ].join(':'),
    unreadCount: (uid: string) => `notifications:unreadCount:${uid}`,
    byId: (id: string) => `notifications:byId:${id}`,
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

  const key = computed(() => 
    qk.notifications.list(
      resolvedUserId.value ?? '',
      limit.value,
      onlyUnread.value,
      cursor.value,
      searchTitle.value,
      searchBody.value,
      onlyAi.value
    )
  )

  const { data, pending, error, refresh } = useAsyncData<{ items: NotificationRow[]; nextCursor: string | null }>(
      key.value,
      () => {
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
      {
          watch: [resolvedUserId, resolvedOpts, limit, onlyUnread, cursor, searchTitle, searchBody, onlyAi],

      }
  )

  const isError = computed(() => Boolean(error.value))

  return { data, isLoading: pending, isError, error, refetch: refresh }
}

export function useUnreadCount(userId: MaybeRef<string | undefined>) {
  const resolvedUserId = computed(() => unref(userId))
  const key = computed(() => qk.notifications.unreadCount(resolvedUserId.value ?? ''))

  const { data, pending, error, refresh } = useAsyncData<number>(
      key.value,
      () => {
          if (!resolvedUserId.value) return Promise.resolve(0)
          return fetchUnreadCount(resolvedUserId.value)
      },
      {
          watch: [resolvedUserId],

      }
  )
  
  return { data, isLoading: pending, error, refetch: refresh }
}

export function useNotificationById(id: MaybeRef<string | undefined>) {
  const resolvedId = computed(() => unref(id))
  const key = computed(() => qk.notifications.byId(resolvedId.value ?? ''))

  const { data, pending, error, refresh } = useAsyncData<NotificationRow | null>(
      key.value,
      () => {
          if (!resolvedId.value) return Promise.resolve(null)
          return fetchById(resolvedId.value)
      },
      {
          watch: [resolvedId],

      }
  )
  
  return { data, isLoading: pending, error, refetch: refresh }
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

// Helper to invalidate known keys logic
function invalidateNotifications(uid?: string) {
    if (uid) {
        refreshNuxtData(qk.notifications.unreadCount(uid))
        // Cannot easily invalidate lists because of variable params (limit, filter, etc.)
        // But if we stick to a convention or refresh via a global trigger for lists...
        // For now, let's refresh unread count as it is most critical.
        // And maybe refresh current page usage via logic in the component layer?
        // Or broad refresh?
        // Note: useNotificationsList uses specific keys.
        // We lack "invalidateQueries(['notifications'])" behavior.
    }
}

// We will use a shared trigger for notification lists if needed, 
// OR we rely on Realtime which we implement below.
export const useNotificationTrigger = () => useState('notificationTrigger', () => 0)

export function useMarkAsRead() {
  const trigger = useNotificationTrigger()
  const isPending = ref(false)

  async function mutateAsync(id: UUID) {
      if (isPending.value) return
      isPending.value = true
      try {
        await markAsRead(id)
        trigger.value++ // Signal list refresh?
        // Also need to refresh unread count for current user?
        // We don't have userID here easily unless passed.
        // But component calling this likely knows.
      } finally {
        isPending.value = false
      }
  }

  return {
    mutateAsync,
    mutate: (p: any, opts?: any) =>
      mutateAsync(p)
        .then((res) => {
          opts?.onSuccess?.(res)
          return res
        })
        .catch((err) => {
          opts?.onError?.(err)
          throw err
        }),
    isLoading: isPending,
    isPending,
  }
}

/** Alias: bazı sayfalarda useMarkRead import ediliyor */
export function useMarkRead() {
  return useMarkAsRead()
}

export function useMarkAllAsRead(userId: MaybeRef<string | undefined>) {
  const trigger = useNotificationTrigger()
  const isPending = ref(false)
  
  async function mutateAsync() {
      if (isPending.value) return
      const uid = unref(userId)
      if (!uid) throw new Error('Missing user id for markAllAsRead')
      isPending.value = true
      try {
        await markAllAsRead(uid)
        
        trigger.value++
        refreshNuxtData(qk.notifications.unreadCount(uid))
      } finally {
        isPending.value = false
      }
  }

  return {
    mutateAsync,
    mutate: (p?: any, opts?: any) =>
      mutateAsync()
        .then((res) => {
          opts?.onSuccess?.(res)
          return res
        })
        .catch((err) => {
          opts?.onError?.(err)
          throw err
        }),
    isLoading: isPending,
    isPending,
  }
}

export function useDeleteNotification() {
  const trigger = useNotificationTrigger()
  const isPending = ref(false)

  async function mutateAsync(id: UUID) {
      if (isPending.value) return
      isPending.value = true
      try {
        await removeOne(id)
        trigger.value++
      } finally {
        isPending.value = false
      }
  }

  return {
    mutateAsync,
    mutate: (p: any, opts?: any) =>
      mutateAsync(p)
        .then((res) => {
          opts?.onSuccess?.(res)
          return res
        })
        .catch((err) => {
          opts?.onError?.(err)
          throw err
        }),
    isLoading: isPending,
    isPending,
  }
}

/* ================= Realtime ================= */
export function useNotificationsRealtime(
  userId: MaybeRef<string | undefined>,
  opts?: { onEvent?: (evt: 'INSERT' | 'UPDATE' | 'DELETE', row: any) => void }
) {
  const resolvedUserId = computed(() => unref(userId))
  const trigger = useNotificationTrigger()

  let channel: ReturnType<typeof supabase.channel> | null = null
  let fallbackTimer: any = null
  const startFallback = () => {
    if (fallbackTimer) return
    fallbackTimer = setInterval(() => {
      trigger.value++
      if (resolvedUserId.value) refreshNuxtData(qk.notifications.unreadCount(resolvedUserId.value))
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
            
            trigger.value++
            refreshNuxtData(qk.notifications.unreadCount(uid))
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
