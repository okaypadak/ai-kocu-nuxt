// src/queries/useSupportMessages.ts
import { computed, onMounted, onUnmounted, unref, watch, ref } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import type { NotificationRow as BaseNotificationRow } from './useNotifications'

type MaybeRef<T> = T | Ref<T> | ComputedRef<T>

export type SupportMessage = BaseNotificationRow & {
  conversation_id: string | null
  sender_id: string | null
  is_broadcast?: boolean | null
}

const SUPPORT_TYPE = 'support'

const DEFAULT_INBOX_LIMIT = 400

export const supportQk = {
  // Helpers for generating string keys
  messages: (uid: string, conversationPart: string) => `support:messages:${uid}:${conversationPart}`,
  inbox: (limit: number) => `support:inbox:${limit}`,
}

const CONVERSATION_ALL_KEY = 'all'
const CONVERSATION_NULL_KEY = 'null'

const conversationKeyFromId = (conversationId?: string | null) =>
  conversationId ?? CONVERSATION_NULL_KEY

const conversationKeysForId = (conversationId?: string | null) => {
  const keys = new Set<string>([CONVERSATION_ALL_KEY, conversationKeyFromId(conversationId)])
  if (conversationId) keys.add(conversationId)
  return keys
}

async function fetchSupportMessages(client: any, participantId: string, conversationId?: string | null): Promise<SupportMessage[]> {
  let q = client
    .from('notifications')
    .select('*')
    .eq('type', SUPPORT_TYPE)
    .or(`user_id.eq.${participantId},sender_id.eq.${participantId}`)
    .order('created_at', { ascending: true })

  if (conversationId) {
    q = q.eq('conversation_id', conversationId)
  } else {
    q = q.is('conversation_id', null)
  }

  const { data, error } = await q
  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

async function fetchAllSupportMessages(client: any, participantId: string): Promise<SupportMessage[]> {
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('type', SUPPORT_TYPE)
    .or(`user_id.eq.${participantId},sender_id.eq.${participantId}`)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

async function fetchSupportInbox(client: any, limit: number): Promise<SupportMessage[]> {
  const { data, error } = await client
    .from('notifications')
    .select('*')
    .eq('type', SUPPORT_TYPE)
    .order('created_at', { ascending: false })
    .limit(limit)

  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

type InsertPayload = {
  receiverId: string
  senderId: string
  body: string
  title?: string
  level?: BaseNotificationRow['level']
  isBroadcast?: boolean
  conversationId?: string | null
  status?: string
}

async function insertSupportMessage(client: any, payload: InsertPayload) {
  const baseData = {
    user_id: payload.receiverId,
    sender_id: payload.senderId,
    is_broadcast: payload.isBroadcast ?? false,
    conversation_id: payload.conversationId ?? null,
    status: payload.status ?? 'pending',
    title: payload.title ?? 'Mesaj',
    body: payload.body,
    level: payload.level ?? 'info',
    type: SUPPORT_TYPE,
    action_url: null,
    read_at: null,
    seen_at: null,
  }

  const { data, error } = await client
    .from('notifications')
    .insert(baseData)
    .select('*')
    .single()

  if (error) throw error
  return data as SupportMessage
}

async function updateConversationStatus(client: any, conversationId: string, status: string) {
  const { data, error } = await client
    .from('notifications')
    .update({ status })
    .eq('conversation_id', conversationId)
  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

export function useSupportMessages(
  userId: MaybeRef<string | null | undefined>,
  conversationId?: MaybeRef<string | null | undefined>
) {
  const client = useSupabaseClient()
  const resolvedUserId = computed(() => unref(userId))
  const conversationArgProvided = conversationId !== undefined
  const resolvedConversationId = computed(() =>
    conversationArgProvided ? unref(conversationId) ?? null : undefined
  )
  const conversationQueryKey = computed(() =>
    conversationArgProvided
      ? conversationKeyFromId(resolvedConversationId.value)
      : CONVERSATION_ALL_KEY
  )

  const key = computed(() => 
      resolvedUserId.value 
      ? supportQk.messages(resolvedUserId.value, conversationQueryKey.value)
      : `support:messages:guest:${conversationQueryKey.value}`
  )

  const { data, pending, error, refresh } = useAsyncData<SupportMessage[]>(
      key.value,
      () => {
          if (!resolvedUserId.value) throw new Error('Missing participant id')
          if (conversationArgProvided) {
            return fetchSupportMessages(client, resolvedUserId.value, resolvedConversationId.value ?? null)
          }
          return fetchAllSupportMessages(client, resolvedUserId.value)
      },
      {
          watch: [resolvedUserId, resolvedConversationId, conversationQueryKey],
      }
  )

  return {
      data,
      isLoading: pending,
      error,
      refetch: refresh
  }
}

export function useSupportInbox(limit: number = DEFAULT_INBOX_LIMIT) {
  const client = useSupabaseClient()
  const { data, pending, error, refresh } = useAsyncData<SupportMessage[]>(
      supportQk.inbox(limit),
      () => fetchSupportInbox(client, limit),
      {
          // refetchInterval equivalent? useInterval in @vueuse or manual setInterval calling refresh()
          // Nuxt doesn't have refetchInterval built-in useAsyncData.
          // We can use a watcher manually if needed, or SKIP interval for now (better for server cost).
          // Assuming user is fine with lack of interval or using realtime subscription instead.
      }
  )

  // Emulate refetchInterval if critical
  // For now skipping to reduce complexity, relying on realtime hook.
  
  return {
    data, 
    isLoading: pending,
    error,
    refetch: refresh
  }
}

export function useInsertSupportMessage() {
  const client = useSupabaseClient()
  const isLoading = ref(false)
  const isError = ref(false)
  const error = ref<any>(null)

  async function mutateAsync(payload: InsertPayload) {
      isLoading.value = true
      isError.value = false
      error.value = null
      
      try {
        const res = await insertSupportMessage(client, payload)
        
        // Invalidate queries
        // Root equivalent? Try to refresh known common inbox
        refreshNuxtData(supportQk.inbox(DEFAULT_INBOX_LIMIT))

        const keys = conversationKeysForId(payload.conversationId)
        const invalidateForParticipant = (uid?: string | null) => {
          if (!uid) return
          for (const k of keys) {
            refreshNuxtData(supportQk.messages(uid, k))
          }
        }
        if (payload.receiverId) invalidateForParticipant(payload.receiverId)
        if (payload.senderId) invalidateForParticipant(payload.senderId)
        
        return res
      } catch (err) {
        isError.value = true
        error.value = err
        throw err
      } finally {
        isLoading.value = false
      }
  }

  return {
    mutateAsync,
    mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
    isLoading,
    isPending: isLoading,
    isError,
    error
  }
}

export function useSetConversationStatus() {
  const client = useSupabaseClient()
  async function mutateAsync(payload: { conversationId: string; status: string }) {
      const data = await updateConversationStatus(client, payload.conversationId, payload.status)
      
      refreshNuxtData(supportQk.inbox(DEFAULT_INBOX_LIMIT))
      
      const keys = conversationKeysForId(payload.conversationId)
      const participants = new Set<string>()
      data?.forEach((row: any) => {
        if (row.user_id) participants.add(row.user_id)
        if (row.sender_id) participants.add(row.sender_id)
      })
      participants.forEach((uid) => {
        for (const k of keys) {
            refreshNuxtData(supportQk.messages(uid, k))
        }
      })
      return data
  }

  return {
    mutateAsync,
    mutate: (p: any, opts?: any) => mutateAsync(p).then(opts?.onSuccess).catch(opts?.onError),
    isLoading: ref(false)
  }
}

export function useSupportRealtime(userId: MaybeRef<string | null | undefined>) {
  const client = useSupabaseClient()
  const resolvedUserId = computed(() => unref(userId))

  let channel: any = null

  const cleanup = () => {
    if (!channel) return
    try {
      client.removeChannel(channel)
    } catch {
      /* noop */
    }
    channel = null
  }

  const stop = watch(
    resolvedUserId,
    (uid) => {
      cleanup()
      if (!uid) return
      channel = client
        .channel(`support-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `type=eq.${SUPPORT_TYPE}` },
          (payload) => {
            const row = (payload.new ?? payload.old) as SupportMessage | undefined
            if (!row || row.type !== SUPPORT_TYPE) return
            if (row.user_id === uid || row.sender_id === uid) {
              const keys = conversationKeysForId(row.conversation_id)
              for (const k of keys) {
                refreshNuxtData(supportQk.messages(uid, k))
              }
            }
          }
        )
        .subscribe()
    },
    { immediate: true }
  )

  onUnmounted(() => {
    stop()
    cleanup()
  })
}

export function useSupportInboxRealtime(limit: number = DEFAULT_INBOX_LIMIT) {
  const client = useSupabaseClient()
  let channel: any = null

  onMounted(() => {
    channel = client
      .channel(`support-inbox-${limit}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `type=eq.${SUPPORT_TYPE}` },
        () => {
          refreshNuxtData(supportQk.inbox(limit))
        }
      )
      .subscribe()
  })

  onUnmounted(() => {
    if (!channel) return
    try {
      client.removeChannel(channel)
    } catch {
      /* noop */
    }
  })
}
