<script setup lang="ts">
import { ref, computed, onMounted, nextTick, onUnmounted, watch } from "vue";
import Navbar from "../components/Navbar.vue";
import { useAuthStore } from "../stores/auth.store";
import {
  useLessonProgress,
  useDailyStudy,
  useOverallProgress,
  useTopicProgress,
} from "../queries/useStatistics";
import Chart from "chart.js/auto";
import { useUserSprints } from "../queries/useSprints";
import type { SprintSummary } from "../api/sprints";
import { useThemeStore } from "../stores/theme.store";

const auth = useAuthStore();
const {
  data: sprintData,
  isPending: sprintsPending,
  error: sprintsError,
} = useUserSprints(() => auth.userId);

/* === VERİLER === */
const trendCanvas = ref<HTMLCanvasElement | null>(null);
let chart: Chart | null = null;

const theme = useThemeStore();

const trendDays = ref(7);
const trendUnit = ref<"minutes" | "hours">("hours");

/* === QUERIES === */
const {
  byDay,
  pending: sdPending,
  error: sdError,
  compute: sdCompute,
  streak,
} = useDailyStudy(() => auth.userId);

const {
  lessons,
  pending: lpPending,
  error: lpError,
  compute: lpCompute,
} = useLessonProgress(() => auth.userId);

const {
  topics,
  pending: tpPending,
  error: tpError,
  compute: tpCompute,
} = useTopicProgress(() => auth.userId);

const {
  overall,
  pending: opPending,
  error: opError,
  compute: opCompute,
} = useOverallProgress(
  () => auth.userId,
  computed(() => auth.preferredCurriculumId)
);

/* === COMPUTEDS === */
const topLesson = computed(() => {
  if (!lessons.value?.length) return null;
  return lessons.value.slice().sort((a, b) => b.completed_topics - a.completed_topics)[0];
});

const motivation = computed(() => {
  const p = overall.value?.progress_percent ?? 0;
  if (p < 30) return "Başlangıç iyi, devam et 🔥";
  if (p < 60) return "Yarı yolu geçtin 💪";
  if (p < 90) return "Son virajdasın 🚀";
  return "Müthiş! Tüm konular bitti 🎉";
});

const completedLessons = computed(() =>
  (lessons.value ?? []).filter((l) => l.total_topics > 0 && l.completed_topics >= l.total_topics)
);
const ongoingLessons = computed(() =>
  (lessons.value ?? []).filter((l) => !(l.total_topics > 0 && l.completed_topics >= l.total_topics))
);

type TopicRow = {
  lesson_name: string;
  topic_title: string;
  total_minutes: number;
  topic_status: string;
  topic_id?: string;
};

const topicsByLesson = computed<Record<
  string,
  { completed: TopicRow[]; inProgress: TopicRow[]; notStarted: TopicRow[] }
>>(() => {
  const grouped: Record<
    string,
    { completed: TopicRow[]; inProgress: TopicRow[]; notStarted: TopicRow[] }
  > = {};
  for (const t of topics.value ?? []) {
    const bucket =
      grouped[t.lesson_name] ??
      (grouped[t.lesson_name] = { completed: [], inProgress: [], notStarted: [] });
    const status = (t.topic_status || "").toLowerCase();
    if (status === "completed") bucket.completed.push(t);
    else if (status === "in_progress") bucket.inProgress.push(t);
    else bucket.notStarted.push(t);
  }
  return grouped;
});

const selectedLesson = ref<string | null>(null);
const showTopicModal = ref(false);

const showCompleted = ref(true);
const showOngoing = ref(true);

function lessonProgressPercent(lesson: { total_topics: number; completed_topics: number }) {
  const total = lesson.total_topics || 0;
  if (!total) return 0;
  return Math.round((lesson.completed_topics / total) * 100);
}

function lessonProgressTone(lesson: { total_topics: number; completed_topics: number }) {
  const pct = lessonProgressPercent(lesson);
  if (pct >= 70) return "bg-emerald-500";
  if (pct >= 30) return "bg-amber-500";
  return "bg-rose-500";
}

