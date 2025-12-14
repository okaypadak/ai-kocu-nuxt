<!-- src/views/AdminSupportMessagesView.vue -->
<script setup lang="ts">
import { computed, nextTick, ref, watch } from "vue";
import Navbar from "../components/Navbar.vue";
import { useAuthStore } from "../stores/auth.store";
import {
  useSupportInbox,
  useSupportMessages,
  useInsertSupportMessage,
  useSupportRealtime,
  useSupportInboxRealtime,
  useSetConversationStatus,
} from "../queries/useSupportMessages";
import type { SupportMessage } from "../queries/useSupportMessages";

const auth = useAuthStore();
const adminInfo = computed(() => {
  const meta = (auth.user?.user_metadata ?? {}) as Record<string, any>;
  const fullname = typeof meta.fullname === "string" ? meta.fullname : null;
  return {
    id: auth.user?.id ?? "",
    name: fullname && fullname.trim().length > 0 ? fullname : "AI Koçu",
    email: auth.user?.email ?? null,
  };
});

const INBOX_LIMIT = 400;
const {
  data: inboxData,
  isLoading: inboxLoading,
  isError: inboxError,
  error: inboxProblem,
} = useSupportInbox(INBOX_LIMIT);
useSupportInboxRealtime(INBOX_LIMIT);

const STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  started: "Yanıtlandı",
  closed: "Kapalı",
};
const statusLabel = (status?: string | null) =>
  STATUS_LABELS[status ?? "pending"] ?? STATUS_LABELS.pending;
const statusBadgeClass = (status?: string | null) => {
  switch (status) {
    case "started":
      return "bg-emerald-100 text-emerald-600";
    case "closed":
      return "bg-slate-100 text-slate-500";
    default:
      return "bg-amber-100 text-amber-600";
  }
};

type ThreadMeta = {
  key: string;
  conversationId: string | null;
  participantId: string;
  participantName: string;
  participantEmail: string | null;
  lastCreatedAt: string;
  lastDirection: string;
  preview: string;
  status: string;
};

const threads = computed<ThreadMeta[]>(() => {
  const adminId = adminInfo.value.id;
  const rows = inboxData.value ?? [];
  const grouped = new Map<string, SupportMessage[]>();

  rows.forEach((row) => {
    const senderId = row.sender_id;
    const receiverId = row.user_id;
    const participantId =
      senderId && senderId !== adminId ? senderId : receiverId && receiverId !== adminId ? receiverId : null;

    if (!participantId) return;

    const key = row.conversation_id ?? `legacy-${participantId}`;
    const bucket = grouped.get(key) ?? [];
    bucket.push(row);
    grouped.set(key, bucket);
  });

  const threadsList: ThreadMeta[] = [];
  Array.from(grouped.entries()).forEach(([key, entries]) => {
    const sorted = [...entries].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const last = sorted[0]!;
    const participantId =
      last.sender_id && last.sender_id !== adminId
        ? last.sender_id
        : last.user_id && last.user_id !== adminId
        ? last.user_id
        : sorted.find((m) => m.sender_id && m.sender_id !== adminId)?.sender_id ||
          sorted.find((m) => m.user_id && m.user_id !== adminId)?.user_id ||
          "";

    if (!participantId) return;
    const defaultName = `Kullanıcı ${participantId.slice(0, 6)}`;

    threadsList.push({
      key,
      conversationId: last.conversation_id,
      participantId,
      participantName: defaultName,
      participantEmail: null,
      lastCreatedAt: last.created_at,
      lastDirection: last.sender_id === adminId ? "outgoing" : "incoming",
      preview: last.body ?? "",
      status: last.status ?? "pending",
    });
  });

  return threadsList.sort(
    (a, b) =>
      new Date(b.lastCreatedAt).getTime() - new Date(a.lastCreatedAt).getTime()
  );
});

const selectedThreadKey = ref<string | null>(null);

watch(
  threads,
  (list) => {
    if (!list.length) {
      selectedThreadKey.value = null;
      return;
    }
    if (!selectedThreadKey.value || !list.some((t) => t.key === selectedThreadKey.value)) {
      selectedThreadKey.value = list[0]!.key;
    }
  },
  { immediate: true }
);

const activeThread = computed(() =>
  threads.value.find((t) => t.key === selectedThreadKey.value) ?? null
);

const {
  data: conversation,
  isLoading: convoLoading,
  isError: convoError,
  error: convoProblem,
  refetch: refetchConversation,
} = useSupportMessages(
  computed(() => activeThread.value?.participantId ?? null),
  computed(() => activeThread.value?.conversationId ?? null)
);

useSupportRealtime(computed(() => activeThread.value?.participantId ?? null));

