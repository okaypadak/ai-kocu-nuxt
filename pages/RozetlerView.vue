<!-- src/views/RozetlerView.vue -->
<script setup lang="ts">
import { computed, ref } from "vue";
import { useAuthStore } from "../stores/auth.store";
import Navbar from "../components/Navbar.vue";
import {
  useBadgesCatalog,
  useUserBadges,
  useRealtimeUserBadges,
  sortLevels,
  levelPretty,
  levelColor,
} from "../queries/useBadges";

const auth = useAuthStore();
const uid = computed(() => auth.user?.id ?? null); // store'unda hangisi varsa

// queries
const { data: allBadges, isLoading: catLoading } = useBadgesCatalog();
const { data: mine, isLoading: mineLoading } = useUserBadges(uid.value ?? undefined);
useRealtimeUserBadges(uid.value ?? undefined);

// filtre
const onlyEarned = ref(false);
const search = ref("");

// haritalar
const mineKey = computed(
  () => new Map((mine?.value ?? []).map((b) => [`${b.badge_code}:${b.level}`, b]))
);
const mineByCode = computed(() => {
  const map = new Map<string, { code: string; levels: Set<string>; latestAt?: string }>();
  for (const b of mine?.value ?? []) {
    const rec = map.get(b.badge_code) ?? {
      code: b.badge_code,
      levels: new Set<string>(),
    };
    rec.levels.add(b.level);
    if (!rec.latestAt || new Date(b.earned_at) > new Date(rec.latestAt))
      rec.latestAt = b.earned_at;
    map.set(b.badge_code, rec);
  }
  return map;
});

const list = computed(() => {
  const q = (search.value || "").toLowerCase().trim();
  let arr = allBadges.value ?? [];
  if (q)
    arr = arr.filter(
      (b) =>
        b.code.toLowerCase().includes(q) ||
        (b.title?.toLowerCase()?.includes(q) ?? false) ||
        (b.description?.toLowerCase()?.includes(q) ?? false)
    );
  if (onlyEarned.value) {
    arr = arr.filter((b) => mineByCode.value.has(b.code));
  }
  return arr;
});

function isEarned(code: string, level: string) {
  return mineKey.value.has(`${code}:${level}`);
}

function earnedText(code: string) {
  const rec = mineByCode.value.get(code);
  if (!rec?.latestAt) return "";
  const d = new Date(rec.latestAt);
  return `Son kazanım: ${d.toLocaleDateString("tr-TR")} ${d.toLocaleTimeString("tr-TR", {
    hour: "2-digit",
    minute: "2-digit",
  })}`;
}
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-sky-100 to-white flex flex-col px-4">
    <!-- Navbar -->
    <header>
      <Navbar />
    </header>

    <main class="flex-grow px-4 py-6 md:py-8 flex justify-center">
      <div class="w-full max-w-6xl space-y-6">
        <!-- Başlık -->
        <div class="bg-white rounded-3xl shadow-2xl p-6 md:p-8 flex flex-col gap-3">
          <h1 class="text-3xl font-extrabold text-sky-700">🏅 Rozetlerim</h1>
          <p class="text-slate-600">
            Başarılarını kutluyoruz! Çalıştıkça yeni rozetler açılır, seviyelerini
            yükseltirsin. Devam! ✨
          </p>

          <!-- filtre -->
          <div
            class="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between mt-2"
          >
            <div class="flex items-center gap-2">
              <input
                v-model="search"
                type="text"
                placeholder="Rozet ara…"
                class="rounded-xl border border-slate-200 px-3 py-2 text-sm bg-white w-64"
              />
              <label class="inline-flex items-center gap-2 text-sm text-slate-700">
                <input type="checkbox" v-model="onlyEarned" />
                Sadece kazandıklarım
              </label>
            </div>
            <div class="text-xs text-slate-500">
              <span v-if="catLoading || mineLoading">Yükleniyor…</span>
              <span v-else>{{ list.length }} rozet</span>
            </div>
          </div>
        </div>

        <!-- Grid -->
        <div class="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
          <div
            v-for="b in list"
            :key="b.code"
            class="group relative overflow-hidden rounded-2xl border border-sky-100 bg-white shadow hover:shadow-lg transition"
          >
            <div class="p-5 flex gap-4">
              <!-- Emoji / simge -->
              <div
                class="shrink-0 w-14 h-14 rounded-2xl bg-sky-50 border border-sky-100 flex items-center justify-center text-2xl select-none"
              >
                <span v-if="b.emoji">{{ b.emoji }}</span>
                <span v-else>🎖️</span>
              </div>

              <div class="min-w-0">
                <h3 class="text-lg font-bold text-slate-800 truncate">{{ b.title }}</h3>
                <p class="text-sm text-slate-600 line-clamp-2">{{ b.description }}</p>

                <!-- Seviyeler -->
                <div class="mt-3 flex flex-wrap gap-2">
                  <span
                    v-for="lvl in sortLevels(b.levels)"
                    :key="lvl"
                    class="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold border"
                    :class="[
                      isEarned(b.code, lvl)
                        ? 'border-transparent text-slate-900'
                        : 'border-slate-200 text-slate-500',
                      isEarned(b.code, lvl) ? levelColor(lvl) : 'bg-slate-100',
                    ]"
                    :title="levelPretty(lvl)"
                  >
                    {{ levelPretty(lvl) }}
                    <span v-if="isEarned(b.code, lvl)">✔</span>
                    <span v-else>🔒</span>
                  </span>
                </div>

                <!-- Alt bilgi -->
                <p class="mt-3 text-xs text-sky-600" v-if="mineByCode.get(b.code)">
                  {{ earnedText(b.code) }}
                </p>
              </div>
            </div>

            <!-- Köşe süsü -->
            <div
              class="absolute -right-10 -top-10 w-24 h-24 bg-sky-100 rounded-full opacity-70"
            ></div>
          </div>
        </div>

        <!-- Boş durum -->
        <div
          v-if="!catLoading && !mineLoading && list.length === 0"
          class="text-center bg-white rounded-3xl shadow p-10 border border-slate-100"
        >
          <div class="text-5xl mb-2">🌟</div>
          <p class="text-slate-700 font-semibold">Henüz gösterilecek rozet bulunamadı.</p>
          <p class="text-slate-500 text-sm mt-1">Çalıştıkça burası ışıl ışıl olacak!</p>
        </div>
      </div>
    </main>
  </div>
</template>