function openLessonTopics(lessonName: string) {
  selectedLesson.value = lessonName;
  showTopicModal.value = true;
}

function closeTopicModal() {
  showTopicModal.value = false;
}

const selectedLessonTopics = computed(() => {
  if (!selectedLesson.value) return { completed: [], inProgress: [], notStarted: [] };
  return (
    topicsByLesson.value[selectedLesson.value] ?? {
      completed: [],
      inProgress: [],
      notStarted: [],
    }
  );
});

function topicStatusLabel(status: string) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed") return "Tamamlandi";
  if (normalized === "in_progress") return "Devam ediyor";
  return "Baslamadi";
}

function topicStatusClass(status: string) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (normalized === "in_progress")
    return "bg-amber-50 text-amber-700 border border-amber-200";
  return "bg-slate-100 text-slate-600 border border-slate-200";
}

function fmtTopicMinutes(minutes: number) {
  if (!minutes) return "0 dk";
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (hrs > 0 && mins > 0) return `${hrs}s ${mins}dk`;
  if (hrs > 0) return `${hrs}s`;
  return `${mins}dk`;
}

const sprintRows = computed(() => sprintData.value ?? []);
const sprintErrorMessage = computed(() => {
  const err = sprintsError.value as Error | undefined;
  if (!err) return "";
  return err.message || String(err) || "Sprint verisi alınamadı";
});

function sprintScopeLabel(row: SprintSummary) {
  const { sections, lessons, topics } = row.scopeCounts;
  return `${sections} bölüm • ${lessons} ders • ${topics} konu`;
}

function sprintStatusText(status: string) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed") return "Tamamlandı";
  if (normalized === "paused") return "Beklemede";
  if (normalized === "archived") return "Arşivlendi";
  return "Aktif";
}

function sprintStatusClass(status: string) {
  const normalized = (status || "").toLowerCase();
  if (normalized === "completed")
    return "bg-emerald-50 text-emerald-700 border border-emerald-200";
  if (normalized === "paused")
    return "bg-amber-50 text-amber-700 border border-amber-200";
  if (normalized === "archived")
    return "bg-slate-100 text-slate-600 border border-slate-200";
  return "bg-sky-50 text-sky-700 border border-sky-200";
}

function formatSprintDateLabel(dateIso: string | null) {
  if (!dateIso) return "—";
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return dateIso;
  return date.toLocaleDateString("tr-TR", { day: "2-digit", month: "short" });
}

function formatSprintMinutesLabel(minutes: number | null) {
  if (!minutes) return "—";
  return `${minutes} dk/gün`;
}

function sprintCompletionLabel(row: SprintSummary) {
  const total = row.stats.totalTasks;
  const completed = row.stats.completedTasks;
  return `${completed} / ${total || 0}`;
}

function sprintCompletionWidth(row: SprintSummary) {
  const pct = Math.min(100, Math.max(0, Math.round(row.stats.completionRate)));
  return `${pct}%`;
}

/* === BUGÜN === */
const todayTotal = computed(() => {
  if (!byDay.value.length) return 0;
  const last = byDay.value[byDay.value.length - 1];
  return Math.round(last?.totalminutes ?? last?.totalMinutes ?? 0);
});

/* === GRAFİK === */
const trendLabels = ref<string[]>([]);
const trendValues = ref<number[]>([]);

function formatValueLabel(index: number, value: number) {
  if (trendUnit.value === "hours") {
    const totalMinutes = Math.round(trendValues.value[index] ?? value * 60);
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;
    if (hours > 0 && minutes > 0) return `${hours} s ${minutes} dk`;
    if (hours > 0) return `${hours} s`;
    return `${minutes} dk`;
  }
  return `${Math.round(value)} dk`;
}