const messages = computed(() => conversation.value ?? []);
const replyText = ref("");
const sendMut = useInsertSupportMessage();
const setStatusMut = useSetConversationStatus();
const conversationRef = ref<HTMLElement | null>(null);

const canReply = computed(
  () =>
    !!activeThread.value?.participantId &&
    replyText.value.trim().length > 1 &&
    !sendMut.isPending.value
);

const activeThreadStatus = computed(() => activeThread.value?.status ?? "pending");
const canCloseThread = computed(
  () =>
    !!activeThread.value?.conversationId &&
    activeThreadStatus.value !== "closed" &&
    !setStatusMut.isPending.value
);

function closeConversation() {
  const conversationId = activeThread.value?.conversationId;
  if (!conversationId) return;
  setStatusMut.mutate(
    { conversationId, status: "closed" },
    {
      onSettled: () => {
        void refetchConversation();
      },
    }
  );
}

function isIncoming(msg: SupportMessage) {
  const adminId = adminInfo.value.id;
  if (msg.sender_id) {
    return msg.sender_id !== adminId;
  }
  return true;
}

function authorLabel(msg: SupportMessage) {
  const adminId = adminInfo.value.id;
  if (msg.sender_id === adminId) {
    return adminInfo.value.name ?? "AI Koçu";
  }
  return "Öğrenci";
}

function selectThread(threadKey: string) {
  if (selectedThreadKey.value === threadKey) return;
  selectedThreadKey.value = threadKey;
  replyText.value = "";
}

function sendReply() {
  const text = replyText.value.trim();
  const receiverId = activeThread.value?.participantId;
  if (!receiverId || !text) return;

  sendMut.mutate(
    {
      receiverId,
      senderId: adminInfo.value.id,
      body: text,
      status: "started",
      title: "Koç Yanıtı",
      conversationId: activeThread.value?.conversationId ?? null,
    },
    {
      onSuccess: () => {
        replyText.value = "";
        scrollConversation();
      },
      onSettled: () => {
        void refetchConversation();
      },
    }
  );
}

function scrollConversation() {
  nextTick(() => {
    if (conversationRef.value) {
      conversationRef.value.scrollTo({
        top: conversationRef.value.scrollHeight,
        behavior: "smooth",
      });
    }
  });
}

watch(messages, () => scrollConversation());
</script>

