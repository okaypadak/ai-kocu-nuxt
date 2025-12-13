<!-- src/views/YouTubePlaylistsView.vue -->
<script setup lang="ts">
import { ref, computed, watch, nextTick, type WatchStopHandle } from "vue";
import Navbar from "../components/Navbar.vue";
import {
  useSavedPlaylists,
  useFetchPlaylistFromYoutube,
  useSavePlaylist,
  useLoadPlaylistFromDb,
} from "../queries/useYoutubePlaylists";
import type { YoutubeVideo, SavedPlaylist } from "../api/youtubePlaylists";
import { useAuthStore } from "../stores/auth.store";
import {
  useCurricula,
  useSections,
  useLessons,
  useTopics,
} from "../queries/useCurricula";
import type { Lesson } from "../api/curriculum";
import { useToast } from "vue-toastification";

type TabKey = "new" | "saved";
const active = ref<TabKey>("new");
const isActive = (t: TabKey) => active.value === t;
const setTab = (t: TabKey) => (active.value = t);

// Stores
const auth = useAuthStore();
const toast = useToast();

// Queries
const { data: curricula, isLoading: curriculaLoading } = useCurricula();

// Form state
const playlistId = ref("");
const teacherName = ref("");

const selectedCurriculumId = ref(auth.preferredCurriculumId ?? "");
const sectionCode = ref("");
const lessonId = ref<number | null>(null);

watch(
  () => auth.preferredCurriculumId,
  (val) => {
    if (!selectedCurriculumId.value && val) {
      selectedCurriculumId.value = val;
    }
  }
);

const { data: sections } = useSections(() =>
  selectedCurriculumId.value || undefined
);
const selectedSection = computed(() =>
  (sections.value ?? []).find((s) => s.code === sectionCode.value) ?? null
);

const { data: lessons } = useLessons(() => selectedSection.value?.id);

const lessonIdModel = computed({
  get: () => lessonId.value ?? "",
  set: (value: string | number | null) => {
    if (value === "" || value === null) {
      lessonId.value = null;
      return;
    }
    const numeric = typeof value === "number" ? value : Number(value);
    lessonId.value = Number.isNaN(numeric) ? null : numeric;
  },
});

const selectedLesson = computed<Lesson | null>(() =>
  (lessons.value ?? []).find((l) => l.id === lessonId.value) ?? null
);

const { data: lessonTopics } = useTopics(() => selectedLesson.value?.id);
const topics = computed(() => lessonTopics.value ?? []);

// Videolar (tablo)
const videos = ref<YoutubeVideo[]>([]);
const pauseLessonReset = ref(false);
const sortedVideos = computed(() => {
  return [...videos.value].sort((a, b) => {
    const ao = typeof a.sortOrder === "number" ? a.sortOrder : Number.POSITIVE_INFINITY;
    const bo = typeof b.sortOrder === "number" ? b.sortOrder : Number.POSITIVE_INFINITY;
    if (ao !== bo) return ao - bo;
    return (a.title || "").localeCompare(b.title || "", "tr", { sensitivity: "base" });
  });
});

const resetVideoSelections = () => {
  if (!videos.value.length) return;
  videos.value = videos.value.map((v) => ({
    ...v,
    topicId: undefined,
    code: "",
  }));
};

watch(selectedCurriculumId, () => {
  sectionCode.value = "";
  lessonId.value = null;
});

watch(selectedSection, () => {
  lessonId.value = null;
});

watch(lessons, (rows) => {
  if (!rows?.length) {
    lessonId.value = null;
    return;
  }
  if (!rows.find((l) => l.id === lessonId.value)) {
    lessonId.value = null;
  }
});

watch(
  selectedLesson,
  (lesson, prev) => {
    if (pauseLessonReset.value) return;
    if (lesson) {
      if (!prev || prev.id !== lesson.id) {
        resetVideoSelections();
      }
      return;
    }

    if (prev) {
      resetVideoSelections();
    }
  },
  { flush: "post" }
);

const isLoading = ref(false);

