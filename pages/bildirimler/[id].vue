<!-- src/views/BildirimlerDetailView.vue -->
<script setup lang="ts">
import { computed } from "vue";
import { useRoute, useRouter } from "vue-router";
import Navbar from "../../components/Navbar.vue";
import {
  useNotificationById,
  useMarkRead,
  useDeleteNotification,
} from "../../queries/useNotifications";

const route = useRoute();
const router = useRouter();

const id = computed(() => String(route.params.id || ""));
const { data: notif, isLoading, isError, error, refetch } = useNotificationById(id);
const markMut = useMarkRead();
const delMut = useDeleteNotification();

function goBack() {
  router.back();
}
function markAsRead() {
  if (!notif?.value?.id || markMut.isPending.value) return;
  markMut.mutate(notif.value.id, { onSuccess: () => refetch() });
}
function removeItem() {
  if (!notif?.value?.id || delMut.isPending.value) return;
  delMut.mutate(notif.value.id, { onSuccess: () => router.push("/bildirimler") });
}
function goAction(url?: string | null, e?: Event) {
  e?.stopPropagation();
  if (!url) return;
  window.open(url, "_blank");
}
</script>

<template>
  <div class="min-h-screen bg-sky-100 flex flex-col">
    <header>
      <Navbar />
    </header>

    <main class="flex-grow flex items-start justify-center py-8">
      <div class="w-full max-w-6xl bg-white rounded-3xl shadow-2xl p-6 md:p-8 space-y-6">
        <header class="space-y-4">
          <div class="space-y-1 text-center md:text-left">
            <h1 class="text-3xl font-bold text-sky-700">🔔 Bildirim Detayı</h1>
            <p class="text-slate-600">
              Bildirim içeriğini inceleyebilir, okundu olarak işaretleyebilir veya
              silebilirsin.
            </p>
          </div>

          <div class="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div class="flex justify-center md:justify-start">
              <button
                class="rounded-full border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                type="button"
                @click="goBack"
              >
                ← Geri
              </button>
            </div>

            <div class="flex flex-wrap items-center justify-center gap-2 md:justify-end">
              <button
                v-if="notif && !notif.read_at"
                class="rounded-full border border-emerald-200 px-4 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                type="button"
                :disabled="markMut.isPending.value"
                @click="markAsRead"
              >
                {{ markMut.isPending.value ? "İşaretleniyor…" : "Okundu işaretle" }}
              </button>

              <button
                class="rounded-full border border-red-200 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50 disabled:opacity-60"
                type="button"
                :disabled="delMut.isPending.value"
                @click="removeItem"
              >
                {{ delMut.isPending.value ? "Siliniyor…" : "Sil" }}
              </button>
            </div>
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

          <article
            v-else-if="notif"
            class="rounded-2xl border border-slate-200 bg-white p-5 space-y-3"
          >
            <div class="flex items-center gap-2">
              <span
                class="text-xs px-2 py-0.5 rounded-full"
                :class="{
                  'bg-slate-100 text-slate-700': notif.level === 'info',
                  'bg-emerald-100 text-emerald-700': notif.level === 'success',
                  'bg-amber-100 text-amber-700': notif.level === 'warning',
                  'bg-red-100 text-red-700': notif.level === 'error',
                }"
                >{{ notif.type }}</span
              >
              <h1 class="text-xl md:text-2xl font-bold text-slate-800">
                {{ notif.title }}
              </h1>
            </div>

            <div v-if="notif.body" class="text-slate-700" v-html="notif.body"></div>

            <div class="flex items-center justify-between text-xs text-slate-500">
              <span
                >Oluşturulma:
                {{ new Date(notif.created_at).toLocaleString("tr-TR") }}</span
              >
              <span v-if="notif.read_at"
                >Okundu: {{ new Date(notif.read_at).toLocaleString("tr-TR") }}</span
              >
            </div>

            <div class="pt-2">
              <button
                v-if="notif.action_url"
                class="rounded-md border border-sky-200 px-3 py-1.5 text-sm font-semibold text-sky-700 hover:bg-sky-50"
                type="button"
                @click="goAction(notif.action_url, $event)"
              >
                Git
              </button>
            </div>
          </article>

          <div
            v-else
            class="rounded-2xl border border-amber-200 bg-amber-50 text-amber-700 px-4 py-6"
          >
            Kayıt bulunamadı.
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