<template>
  <div class="min-h-screen bg-sky-100 flex flex-col">
    <header>
      <Navbar />
    </header>

    <main class="flex-grow flex items-start justify-center px-4 py-8">
      <div class="w-full max-w-6xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
        <header class="space-y-2">
          <div class="text-center md:text-left space-y-1">
            <h1 class="text-3xl font-bold text-sky-700">📨 Destek Mesajları (Admin)</h1>
            <p class="text-slate-600">
              Öğrencilerden gelen mesajları bildirim altyapısı üzerinden takip edebilir,
              yanıtlayabilirsin.
            </p>
          </div>
          <p v-if="inboxLoading" class="text-sm text-slate-500">
            Mesaj kutusu güncelleniyor…
          </p>
          <p v-else-if="inboxError" class="text-sm text-red-600">
            Hata: {{ (inboxProblem as any)?.message || "Mesaj kutusu alınamadı." }}
          </p>
        </header>

        <div class="grid gap-6 lg:grid-cols-[280px,1fr]">
          <aside class="space-y-3">
            <div class="flex items-center justify-between">
              <h2 class="text-lg font-semibold text-slate-700">Gelen Kutusu</h2>
              <span class="text-xs text-slate-500">
                {{ threads.length }} sohbet
              </span>
            </div>

            <div
              class="rounded-2xl border border-slate-200 bg-slate-50 p-2 max-h-[65vh] overflow-y-auto space-y-2"
            >
              <p v-if="!threads.length && !inboxLoading" class="text-sm text-slate-500 text-center">
                Henüz destek mesajı yok.
              </p>

              <button
                v-for="thread in threads"
                :key="thread.key"
                type="button"
                class="w-full text-left rounded-xl px-3 py-2 transition flex flex-col gap-1"
                :class="
                  thread.key === selectedThreadKey
                    ? 'bg-white shadow border border-sky-200'
                    : 'hover:bg-white'
                "
                @click="selectThread(thread.key)"
              >
                <div class="flex items-center justify-between gap-2">
                  <div>
                    <p class="font-semibold text-slate-700">
                      {{ thread.participantName }}
                    </p>
                    <p v-if="thread.participantEmail" class="text-xs text-slate-500">
                      {{ thread.participantEmail }}
                    </p>
                    <div class="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                      <span class="font-semibold">Durum:</span>
                      <span
                        :class="[
                          'inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold text-xs',
                          statusBadgeClass(thread.status),
                        ]"
                      >
                        {{ statusLabel(thread.status) }}
                      </span>
                    </div>
                  </div>
                  <span
                    v-if="thread.lastDirection === 'incoming'"
                    class="text-[11px] font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full"
                  >
                    Yeni
                  </span>
                </div>
                <p class="text-xs text-slate-600 line-clamp-2">
                  {{ thread.preview }}
                </p>
                <p class="text-[11px] text-slate-400">
                  {{ new Date(thread.lastCreatedAt).toLocaleString("tr-TR", {
                    hour: "2-digit",
                    minute: "2-digit",
                    day: "2-digit",
                    month: "short",
                  }) }}
                </p>
              </button>
            </div>
          </aside>

          <section class="rounded-3xl border border-slate-200 bg-slate-50/80 p-4 flex flex-col gap-4">
            <div v-if="!selectedThreadKey" class="text-center text-slate-500 py-12">
              Bir sohbet seçerek detayları görüntüleyebilirsin.
            </div>

            <div v-else class="flex flex-col gap-4 flex-1">
              <header class="flex flex-col gap-1">
                <h2 class="text-xl font-semibold text-slate-700">
                  {{ activeThread?.participantName || "Bilinmeyen Öğrenci" }}
                </h2>
                <p v-if="activeThread?.participantEmail" class="text-sm text-slate-500">
                  {{ activeThread.participantEmail }}
                </p>
              </header>

              <div class="flex flex-wrap items-center gap-3">
                <span class="text-sm text-slate-500 flex items-center gap-2">
                  Durum:
                  <span
                    :class="[
                      'text-[11px] font-semibold px-2 py-0.5 rounded-full',
                      statusBadgeClass(activeThreadStatus),
                    ]"
                  >
                    {{ statusLabel(activeThreadStatus) }}
                  </span>
                </span>
                <button
                  type="button"
                  class="rounded-full px-4 py-1.5 text-xs font-semibold border transition disabled:opacity-60"
                  :class="canCloseThread
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:border-emerald-300'
                    : 'border-slate-200 bg-white text-slate-400 cursor-not-allowed'"
                  :disabled="!canCloseThread"
                  @click="closeConversation"
                >
                  {{ setStatusMut.isPending ? "Kapatılıyor…" : "Sohbeti Kapat" }}
                </button>
              </div>

              <div
                ref="conversationRef"
                class="flex-1 rounded-2xl bg-white border border-slate-100 p-4 overflow-y-auto space-y-4 min-h-[320px]"
              >
                <div
                  v-if="convoLoading"
                  class="rounded-xl border border-sky-100 bg-sky-50 text-sky-700 px-4 py-3 text-center"
                >
                  Sohbet yükleniyor…
                </div>

                <div
                  v-else-if="convoError"
                  class="rounded-xl border border-red-200 bg-red-50 text-red-700 px-4 py-3 text-center"
                >
                  Hata: {{ (convoProblem as any)?.message || "Sohbet alınamadı." }}
                </div>

                <div v-else-if="!messages.length" class="text-center text-slate-500 py-6">
                  Bu öğrenciyle henüz mesajlaşılmamış.
                </div>

                <div v-else class="space-y-3">
                  <article
                    v-for="msg in messages"
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
                      <p class="text-[11px] md:text-xs mt-2 opacity-80">
                        {{ authorLabel(msg) }} •
                        {{ new Date(msg.created_at).toLocaleString("tr-TR", {
                          hour: "2-digit",
                          minute: "2-digit",
                          day: "2-digit",
                          month: "short",
                        }) }}
                      </p>
                    </div>
                  </article>
                </div>
              </div>

              <div class="space-y-3">
                <textarea
                  v-model="replyText"
                  class="w-full rounded-2xl border border-slate-200 px-4 py-3 shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-200 min-h-[120px]"
                  placeholder="Öğrenciye vereceğin yanıtı yaz…"
                ></textarea>

                <div class="flex flex-wrap items-center gap-3 justify-end">
                  <p v-if="sendMut.isError.value" class="text-sm text-red-600">
                    {{ (sendMut.error.value as any)?.message || "Yanıt gönderilemedi." }}
                  </p>
                  <button
                    type="button"
                    class="rounded-full px-6 py-2 font-semibold text-white bg-sky-600 hover:bg-sky-700 disabled:opacity-60 disabled:cursor-not-allowed"
                    :disabled="!canReply"
                    @click="sendReply"
                  >
                    {{ sendMut.isPending.value ? "Gönderiliyor…" : "Yanıtı Gönder" }}
                  </button>
                </div>
              </div>
            </div>
          </section>
        </div>
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