const trendBarLabelPlugin = {
  id: "trendBarLabelPlugin",
  afterDatasetsDraw(chart: any) {
    const { ctx } = chart;
    const meta = chart.getDatasetMeta(0);
    if (!meta) return;
    ctx.save();
    meta.data.forEach((element: any, index: number) => {
      const value = chart.data.datasets?.[0]?.data?.[index];
      if (typeof value !== "number") return;
      const { x, y } = element.tooltipPosition();
      ctx.fillStyle = theme.isDark ? "#f8fafc" : "#0f172a";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "bottom";
      ctx.fillText(formatValueLabel(index, value), x, y - 6);
    });
    ctx.restore();
  },
};

function convertValue(v: number) {
  return trendUnit.value === "hours" ? Math.round((v / 60) * 10) / 10 : v;
}

function drawTrend() {
  const ctx = trendCanvas.value?.getContext("2d");
  if (!ctx) return;
  if (chart) chart.destroy();

  const unitLabel = trendUnit.value === "hours" ? "saat" : "dk";
  const data = trendValues.value.map(convertValue);

  chart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: trendLabels.value,
      datasets: [
        {
          label: `Toplam Çalışma (${unitLabel})`,
          data,
          backgroundColor: "#38bdf8",
          borderRadius: 6,
          borderSkipped: false,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: { top: 24 } },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx: any) => formatValueLabel(ctx.dataIndex, ctx.parsed.y),
          },
        },
      },
      scales: {
        y: { beginAtZero: true, grid: { color: "rgba(148, 163, 184, 0.2)" } },
        x: { grid: { display: false } },
      },
    },
    plugins: [trendBarLabelPlugin],
  });
}

function updateTrendView() {
  const all = [...byDay.value].sort((a, b) => a.date.localeCompare(b.date));
  const slice = all.slice(-trendDays.value);
  trendLabels.value = slice.map((d) => d.date);
  trendValues.value = slice.map((d) => d.totalminutes ?? d.totalMinutes ?? 0);
  nextTick(() => drawTrend());
}

async function refreshTrend() {
  await sdCompute(trendDays.value); // min 60 gün çekilir, grafikte kesilir
  updateTrendView();
}

/* === WATCH === */
watch(trendDays, async () => {
  await refreshTrend(); // gün sayısı değişince veriyi yenile
});

watch(trendUnit, () => {
  updateTrendView(); // sadece görünümü güncelle
});

watch(
  () => theme.isDark,
  () => {
    chart?.update();
  }
);

/* === LIFECYCLE === */
onMounted(async () => {
  if (auth.userId) {
    await Promise.all([lpCompute(), opCompute(), tpCompute(), refreshTrend()]);
  }
});
onUnmounted(() => {
  if (chart) chart.destroy();
});
</script>

