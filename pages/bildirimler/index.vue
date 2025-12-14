<!-- src/views/BildirimlerView.vue -->
<script setup lang="ts">
import { ref, computed, watch } from "vue";
import Navbar from "../../components/Navbar.vue";
import {
  useNotificationsList,
  useUnreadCount,
  useMarkAsRead,
  useMarkAllAsRead,
  useNotificationsRealtime,
} from "../../queries/useNotifications";
import { useRouter } from "vue-router";
import { useAuthStore } from "../../stores/auth.store";

const router = useRouter();
const auth = useAuthStore();
const userId = auth.userId;

// filtre / sayfalama
const onlyUnread = ref(false);
const cursor = ref<string | null>(null);
const limit = 50;

const searchTitle = ref("");
const searchBody = ref("");
const onlyAi = ref(false);

const listFilters = computed(() => ({
  limit,
  onlyUnread: onlyUnread.value,
  cursor: cursor.value,
  searchTitle: searchTitle.value.trim(),
  searchBody: searchBody.value.trim(),
  onlyAi: onlyAi.value,
}));

const { data: listResp, isLoading, isError, error } = useNotificationsList(
  userId,
  listFilters
);

const items = computed(() => listResp?.value?.items ?? []);
const nextCursor = computed(() => listResp?.value?.nextCursor ?? null);

const { data: unreadCount } = useUnreadCount(userId);
const markOneMut = useMarkAsRead();
const markAllMut = useMarkAllAsRead(userId);

// realtime: yeni INSERT geldiğinde en güncel sayfayı göstermek için cursor'u sıfırla
useNotificationsRealtime(userId, {
  onEvent: (evt) => {
    if (evt === "INSERT" || evt === "DELETE") {
      cursor.value = null;
    }
  },
});

// actions
function toggleUnread() {
  onlyUnread.value = !onlyUnread.value;
  cursor.value = null;
}
function loadMore() {
  if (!nextCursor.value) return;
  cursor.value = nextCursor.value;
}
function goDetail(id: string) {
  router.push(`/bildirimler/${id}`);
}
function onMarkOne(id: string, e?: Event) {
  e?.stopPropagation();
  if (markOneMut.isPending.value) return;
  markOneMut.mutate(id);
}
function onMarkAll() {
  if (!userId.value || markAllMut.isPending.value) return;
  markAllMut.mutate();
}

function toggleAiOnly() {
  onlyAi.value = !onlyAi.value;
  cursor.value = null;
}

watch([searchTitle, searchBody], () => {
  if (cursor.value !== null) cursor.value = null;
});
</script>

<template>
  <div class="min-h-screen bg-sky-100 flex flex-col px-4">
    <header>
      <Navbar />
    </header>

    <main class="flex-grow flex items-start justify-center px-4 py-8">
      <div class="w-full max-w-6xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
        <header class="space-y-4">
          <div class="space-y-1 text-center md:text-left">
            <h1 class="text-3xl font-bold text-sky-700">🔔 Bildirimler</h1>
            <p class="text-slate-600">
              Sana gönderilen mesaj ve uyarıları buradan takip edebilir, yönetebilirsin.
            </p>
          </div>

          <div
            class="flex flex-wrap items-center justify-center gap-3 sm:justify-center md:justify-center"
          >
            <button
              type="button"
              class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
              @click="toggleUnread"
            >
              {{ onlyUnread ? "Tümünü Göster" : "Sadece Okunmamış" }}
            </button>

            <button
              type="button"
              class="flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition"
              :class="
                onlyAi
                  ? 'border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                  : 'border-slate-200 text-slate-700 hover:bg-slate-50'
              "
              @click="toggleAiOnly"
            >
              <span aria-hidden="true">🤖</span>
              <span>{{ onlyAi ? "Tüm Bildirimler" : "Sadece AI Mesajları" }}</span>
            </button>

            <button
              type="button"
              class="rounded-full border border-sky-200 px-4 py-2 text-sm font-semibold text-sky-700 hover:bg-sky-50 disabled:opacity-60"
              :disabled="(unreadCount ?? 0) === 0 || markAllMut.isPending.value"
              @click="onMarkAll"
            >
              {{
                markAllMut.isPending.value ? "İşaretleniyor…" : "Tümünü okundu işaretle"
              }}
              <span
                v-if="(unreadCount ?? 0) > 0"
                class="ml-2 inline-flex items-center justify-center min-w-[20px] h-[20px] px-1 rounded-full bg-red-500 text-white text-[11px]"
              >
                {{ unreadCount }}
              </span>
            </button>
          </div>

          <div class="grid gap-3 md:grid-cols-2">
            <label class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-slate-500">Başlıkta Ara</span>
              <input
                v-model="searchTitle"
                type="search"
                class="w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Bildirim başlığında ara"
              />
            </label>
            <label class="flex flex-col gap-1">
              <span class="text-xs font-semibold text-slate-500">İçerikte Ara</span>
              <input
                v-model="searchBody"
                type="search"
                class="w-full rounded-full border border-slate-200 px-4 py-2 text-sm text-slate-700 shadow-sm focus:border-sky-300 focus:outline-none focus:ring-2 focus:ring-sky-200"
                placeholder="Bildirim içeriğinde ara"
              />
            </label>
          </div>
        </header>

        <section>
          <div
            v-if="isLoading"
            class="rounded-2xl border border-sky-100 bg-sky-50 text-sky-700 px-4 py-6"
          >
            Yükleniyor…
          </div>

          <div
            v-else-if="isError"
            class="rounded-2xl border border-red-200 bg-red-50 text-red-700 px-4 py-6"
          >
            Hata: {{ (error as any)?.message || 'Bilinmeyen hata' }}
          </div>

          <div v-else>
            <div
              v-if="!items.length"
              class="rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 px-4 py-6"
            >
              {{ onlyUnread ? "Okunmamış bildirim yok." : "Bildirim bulunamadı." }}
            </div>

            <ul v-else class="space-y-3">
              <li v-for="n in items" :key="n.id">
                <article
                  class="cursor-pointer rounded-xl border px-4 py-3 transition hover:bg-slate-50"
                  :class="n.read_at ? 'border-slate-200' : 'border-sky-300 bg-sky-50/40'"
                  @click="goDetail(n.id)"
                >
                  <div class="flex items-start justify-between gap-3">
                    <div class="min-w-0">
                      <div class="flex items-center gap-2">
                        <span
                          class="text-xs px-2 py-0.5 rounded-full"
                          :class="{
                            'bg-slate-100 text-slate-700': n.level === 'info',
                            'bg-emerald-100 text-emerald-700': n.level === 'success',
                            'bg-amber-100 text-amber-700': n.level === 'warning',
                            'bg-red-100 text-red-700': n.level === 'error',
                          }"
                          >{{ n.type }}</span
                        >
                        <h3 class="font-semibold text-slate-800 truncate">
                          {{ n.title }}
                        </h3>
                      </div>
                      <div v-if="n.body" class="text-sm text-slate-600 mt-1 line-clamp-2" v-html="n.body"></div>
                      <p class="text-xs text-slate-400 mt-1">
                        {{ new Date(n.created_at).toLocaleString("tr-TR") }}
                      </p>
                    </div>

                    <button
                      v-if="!n.read_at"
                      class="shrink-0 rounded-md border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      @click.stop="onMarkOne(n.id)"
                    >
                      Okundu
                    </button>
                  </div>
                </article>
              </li>
            </ul>

            <div v-if="nextCursor" class="pt-4">
              <button
                class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                @click="loadMore"
              >
                Daha fazla yükle
              </button>
            </div>
          </div>
        </section>
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