// Saved list
const {
  data: saved,
  isLoading: loadingSaved,
  refetch: refetchSaved,
} = useSavedPlaylists();

// Mutations
const fetchMut = useFetchPlaylistFromYoutube();
const saveMut = useSavePlaylist();
const loadDbMut = useLoadPlaylistFromDb();

function onTopicSelect(row: YoutubeVideo, topicId: string) {
  const t = topics.value.find(
    (x) => x.uuid === topicId || x.id === topicId
  );
  videos.value = videos.value.map((v) =>
    v.id === row.id ? { ...v, topicId, code: t?.uuid ?? "" } : v
  );
}

async function fetchFromYoutube() {
  const pid = playlistId.value.trim();
  if (!pid) {
    toast.warning("Playlist ID gir");
    return;
  }
  isLoading.value = true;
  try {
    const { prefilled } = await fetchMut.mutateAsync({ playlistId: pid });
    videos.value = prefilled;
  } catch (e: any) {
    console.error(e);
    toast.error(e?.message ?? "Videolar alınamadı.");
  } finally {
    isLoading.value = false;
  }
}

async function saveAll() {
  if (!selectedCurriculumId.value) {
    toast.warning("Müfredat seç");
    return;
  }
  if (!selectedSection.value) {
    toast.warning("Bölüm seç");
    return;
  }
  if (!selectedLesson.value) {
    toast.warning("Ders seç");
    return;
  }
  if (!teacherName.value.trim()) {
    toast.warning("Öğretmen adı gir");
    return;
  }
  if (!videos.value.length) {
    toast.warning("Kaydedilecek video yok");
    return;
  }

  try {
    await saveMut.mutateAsync({
      playlistId: playlistId.value.trim(),
      teacher: teacherName.value.trim(),
      curriculumId: selectedCurriculumId.value.trim() || null,
      sectionId: selectedSection.value?.id ?? null,
      lessonId: selectedLesson.value?.id ?? null,
      videos: videos.value,
    });
    toast.success("Kaydedildi / güncellendi.");
    refetchSaved();
  } catch (e: any) {
    console.error(e);
    toast.error(e?.message ?? "Kaydedilemedi.");
  }
}

async function loadFromDb(playlist: SavedPlaylist) {
  pauseLessonReset.value = true;
  videos.value = [];
  playlistId.value = playlist.id;
  selectedCurriculumId.value = playlist.curriculum_id ?? "";
  sectionCode.value = playlist.section?.code ?? "";
  await nextTick();
  lessonId.value = playlist.lesson?.id ?? null;
  await waitForLessonMatch(playlist.lesson?.id ?? null);
  teacherName.value = playlist.teacher ?? "";
  isLoading.value = true;
  try {
    const list = await loadDbMut.mutateAsync(playlist.id);
    videos.value = list;
    active.value = "new";
  } catch (e: any) {
    console.error(e);
    toast.error(e?.message ?? "Playlist yüklenemedi.");
  } finally {
    isLoading.value = false;
    pauseLessonReset.value = false;
  }
}

function waitForLessonMatch(targetId: number | null, timeout = 2000) {
  if ((selectedLesson.value?.id ?? null) === targetId) {
    return Promise.resolve();
  }

  return new Promise<void>((resolve) => {
    let resolved = false;
    let stop: WatchStopHandle = () => {};
    let timer: ReturnType<typeof setTimeout>;

    const cleanup = () => {
      if (resolved) return;
      resolved = true;
      clearTimeout(timer);
      stop();
      resolve();
    };

    stop = watch(
      selectedLesson,
      (lesson) => {
        if ((lesson?.id ?? null) === targetId) {
          cleanup();
        }
      },
      { immediate: true }
    );

    timer = setTimeout(cleanup, timeout);
  });
}
</script>