<template>
  <div class="min-h-screen bg-white xl:bg-sky-100 flex flex-col">
    <header class="px-4"><Navbar /></header>
    <main class="flex-grow flex justify-center py-6 px-0 xl:py-8 xl:px-4">
      <div class="w-full max-w-5xl space-y-4 xl:space-y-8">
        <!-- GENEL -->
        <section class="bg-white p-4 border-b border-slate-100 xl:border-none xl:rounded-3xl xl:shadow-2xl xl:p-6 space-y-2">
          <h1 class="text-3xl font-bold text-sky-700">Genel İlerleme</h1>
          <div v-if="opPending">Yükleniyor...</div>
          <div v-else-if="opError" class="text-red-600">{{ opError }}</div>
          <div
            v-else-if="overall"
            class="p-5 rounded-2xl bg-gradient-to-r from-emerald-500 to-sky-600 text-white"
          >
            <p class="text-sm opacity-90">Genel ilerlemen:</p>
            <h3 class="text-2xl font-bold mt-1">
              %{{ overall.progress_percent ?? 0 }} — {{ overall.completed_topics }}/{{
                overall.total_topics
              }}
              konu
            </h3>
            <p class="text-lg font-semibold mt-2">{{ motivation }}</p>
          </div>
        </section>

        <!-- KOŞU TABLOSU -->
        <section class="bg-white p-4 border-b border-slate-100 xl:border-none xl:rounded-3xl xl:shadow-2xl xl:p-6 space-y-4">
          <div class="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 class="text-2xl font-bold text-slate-800">Koşu Özetleri</h2>
              <p class="text-sm text-slate-500">
                Oluşturduğun koşuların kapsamını ve ilerlemesini takip et.
              </p>
            </div>
          </div>

          <div v-if="sprintsPending">Yükleniyor...</div>
          <div v-else-if="sprintErrorMessage" class="text-sm text-rose-600">
            {{ sprintErrorMessage }}
          </div>
          <div v-else-if="!sprintRows.length" class="text-sm text-slate-500">
            Henüz koşu oluşturulmadı. Koşu Planlayıcı ile ilk koşunu başlat.
          </div>
          <div v-else class="overflow-x-auto">
            <table class="min-w-full text-sm">
              <thead>
                <tr class="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <th class="py-2 pr-4">Koşu</th>
                  <th class="py-2 pr-4">İçerik</th>
                  <th class="py-2 pr-4">Başlangıç</th>
                  <th class="py-2 pr-4">Günlük Süre</th>
                  <th class="py-2 pr-0">Görev Durumu</th>
                </tr>
              </thead>
              <tbody>
                <tr v-for="s in sprintRows" :key="s.id" class="border-t border-slate-100">
                  <td class="py-3 pr-4 align-top">
                    <div class="font-semibold text-slate-800">{{ s.title }}</div>
                    <div class="mt-2">
                      <span
                        :class="[
                          'inline-flex items-center rounded-full px-2 py-0.5 text-xs font-semibold',
                          sprintStatusClass(s.status),
                        ]"
                      >
                        {{ sprintStatusText(s.status) }}
                      </span>
                    </div>
                  </td>
                  <td class="py-3 pr-4 align-top">
                    <div class="font-medium text-slate-700">
                      {{ sprintScopeLabel(s) }}
                    </div>
                    <p class="text-xs text-slate-500 mt-1">
                      {{ s.scopeCounts.topics }} konu dağıtıldı
                    </p>
                  </td>
                  <td class="py-3 pr-4 align-top">
                    {{ formatSprintDateLabel(s.cadence.start_date) }}
                  </td>
                  <td class="py-3 pr-4 align-top">
                    {{ formatSprintMinutesLabel(s.cadence.daily_minutes) }}
                  </td>
                  <td class="py-3 pr-0 align-top">
                    <div class="font-semibold text-slate-800">
                      {{ sprintCompletionLabel(s) }}
                    </div>
                    <div class="mt-1 h-1.5 rounded-full bg-slate-200 overflow-hidden">
                      <div
                        class="h-full rounded-full bg-sky-500 transition-all"
                        :style="{ width: sprintCompletionWidth(s) }"
                      ></div>
                    </div>
                    <p class="text-[11px] text-slate-500 mt-1">
                      %{{ Math.round(s.stats.completionRate) }}
                    </p>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </section>

        <!-- EN ÇOK ÇALIŞILAN DERS -->
        <section v-if="topLesson" class="bg-white p-4 border-b border-slate-100 xl:border-none xl:rounded-3xl xl:shadow-2xl xl:p-6">
          <p class="text-sm opacity-70">En çok çalıştığın ders:</p>
          <h2 class="text-2xl font-bold text-sky-700">{{ topLesson.lesson_name }}</h2>
        </section>

        <!-- ÇALIŞMA ZİNCİRİ -->
        <section class="bg-white p-4 border-b border-slate-100 xl:border-none xl:rounded-3xl xl:shadow-2xl xl:p-6">
          <h2 class="text-2xl font-bold text-amber-700">Çalışma Zinciri</h2>
          <p class="text-slate-600 mb-3">Günlük hedef: ≥ {{ streak.threshold }} dk</p>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div
              class="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-emerald-700"
            >
              <p class="text-sm font-semibold opacity-80">Mevcut Zincir</p>
              <p class="text-3xl font-extrabold">{{ streak.current }} gün</p>
              <p
                class="text-xs mt-1"
                :class="streak.todayMet ? 'text-emerald-700' : 'text-amber-700'"
              >
                {{
                  streak.todayMet
                    ? "Bugün katkı sağlandı ✅"
                    : "Bugün henüz hedefe ulaşılmadı"
                }}
              </p>
            </div>

            <div class="rounded-2xl border border-sky-200 bg-sky-50 p-4 text-sky-700">
              <p class="text-sm font-semibold opacity-80">En İyi Zincir</p>
              <p class="text-3xl font-extrabold">{{ streak.best }} gün</p>
              <p class="text-xs mt-1 opacity-80">Son 60 gün içinde</p>
            </div>

            <div class="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">
              <p class="text-sm font-semibold opacity-80">Bugün Toplam</p>
              <p class="text-3xl font-extrabold">{{ todayTotal }} dk</p>
              <p class="text-xs mt-1 opacity-80">Hedef: {{ streak.threshold }} dk</p>
            </div>
          </div>
        </section>

        <!-- DERSLER -->
        <section class="bg-white p-4 border-b border-slate-100 xl:border-none xl:rounded-3xl xl:shadow-2xl xl:p-6 space-y-3">
          <h2 class="text-2xl font-bold text-emerald-700">Ders İlerlemesi</h2>
          <div v-if="lpPending">Yükleniyor...</div>
          <div v-else-if="lpError" class="text-red-600">{{ lpError }}</div>
          <div v-else class="space-y-2">
            <div class="text-sm text-slate-500 flex items-center justify-between">
              <span>{{ lessons.length }} ders</span>
              <span class="font-semibold text-emerald-600">
                {{ completedLessons.length }} ders bitti
              </span>
            </div>

            <div class="divide-y divide-slate-100 rounded-2xl border border-slate-200 overflow-hidden">
              <div>
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  @click="showOngoing = !showOngoing"
                >
                  <div class="text-left">
                    <p class="text-sm font-semibold text-slate-800">Devam eden dersler</p>
                    <p class="text-xs text-slate-500">{{ ongoingLessons.length }} ders</p>
                  </div>
                  <span
                    :class="[
                      'text-lg text-slate-500 transition-transform',
                      showOngoing ? '-rotate-180' : 'rotate-0',
                    ]"
                  >
                    >
                  </span>
                </button>
                <div v-if="showOngoing" class="space-y-3 bg-white px-4 py-3">
                  <p v-if="!ongoingLessons.length" class="text-xs text-slate-500">
                    Devam eden ders yok.
                  </p>
                  <div
                    v-for="l in ongoingLessons"
                    :key="`ongoing-${l.lesson_name}`"
                    class="rounded-xl border border-slate-100 p-3 shadow-sm"
                  >
                    <div class="flex justify-between text-sm font-semibold mb-1">
                      <div class="flex items-center gap-2">
                        <span class="text-slate-800">{{ l.lesson_name }}</span>
                        <button
                          type="button"
                          class="h-7 w-7 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:text-sky-700 hover:border-sky-300 transition"
                          title="Konulari goruntule"
                          @click="openLessonTopics(l.lesson_name)"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="h-4 w-4"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 4h.01M5 12h14" />
                          </svg>
                          <span class="sr-only">Konular</span>
                        </button>
                      </div>
                      <span>{{ lessonProgressPercent(l) }}%</span>
                    </div>
                    <div class="w-full bg-slate-200 rounded-full h-3 overflow-hidden">
                      <div
                        class="h-3 rounded-full transition-all"
                        :class="lessonProgressTone(l)"
                        :style="{ width: `${lessonProgressPercent(l)}%` }"
                      ></div>
                    </div>
                    <p class="text-xs text-slate-500 mt-1">
                      {{ l.completed_topics }} / {{ l.total_topics }} konu tamamlandı
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <button
                  type="button"
                  class="w-full flex items-center justify-between px-4 py-3 bg-slate-50 hover:bg-slate-100 transition-colors"
                  @click="showCompleted = !showCompleted"
                >
                  <div class="text-left">
                    <p class="text-sm font-semibold text-slate-800">Biten dersler</p>
                    <p class="text-xs text-slate-500">{{ completedLessons.length }} ders</p>
                  </div>
                  <span
                    :class="[
                      'text-lg text-slate-500 transition-transform',
                      showCompleted ? '-rotate-180' : 'rotate-0',
                    ]"
                  >
                    >
                  </span>
                </button>
                <div v-if="showCompleted" class="space-y-3 bg-white px-4 py-3">
                  <p v-if="!completedLessons.length" class="text-xs text-slate-500">
                    Henüz biten ders yok.
                  </p>
                  <div
                    v-for="l in completedLessons"
                    :key="`done-${l.lesson_name}`"
                    class="rounded-xl border border-emerald-100 p-3 shadow-sm bg-emerald-50/70"
                  >
                    <div class="flex justify-between text-sm font-semibold mb-1 text-emerald-800">
                      <div class="flex items-center gap-2">
                        <span>{{ l.lesson_name }}</span>
                        <button
                          type="button"
                          class="h-7 w-7 inline-flex items-center justify-center rounded-full border border-emerald-200 text-emerald-700 hover:text-emerald-900 hover:border-emerald-300 transition"
                          title="Konulari goruntule"
                          @click="openLessonTopics(l.lesson_name)"
                        >
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke-width="2"
                            stroke="currentColor"
                            class="h-4 w-4"
                          >
                            <path stroke-linecap="round" stroke-linejoin="round" d="M12 6v6m0 4h.01M5 12h14" />
                          </svg>
                          <span class="sr-only">Konular</span>
                        </button>
                      </div>
                      <span>{{ lessonProgressPercent(l) }}%</span>
                    </div>
                    <div class="w-full bg-emerald-100 rounded-full h-3 overflow-hidden">
                      <div
                        class="h-3 rounded-full transition-all bg-emerald-500"
                        :style="{ width: `${lessonProgressPercent(l)}%` }"
                      ></div>
                    </div>
                    <p class="text-xs text-emerald-700 mt-1">
                      {{ l.completed_topics }} / {{ l.total_topics }} konu tamamlandı
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- TREND -->
        <section class="bg-white p-4 border-b border-slate-100 xl:border-none xl:rounded-3xl xl:shadow-2xl xl:p-6 space-y-4">
          <div class="flex items-center justify-between">
            <h2 class="text-2xl font-bold text-sky-700">Günlük Trend</h2>
            <div class="flex gap-2">
              <select
                v-model.number="trendDays"
                class="border rounded-xl px-2 py-1 text-sm"
              >
                <option :value="7">Son 7 Gün</option>
                <option :value="30">Son 30 Gün</option>
                <option :value="60">Son 60 Gün</option>
              </select>
              <select v-model="trendUnit" class="border rounded-xl px-2 py-1 text-sm">
                <option value="minutes">Dakika</option>
                <option value="hours">Saat</option>
              </select>
            </div>
          </div>
          <div v-if="sdPending">Yükleniyor...</div>
          <div v-else-if="sdError" class="text-red-600">{{ sdError }}</div>
          <div v-else class="h-72 md:h-96"><canvas ref="trendCanvas"></canvas></div>
        </section>
      </div>
    </main>

    <!-- Ders -> Konu durumu modal -->
    <div
      v-if="showTopicModal"
      class="fixed inset-0 z-50 bg-slate-900/60 flex items-center justify-center px-4"
      role="dialog"
      aria-modal="true"
      @click.self="closeTopicModal"
    >
      <div class="w-full max-w-3xl bg-white rounded-2xl shadow-2xl overflow-hidden">
        <header class="flex items-center justify-between px-5 py-4 border-b border-slate-200">
          <div>
            <p class="text-xs text-slate-500">Ders konulari</p>
            <h3 class="text-lg font-semibold text-slate-800">{{ selectedLesson }}</h3>
          </div>
          <button
            type="button"
            class="h-9 w-9 inline-flex items-center justify-center rounded-full border border-slate-200 text-slate-600 hover:text-slate-900 hover:border-slate-400 transition"
            @click="closeTopicModal"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke-width="2"
              stroke="currentColor"
              class="h-5 w-5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
            <span class="sr-only">Kapat</span>
          </button>
        </header>

        <div class="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          <div v-if="tpPending" class="text-sm text-slate-500">Yukleniyor...</div>
          <div v-else-if="tpError" class="text-sm text-rose-600">{{ tpError }}</div>
          <div
            v-else-if="
              !selectedLesson ||
              (!selectedLessonTopics.completed.length &&
                !selectedLessonTopics.inProgress.length &&
                !selectedLessonTopics.notStarted.length)
            "
            class="text-sm text-slate-500"
          >
            Bu ders icin konu bulunamadi.
          </div>
          <div v-else class="grid gap-4 md:grid-cols-2">
            <div class="space-y-2">
              <div class="flex items-center justify-between">
                <h4 class="text-sm font-semibold text-emerald-700">Tamamlanan</h4>
                <span class="text-xs text-emerald-700"
                  >{{ selectedLessonTopics.completed.length }}</span
                >
              </div>
              <p v-if="!selectedLessonTopics.completed.length" class="text-xs text-slate-500">
                Henuz tamamlanan konu yok.
              </p>
              <div
                v-for="t in selectedLessonTopics.completed"
                :key="t.topic_title"
                class="rounded-lg border border-slate-200 p-3 flex items-start justify-between gap-3 bg-emerald-50/60"
              >
                <div class="space-y-0.5">
                  <p class="text-sm font-semibold text-slate-800">{{ t.topic_title }}</p>
                  <p class="text-xs text-slate-500">{{ fmtTopicMinutes(t.total_minutes) }}</p>
                </div>
                <span
                  class="text-[11px] px-2 py-1 rounded-full font-semibold"
                  :class="topicStatusClass(t.topic_status)"
                >
                  {{ topicStatusLabel(t.topic_status) }}
                </span>
              </div>
            </div>

            <div class="space-y-4">
              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-semibold text-amber-700">Devam eden</h4>
                  <span class="text-xs text-amber-700"
                    >{{ selectedLessonTopics.inProgress.length }}</span
                  >
                </div>
                <p v-if="!selectedLessonTopics.inProgress.length" class="text-xs text-slate-500">
                  Su anda devam eden konu yok.
                </p>
                <div
                  v-for="t in selectedLessonTopics.inProgress"
                  :key="t.topic_title + '-progress'"
                  class="rounded-lg border border-slate-200 p-3 flex items-start justify-between gap-3 bg-amber-50/60"
                >
                  <div class="space-y-0.5">
                    <p class="text-sm font-semibold text-slate-800">{{ t.topic_title }}</p>
                    <p class="text-xs text-slate-500">{{ fmtTopicMinutes(t.total_minutes) }}</p>
                  </div>
                  <span
                    class="text-[11px] px-2 py-1 rounded-full font-semibold"
                    :class="topicStatusClass(t.topic_status)"
                  >
                    {{ topicStatusLabel(t.topic_status) }}
                  </span>
                </div>
              </div>

              <div class="space-y-2">
                <div class="flex items-center justify-between">
                  <h4 class="text-sm font-semibold text-slate-700">Baslamayan</h4>
                  <span class="text-xs text-slate-600"
                    >{{ selectedLessonTopics.notStarted.length }}</span
                  >
                </div>
                <p v-if="!selectedLessonTopics.notStarted.length" class="text-xs text-slate-500">
                  Tum konulara dokundun.
                </p>
                <div
                  v-for="t in selectedLessonTopics.notStarted"
                  :key="t.topic_title + '-not'"
                  class="rounded-lg border border-slate-200 p-3 flex items-start justify-between gap-3"
                >
                  <div class="space-y-0.5">
                    <p class="text-sm font-semibold text-slate-800">{{ t.topic_title }}</p>
                    <p class="text-xs text-slate-500">{{ fmtTopicMinutes(t.total_minutes) }}</p>
                  </div>
                  <span
                    class="text-[11px] px-2 py-1 rounded-full font-semibold"
                    :class="topicStatusClass(t.topic_status)"
                  >
                    {{ topicStatusLabel(t.topic_status) }}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
