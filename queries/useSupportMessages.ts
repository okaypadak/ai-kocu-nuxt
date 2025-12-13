// src/queries/useSupportMessages.ts
import { computed, onMounted, onUnmounted, unref, watch } from 'vue'
import type { ComputedRef, Ref } from 'vue'
import { useMutation, useQuery, useQueryClient } from '@tanstack/vue-query'
import { supabase } from '../lib/supabase'
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
  root: ['support'] as const,
  messages: (uid: string) => ['support', 'messages', uid] as const,
  inbox: (limit: number) => ['support', 'inbox', String(limit)] as const,
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

async function fetchSupportMessages(participantId: string, conversationId?: string | null): Promise<SupportMessage[]> {
  let q = supabase
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

async function fetchAllSupportMessages(participantId: string): Promise<SupportMessage[]> {
  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .eq('type', SUPPORT_TYPE)
    .or(`user_id.eq.${participantId},sender_id.eq.${participantId}`)
    .order('created_at', { ascending: true })

  if (error) throw error
  return (data ?? []) as SupportMessage[]
}

async function fetchSupportInbox(limit: number): Promise<SupportMessage[]> {
  const { data, error } = await supabase
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

async function insertSupportMessage(payload: InsertPayload) {
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

  const { data, error } = await supabase
    .from('notifications')
    .insert(baseData)
    .select('*')
    .single()

  if (error) throw error
  return data as SupportMessage
}

async function updateConversationStatus(conversationId: string, status: string) {
  const { data, error } = await supabase
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

  return useQuery({
    enabled: computed(() => !!resolvedUserId.value),
    queryKey: computed(() =>
      resolvedUserId.value
        ? [...supportQk.messages(resolvedUserId.value), conversationQueryKey.value]
        : ['support', 'messages', '', conversationQueryKey.value]
    ),
    queryFn: () => {
      if (!resolvedUserId.value) throw new Error('Missing participant id')
      if (conversationArgProvided) {
        return fetchSupportMessages(resolvedUserId.value, resolvedConversationId.value ?? null)
      }
      return fetchAllSupportMessages(resolvedUserId.value)
    },
    placeholderData: (prev) => prev,
  })
}

export function useSupportInbox(limit: number = DEFAULT_INBOX_LIMIT) {
  return useQuery({
    queryKey: computed(() => supportQk.inbox(limit)),
    queryFn: () => fetchSupportInbox(limit),
    refetchInterval: 60_000,
    placeholderData: (prev) => prev,
  })
}

export function useInsertSupportMessage() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: InsertPayload) => insertSupportMessage(payload),
    onSuccess: (_data, variables) => {
      qc.invalidateQueries({ queryKey: supportQk.root })
      const keys = conversationKeysForId(variables?.conversationId)
      const invalidateForParticipant = (uid?: string | null) => {
        if (!uid) return
        for (const key of keys) {
          qc.invalidateQueries({ queryKey: [...supportQk.messages(uid), key] })
        }
      }
      if (variables?.receiverId) invalidateForParticipant(variables.receiverId)
      if (variables?.senderId) invalidateForParticipant(variables.senderId)
    },
  })
}

export function useSetConversationStatus() {
  const qc = useQueryClient()

  return useMutation({
    mutationFn: (payload: { conversationId: string; status: string }) =>
      updateConversationStatus(payload.conversationId, payload.status),
    onSuccess: (data, variables) => {
      qc.invalidateQueries({ queryKey: supportQk.root })
      const keys = conversationKeysForId(variables?.conversationId)
      const participants = new Set<string>()
      data?.forEach((row) => {
        if (row.user_id) participants.add(row.user_id)
        if (row.sender_id) participants.add(row.sender_id)
      })
      participants.forEach((uid) => {
        for (const key of keys) {
          qc.invalidateQueries({ queryKey: [...supportQk.messages(uid), key] })
        }
      })
    },
  })
}

export function useSupportRealtime(userId: MaybeRef<string | null | undefined>) {
  const qc = useQueryClient()
  const resolvedUserId = computed(() => unref(userId))

  let channel: ReturnType<typeof supabase.channel> | null = null

  const cleanup = () => {
    if (!channel) return
    try {
      supabase.removeChannel(channel)
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
      channel = supabase
        .channel(`support-${uid}`)
        .on(
          'postgres_changes',
          { event: '*', schema: 'public', table: 'notifications', filter: `type=eq.${SUPPORT_TYPE}` },
          (payload) => {
            const row = (payload.new ?? payload.old) as SupportMessage | undefined
            if (!row || row.type !== SUPPORT_TYPE) return
            if (row.user_id === uid || row.sender_id === uid) {
              const keys = conversationKeysForId(row.conversation_id)
              for (const key of keys) {
                qc.invalidateQueries({ queryKey: [...supportQk.messages(uid), key] })
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
  const qc = useQueryClient()
  let channel: ReturnType<typeof supabase.channel> | null = null

  onMounted(() => {
    channel = supabase
      .channel(`support-inbox-${limit}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'notifications', filter: `type=eq.${SUPPORT_TYPE}` },
        () => {
          qc.invalidateQueries({ queryKey: supportQk.inbox(limit) })
        }
      )
      .subscribe()
  })

  onUnmounted(() => {
    if (!channel) return
    try {
      supabase.removeChannel(channel)
    } catch {
      /* noop */
    }
  })
}
