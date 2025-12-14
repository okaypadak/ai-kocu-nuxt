<!-- src/views/destek-mesajlari.vue -->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import Navbar from "../components/Navbar.vue";
import { useAuthStore } from "../stores/auth.store";
import {
  useSupportMessages,
  useInsertSupportMessage,
  useSupportRealtime,
} from "../queries/useSupportMessages";
import type { SupportMessage } from "../queries/useSupportMessages";

const auth = useAuthStore();
const userId = computed(() => auth.userId);

const SUPPORT_ADMIN_ID = (import.meta.env.VITE_SUPPORT_ADMIN_USER_ID as string | undefined) ?? null;

const {
  data: list,
  isLoading,
  isError,
  error,
  refetch,
} = useSupportMessages(userId);

useSupportRealtime(userId);

const messages = computed(() => list.value ?? []);
const sendMut = useInsertSupportMessage();
const messageText = ref("");
const messagesRef = ref<HTMLElement | null>(null);
const selectedConversationId = ref<string | null>(null);
const draftConversationId = ref<string | null>(null);

const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  started: "Yanıtlandı",
  closed: "Kapandı",
}
const statusLabel = (status?: string | null) => STATUS_LABELS[status ?? "pending"] ?? STATUS_LABELS.pending
const statusBadgeClass = (status?: string | null) => {
  switch (status) {
    case "started":
      return "bg-emerald-100 text-emerald-600"
    case "closed":
      return "bg-slate-100 text-slate-500"
    default:
      return "bg-amber-100 text-amber-600"
  }
}

const canSend = computed(
  () =>
    messageText.value.trim().length > 2 &&
    !!userId.value &&
    !sendMut.isPending.value
);

type ConversationMeta = {
  key: string;
  conversationId: string | null;
  lastCreatedAt: string;
  lastDirection: "incoming" | "outgoing";
  preview: string;
};

function messageKey(msg: SupportMessage) {
  const direction: "incoming" | "outgoing" = isIncoming(msg) ? "incoming" : "outgoing";
  return { key: msg.conversation_id ?? "legacy", direction };
}

const conversations = computed<ConversationMeta[]>(() => {
  const rows = messages.value;
  const grouped = new Map<string, SupportMessage[]>();

  rows.forEach((row) => {
    const key = row.conversation_id ?? "legacy";
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  });

  return Array.from(grouped.entries())
    .map(([key, entries]) => {
      const sorted = [...entries].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );
      const last = sorted[0]!;
      const { direction } = messageKey(last);
      return {
        key,
        conversationId: last.conversation_id,
        lastCreatedAt: last.created_at,
        lastDirection: direction,
        preview: last.body ?? "",
      };
    })
    .sort(
      (a, b) =>
        new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime()
    );
});

watch(
  conversations,
  (list) => {
    if (!list.length) {
      if (!draftConversationId.value) {
        selectedConversationId.value = null;
      }
      return;
    }
    const hasSelectedInList = selectedConversationId.value
      ? list.some((c) => c.key === selectedConversationId.value)
      : false;
    if (!selectedConversationId.value || (!hasSelectedInList && selectedConversationId.value !== draftConversationId.value)) {
      selectedConversationId.value = list[0]!.key;
      draftConversationId.value = null;
    }
  },
  { immediate: true }
);

const conversationMessages = computed(() => {
  const key = selectedConversationId.value ?? "legacy";
  return messages.value.filter((msg) => (msg.conversation_id ?? "legacy") === key);
});

const conversationStatus = computed(() => {
  const last = conversationMessages.value[conversationMessages.value.length - 1];
  return last?.status ?? "pending";
});

function isIncoming(msg: SupportMessage) {
  const selfId = userId.value;
  if (msg.sender_id && selfId) {
    return msg.sender_id !== selfId;
  }
  return true;
}

function senderLabel(msg: SupportMessage) {
  const selfId = userId.value;
  if (msg.sender_id && selfId) {
    return msg.sender_id === selfId ? "Sen" : "AI Koçu";
  }
  return "AI Koçu";
}

function sendMessage() {
  const text = messageText.value.trim();
  const uid = userId.value;
  const receiverId = SUPPORT_ADMIN_ID || uid;
  if (!text || !uid || !receiverId) return;

  const conversationId =
    selectedConversationId.value && selectedConversationId.value !== "legacy"
      ? selectedConversationId.value
      : null;

  sendMut.mutate(
    {
      receiverId,
      senderId: uid,
      body: text,
      title: "Destek Mesajı",
      conversationId,
      status: "pending",
    },
    {
      onSuccess: () => {
        messageText.value = "";
        scrollToBottom();
      },
      onSettled: () => {
        void refetch();
      },
    }
  );
}

function scrollToBottom() {
  nextTick(() => {
    if (messagesRef.value) {
      messagesRef.value.scrollTo({
        top: messagesRef.value.scrollHeight,
        behavior: "smooth",
      });
    }
  });
}

watch(messages, () => {
  scrollToBottom();
});

watch(conversationMessages, () => {
  scrollToBottom();
});

function startNewConversation() {
  const newId =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  selectedConversationId.value = newId;
  draftConversationId.value = newId;
  messageText.value = "";
}
</script>