<template>
  <div class="min-h-screen bg-sky-100 flex flex-col px-4">
    <header class="z-10"><Navbar /></header>

    <main class="flex-grow flex justify-center px-4 py-6 md:py-8">
      <div class="w-full max-w-6xl">
        <!-- Tabs -->
        <div class="mb-4 flex gap-2">
          <button
            class="px-4 py-2 rounded-full text-sm font-semibold border transition"
            :class="
              isActive('new')
                ? 'bg-white text-sky-700 border-sky-300'
                : 'text-slate-600 border-slate-200 hover:bg-slate-50'
            "
            @click="setTab('new')"
          >
            Yeni Playlist
          </button>
          <button
            class="px-4 py-2 rounded-full text-sm font-semibold border transition"
            :class="
              isActive('saved')
                ? 'bg-white text-sky-700 border-sky-300'
                : 'text-slate-600 border-slate-200 hover:bg-slate-50'
            "
            @click="setTab('saved')"
          >
            Kayıtlı Playlisler
          </button>
        </div>

        <!-- Panels -->
        <div v-if="isActive('new')" class="bg-white rounded-3xl shadow-2xl p-6 space-y-6">
          <!-- Üst form -->
          <div class="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
              <span>Playlist ID</span>
              <input
                type="text"
                v-model="playlistId"
                placeholder="PL-..."
                class="border border-sky-200 rounded-xl px-3 py-2 text-sm focus:outline-sky-500"
              />
            </label>

            <label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
              <span>Müfredat</span>
              <select
                v-model="selectedCurriculumId"
                class="border border-sky-200 rounded-xl px-3 py-2 text-sm focus:outline-sky-500 disabled:bg-slate-200"
                :disabled="curriculaLoading"
              >
                <option value="">Seçiniz</option>
                <option
                  v-for="c in (curricula ?? [])"
                  :key="c.id"
                  :value="c.id"
                >
                  {{ [c.exam, c.version].filter(Boolean).join(' - ') || c.id }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
              <span>Bölüm</span>
              <select
                v-model="sectionCode"
                class="border border-sky-200 rounded-xl px-3 py-2 text-sm focus:outline-sky-500 disabled:bg-slate-200"
                :disabled="!selectedCurriculumId || !(sections?.length)"
              >
                <option value="">Seçiniz</option>
                <option
                  v-for="section in (sections ?? [])"
                  :key="section.id"
                  :value="section.code"
                >
                  {{ section.name }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
              <span>Ders</span>
              <select
                v-model="lessonIdModel"
                class="border border-sky-200 rounded-xl px-3 py-2 text-sm focus:outline-sky-500 disabled:bg-slate-200"
                :disabled="!selectedSection || !(lessons?.length)"
              >
                <option value="">Seçiniz</option>
                <option v-for="lesson in (lessons ?? [])" :key="lesson.id" :value="lesson.id">
                  {{ lesson.name }}
                </option>
              </select>
            </label>

            <label class="flex flex-col gap-1 text-sm font-medium text-slate-700">
              <span>Öğretmen</span>
              <input
                type="text"
                v-model="teacherName"
                placeholder="Öğretmen adı"
                class="border border-sky-200 rounded-xl px-3 py-2 text-sm focus:outline-sky-500"
              />
            </label>

            <div class="flex items-end">
              <button
                @click="fetchFromYoutube"
                class="bg-sky-600 hover:bg-sky-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow disabled:opacity-60 w-full"
                :disabled="isLoading"
              >
                {{ isLoading ? "Yükleniyor…" : "Getir" }}
              </button>
            </div>
          </div>

          <!-- Liste -->
          <div v-if="isLoading" class="text-center text-sky-600 font-medium py-8">
            Yükleniyor...
          </div>
          <template v-else>
            <div
              v-if="videos.length"
              class="overflow-x-auto rounded-xl border border-sky-100"
            >
              <table class="w-full text-sm">
                <thead class="bg-sky-100 text-sky-800 font-medium">
                  <tr>
                    <th class="p-2 w-10">#</th>
                    <th class="p-2 w-20">Sıra</th>
                    <th class="p-2 text-left">Video Adı</th>
                    <th class="p-2 w-24">Süre</th>
                    <th class="p-2 w-20">URL</th>
                    <th class="p-2 w-[22rem]">Konu</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="(v, i) in sortedVideos" :key="v.id" class="hover:bg-sky-50">
                    <td class="p-2 text-center">{{ i + 1 }}</td>
                    <td class="p-2">
                      <input
                        type="number"
                        min="1"
                        step="1"
                        v-model.number="v.sortOrder"
                        class="border border-sky-200 rounded-lg px-2 py-1 w-full text-sm focus:outline-sky-500"
                        placeholder="—"
                      />
                    </td>
                    <td class="p-2">{{ v.title }}</td>
                    <td class="p-2 text-center">{{ v.durationMinutes.toFixed(1) }}</td>
                    <td class="p-2 text-center">
                      <a
                        :href="v.url"
                        target="_blank"
                        class="text-sky-600 underline hover:text-sky-800"
                        >İzle</a
                      >
                    </td>
                    <td class="p-2">
                      <select
                        :value="v.topicId || ''"
                        @change="onTopicSelect(v, ($event.target as HTMLSelectElement).value)"
                        class="border border-sky-200 rounded-lg px-2 py-1 w-full text-sm focus:outline-sky-500"
                        :disabled="!topics.length"
                      >
                        <option value="" disabled>
                          {{ topics.length ? "KONU SEÇ" : "Önce ders seçin" }}
                        </option>
                        <option v-for="t in topics" :key="t.uuid ?? t.id" :value="t.uuid">
                          {{ t.title }}
                        </option>
                      </select>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div v-else class="text-slate-500 text-sm py-6 text-center">
              Henüz veri yok.
            </div>

            <div class="flex justify-end mt-4" v-if="videos.length">
              <button
                @click="saveAll"
                class="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl text-sm font-medium shadow disabled:opacity-60"
                :disabled="saveMut.isPending.value"
              >
                {{ saveMut.isPending.value ? "Kaydediliyor…" : "Kaydet" }}
              </button>
            </div>
          </template>
        </div>

        <div v-else class="bg-white rounded-3xl shadow-2xl p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-lg font-semibold text-sky-800">Kayıtlı Playlisler</h2>
            <button
              @click="refetchSaved()"
              class="border border-sky-300 text-sky-700 hover:bg-sky-50 px-3 py-1.5 rounded-lg text-sm"
            >
              Yenile
            </button>
          </div>

          <div v-if="loadingSaved" class="text-center text-sky-600 font-medium py-6">
            Liste yükleniyor...
          </div>

          <template v-else>
            <div
              v-if="(saved ?? []).length"
              class="overflow-x-auto rounded-xl border border-sky-100"
            >
              <table class="w-full text-sm">
                <thead class="bg-sky-100 text-sky-800 font-medium">
                  <tr>
                    <th class="p-2">Playlist ID</th>
                    <th class="p-2">Müfredat</th>
                    <th class="p-2">Bölüm</th>
                    <th class="p-2">Ders</th>
                    <th class="p-2">Öğretmen</th>
                    <th class="p-2 w-28 text-center">İşlem</th>
                  </tr>
                </thead>
                <tbody>
                  <tr v-for="p in saved ?? []" :key="p.id" class="hover:bg-sky-50">
                    <td class="p-2 font-medium">{{ p.id }}</td>
                    <td class="p-2">
                      {{ p.curriculum_id || "—" }}
                    </td>
                    <td class="p-2">
                      {{ p.section?.name || p.section?.code || "—" }}
                    </td>
                    <td class="p-2">
                      {{ p.lesson?.name || p.lesson?.code || "—" }}
                    </td>
                    <td class="p-2">{{ p.teacher || "—" }}</td>
                    <td class="p-2 text-center">
                      <button
                        @click="loadFromDb(p)"
                        class="bg-sky-600 hover:bg-sky-700 text-white px-3 py-1.5 rounded-lg text-sm"
                      >
                        Getir
                      </button>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div v-else class="text-slate-500 text-sm py-6 text-center">
              Kayıtlı playlist bulunamadı.
            </div>
          </template>
        </div>
      </div>
    </main>
  </div>
</template>