<template>
  <div class="min-h-screen bg-white xl:bg-sky-100 flex flex-col px-0 sm:px-4">
    <header>
      <Navbar />
    </header>

    <main class="flex-grow flex items-start justify-center px-0 py-6 xl:px-4 xl:py-8">
      <div
        class="w-full max-w-5xl bg-white rounded-none shadow-none border-0 p-4 md:p-8 flex flex-col gap-6 xl:rounded-3xl xl:shadow-2xl xl:border xl:border-slate-100"
      >
        <header class="space-y-3 text-center md:text-left">
          <div class="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
            <div class="space-y-1">
              <h1 class="text-3xl font-bold text-sky-700">💬 Destek Mesajları</h1>
              <p class="text-slate-600">
                Koç ekibine merak ettiklerini yazabilir, yanıtları bildirim olarak alabilirsin.
                Mesajların bildirim altyapısı üzerinden akar.
              </p>
            </div>
            <button
              type="button"
              class="rounded-full px-4 py-2 text-sm font-semibold bg-slate-100 text-sky-700 hover:bg-slate-200 border border-slate-200"
              @click="startNewConversation"
            >
              Yeni destek mesajı başlat
            </button>
          </div>
          <p class="text-sm text-slate-600 flex items-center justify-center md:justify-start gap-2">
            Durum:
            <span
              :class="[
                'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                statusBadgeClass(conversationStatus),
              ]"
            >
              {{ statusLabel(conversationStatus) }}
            </span>
          </p>
        </header>

        <div class="grid gap-4 md:grid-cols-[220px,1fr]">
          <aside class="space-y-2">
            <div class="flex items-center justify-between">
              <h2 class="text-sm font-semibold text-slate-700">Sohbetler</h2>
              <span class="text-xs text-slate-500">{{ conversations.length }}</span>
            </div>
            <div class="rounded-2xl border border-slate-200 bg-slate-50 p-2 space-y-2 max-h-[60vh] overflow-y-auto">
              <p v-if="!conversations.length && !isLoading" class="text-sm text-slate-500 text-center">
                Henüz sohbet yok.
              </p>
              <button
                v-for="conv in conversations"
                :key="conv.key"
                type="button"
                class="w-full text-left rounded-xl px-3 py-2 transition flex flex-col gap-1"
                :class="
                  conv.key === selectedConversationId
                    ? 'bg-white shadow border border-sky-200'
                    : 'hover:bg-white'
                "
                @click="selectedConversationId = conv.key"
              >
                <div class="flex items-center justify-between">
                  <span class="text-sm font-semibold text-slate-700">
                    {{ conv.key === 'legacy' ? 'Önceki sohbet' : 'Sohbet #' + conv.key.slice(0, 8) }}
                  </span>
                  <span
                    v-if="conv.lastDirection === 'incoming'"
                    class="text-[11px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full"
                  >
                    Yeni
                  </span>
                </div>
                <p class="text-xs text-slate-600 line-clamp-2">{{ conv.preview }}</p>
                <p class="text-[11px] text-slate-400">
                  {{
                    new Date(conv.lastCreatedAt).toLocaleString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                      day: "2-digit",
                      month: "short",
                    })
                  }}
                </p>
              </button>
            </div>
          </aside>

          <section
            ref="messagesRef"
            class="flex-1 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 overflow-y-auto space-y-4 min-h-[360px]"
          >
            <div
              v-if="isLoading"
              class="rounded-xl border border-sky-100 bg-sky-50 text-sky-700 px-4 py-3 text-center"
            >
              Mesajların yükleniyor…
            </div>

            <div
              v-else-if="isError"
              class="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-center"
            >
              Hata: {{ (error as any)?.message || "Mesajlar alınamadı." }}
            </div>

            <div v-else-if="!conversationMessages.length" class="text-center text-slate-500 py-8">
              Henüz bu sohbet için mesaj yok. İlk mesajını yazabilirsin.
            </div>

            <div v-else class="space-y-3">
              <article
                v-for="msg in conversationMessages"
                :key="msg.id"
                class="flex"
                :class="isIncoming(msg) ? 'justify-start' : 'justify-end'"
              >
                <div
                  class="max-w-[80%] rounded-2xl px-4 py-3 shadow text-sm md:text-base"
                  :class="
                    isIncoming(msg)
                      ? 'bg-white border border-slate-200 text-slate-700'
                      : 'bg-sky-600 text-white'
                  "
                >
                  <p class="whitespace-pre-wrap leading-relaxed">
                    {{ msg.body }}
                  </p>
                  <p
                    class="text-[11px] md:text-xs mt-2 opacity-80 text-right flex items-center justify-end gap-1"
                  >
                    <span>{{ senderLabel(msg) }}</span>
                    <span aria-hidden="true">•</span>
                    <time :datetime="msg.created_at">{{
                      new Date(msg.created_at).toLocaleString("tr-TR", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })
                    }}</time>
                  </p>
                </div>
              </article>
            </div>
          </section>
        </div>

        <p v-if="conversationStatus === 'closed'" class="text-sm text-center text-slate-500">
          Bu sohbet kapatıldı, yeni bir mesaj yazarak yeniden beklemeye alabilirsin.
        </p>

        <section class="space-y-3">
          <label class="text-sm font-semibold text-slate-600">
            Mesajın
            <textarea
              v-model="messageText"
              class="mt-1 w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-[120px]"
              placeholder="Bize iletmek istediğin mesajını yaz..."
            ></textarea>
          </label>

          <div class="flex flex-wrap items-center gap-3 justify-end">
            <p v-if="sendMut.isError.value" class="text-sm text-red-600">
              {{ (sendMut.error.value as any)?.message || "Mesaj gönderilemedi." }}
            </p>

            <button
              type="button"
              class="rounded-full px-6 py-2 font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
              :disabled="!canSend"
              @click="sendMessage"
            >
              {{ sendMut.isPending.value ? "Gönderiliyor…" : "Mesajı Gönder" }}
            </button>
          </div>
        </section>

        <p class="text-xs text-slate-500 text-center md:text-right">
          Gönderdiğin her mesaj, bildirimler bölümünde saklanır ve yanıt geldiğinde
          ayrıca bildirim alırsın.
        </p>
      </div>
    </main>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
