<!-- src/views/ZamanlayiciView.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import { useToast } from "vue-toastification";
import Navbar from "../components/Navbar.vue";
import CurriculumPicker from "../components/CurriculumPicker.vue";
import { useAuthStore } from "../stores/auth.store";
import { useTimerStore, type TimerMode } from "../stores/timer.store";
import { usePomodoroStore } from "../stores/pomodoro.store";
import { useRoute, useRouter } from "vue-router";
import {
  useCreateStudySessionFromTimer,
  useDailySummary,
  useSessionsByDate,
} from "../queries/useStudySessions";
import { playBong, primeAudio } from "../lib/sounds";

/* ============ Auth / Router ============ */
const auth = useAuthStore();
const toast = useToast();
const isPremiumActive = computed(() => auth.isPremiumActive);
const route = useRoute();
const router = useRouter();

/* ============ Curriculum Prefill (URL'den) ============ */
type PickerPrefill = {
  sectionCode?: string | null;
  sectionId?: number | null;
  sectionName?: string | null;
  lessonId?: number | null;
  lessonCode?: string | null;
  lessonName?: string | null;
  topicId?: string | null;
  topicTitle?: string | null;
};

function fromQueryString(value: unknown): string | null {
  if (typeof value === "string") return value || null;
  if (Array.isArray(value)) {
    const first = value[0];
    return typeof first === "string" ? (first || null) : null;
  }
  return null;
}
function fromQueryNumber(value: unknown): number | null {
  const str = fromQueryString(value);
  if (str === null) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function extractPrefill(): PickerPrefill | null {
  const q = route.query;
  const pref: PickerPrefill = {};

  const sectionCode = fromQueryString(q.sectionCode ?? q.section ?? null);
  if (sectionCode) pref.sectionCode = sectionCode;

  const sectionId = fromQueryNumber(q.sectionId);
  if (sectionId !== null) pref.sectionId = sectionId;

  const sectionName = fromQueryString(q.sectionName);
  if (sectionName) pref.sectionName = sectionName;

  const lessonId = fromQueryNumber(q.lessonId);
  if (lessonId !== null) pref.lessonId = lessonId;

  const lessonCode = fromQueryString(q.lessonCode);
  if (lessonCode) pref.lessonCode = lessonCode;

  const lessonName = fromQueryString(q.lessonName);
  if (lessonName) pref.lessonName = lessonName;

  const topicId = fromQueryString(q.topicId);
  if (topicId) pref.topicId = topicId;

  const topicTitle = fromQueryString(q.topicTitle);
  if (topicTitle) pref.topicTitle = topicTitle;

  return Object.keys(pref).length ? pref : null;
}

const pickerPrefill = ref<PickerPrefill | null>(null);

watch(
  () => route.query,
  () => {
    pickerPrefill.value = extractPrefill();
  },
  { immediate: true }
);

const cameFromPlan = computed(() => {
  const source = route.query.source;
  if (Array.isArray(source)) {
    return source.includes("plan");
  }
  return source === "plan";
});

function goBackToPlan() {
  router.push({ name: "ders-programi" });
}

/* ============ CurriculumPicker seçimi ============ */
const sel = ref<{
  curriculumId: string | null;
  section: any;
  lesson: any;
  topic: any;
} | null>(null);

function onCurriculumChange(payload: any) {
  sel.value = payload;
}

const humanTopic = () => sel.value?.topic?.title || "";
const selectedTopicId = () => sel.value?.topic?.uuid ?? null;
const selectedCurriculumId = () => sel.value?.curriculumId ?? null;

function ensureTopicSelected(): boolean {
  if (sel.value?.topic) return true;
  toast.warning("Lütfen önce bir ders/konu seçin.");
  return false;
}

function toNullableNumber(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "bigint") return Number(v);
  if (typeof v === "string") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/* =========================================================
   ===================  POMODORO (STORE)  ==================
   ========================================================= */
const pomo = usePomodoroStore();

/* Şema ve set sayısını v-model ile bağlamak için computed setter/getter */
const pomoSchemeModel = computed({
  get: () => pomo.scheme,
  set: (v: "25/5" | "40/10") => pomo.setScheme(v),
});
const setsPlannedModel = computed({
  get: () => pomo.setsPlanned,
  set: (n: number) => pomo.setSetsPlanned(n),
});

/* Flip Countdown için deadline freeze */
const pomoDeadline = ref<string>("");
let pomoFreezeHandle: any = null;
let pomoTick: any = null;

function fmtDeadlineString(msSinceEpoch: number) {
  const d = new Date(msSinceEpoch);
  const y = d.getFullYear();
  const mon = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${y}-${mon}-${day} ${hh}:${mm}:${ss}`;
}
function updatePomoDeadlineFromRemainingOnce() {
  const remain = pomo.remainingSec;
  pomoDeadline.value = fmtDeadlineString(Date.now() + remain * 1000);
}
function clearPomoFreeze() {
  if (pomoFreezeHandle) clearInterval(pomoFreezeHandle);
  pomoFreezeHandle = null;
}
function startPomoFreeze() {
  clearPomoFreeze();
  updatePomoDeadlineFromRemainingOnce();
  pomoFreezeHandle = setInterval(updatePomoDeadlineFromRemainingOnce, 500);
}

function ensurePomoTicking() {
  if (pomoTick) return;
  pomoTick = setInterval(() => {
    const beforePhase = pomo.phase;
    const beforeRemaining = pomo.remainingSec;
    pomo.syncNow();
    // Faz bittiğinde bong (work veya down timer gibi)
    if (beforePhase !== "done" && beforeRemaining === 0) {
      playBong();
    }
  }, 1000);
}
function stopPomoTicking() {
  if (pomoTick) clearInterval(pomoTick);
  pomoTick = null;
}

/* Pomodoro butonları */
function pomoStart() {
  if (pomo.running) return;
  if (pomo.phase === "done") pomo.resetAll();
  if (!ensureTopicSelected()) return;
  if (timer.running) pauseTimer();
  primeAudio();
  pomo.start();
  clearPomoFreeze();
  updatePomoDeadlineFromRemainingOnce();
  ensurePomoTicking();
}
function pomoPause() {
  if (!pomo.running) return;
  pomo.pause();
  startPomoFreeze();
  // ticking devam edebilir; fakat istersen durdurabilirsin
}
function pomoReset() {
  pomo.pause();
  pomo.resetAll();
  clearPomoFreeze();
  pomoDeadline.value = "";
}
const pomoProgressPct = computed(() => pomo.progressPct);
const currentPhaseLabel = computed(() =>
  pomo.phase === "work" ? "Çalışma" : pomo.phase === "break" ? "Mola" : "Bitti"
);
function fmtMMSS(totalSec: number) {
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/* Pomodoro kaydet */
async function savePomodoro() {
  pomo.syncNow();
  const seconds = pomo.effectiveStudySeconds;
  if (seconds <= 0) return;
  const note = `Pomodoro ${pomo.workMinutes}/${pomo.breakMinutes}dk x${pomo.setsPlanned} set`;
  await saveGeneric(seconds, note);
  pomoReset();
}

/* Odak Modu (Pomodoro) */
const showFocusPomodoro = ref(false);
function openFocusPomodoro() {
  updatePomoDeadlineFromRemainingOnce();
  if (!pomo.running && pomo.phase !== "done") startPomoFreeze();
  else clearPomoFreeze();
  showFocusPomodoro.value = true;
}
function closeFocusPomodoro() {
  showFocusPomodoro.value = false;
  if (!pomo.running) clearPomoFreeze();
}

/* =========================================================
   ============   GENEL ZAMANLAYICI (UP/DOWN)   ============
   ========================================================= */
const timer = useTimerStore();
let tickHandle: any = null;

function syncTimer() {
  timer._syncNow();
  if (!timer.running && timer.mode === "down" && timer.remainingSec === 0) {
    playBong();
  }
}
function startTimer() {
  if (pomo.running) return;
  if (timer.running) return;
  if (!ensureTopicSelected()) return;
  primeAudio();
  timer.start();
  ensureTicking();
}
function pauseTimer() {
  if (!timer.running) return;
  timer.pauseSync();
  stopTicking();
}
function resetTimer() {
  timer.hardReset();
  stopTicking();
}
function changeMode(newMode: TimerMode) {
  timer.setMode(newMode);
  stopTicking();
}
function applyTargetMinutes() {
  timer.setTargetMinutes(timer.targetMinutes);
}
const progressPct = computed(() => timer.progressPct);
const showCountdownProgress = computed(() => timer.mode === "down");

const showFocusTimer = ref(false);
function openFocusTimer() {
  syncTimer();
  showFocusTimer.value = true;
}
function closeFocusTimer() {
  showFocusTimer.value = false;
}

function ensureTicking() {
  if (tickHandle) return;
  tickHandle = setInterval(syncTimer, 1000);
}
function stopTicking() {
  if (tickHandle) {
    clearInterval(tickHandle);
    tickHandle = null;
  }
}

/* ESC ve sekme görünürlüğü */
function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") {
    if (showFocusPomodoro.value) closeFocusPomodoro();
    if (showFocusTimer.value) closeFocusTimer();
  }
}
function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    pomo.syncNow();
    syncTimer();
  }
}

/* mount/unmount */
onMounted(() => {
  if (timer.running) ensureTicking();
  if (pomo.running) ensurePomoTicking();
  window.addEventListener("keydown", onEsc);
  document.addEventListener("visibilitychange", onVisibilityChange);
});
onBeforeUnmount(() => {
  stopTicking();
  stopPomoTicking();
  window.removeEventListener("keydown", onEsc);
  document.removeEventListener("visibilitychange", onVisibilityChange);
  clearPomoFreeze();
});

/* =========================================================
   ============   KAYDET -> DB MUTATION   ==================
   ========================================================= */
const createFromTimer = useCreateStudySessionFromTimer(() => auth.userId);
const isCreatePending = computed(() => createFromTimer.isPending.value);

function splitDurationAcrossDays(endTime: Date, durationSeconds: number) {
  const segments: Array<{ dateISO: string; seconds: number }> = [];
  let remaining = Math.max(0, Math.floor(durationSeconds));
  if (remaining <= 0) return segments;

  let cursorEnd = endTime;
  let cursorStart = new Date(cursorEnd.getTime() - remaining * 1000);

  while (remaining > 0) {

    const dayStartCheck = startOfDay(cursorEnd);
    if (dayStartCheck.getTime() === cursorEnd.getTime()) {
      cursorEnd = new Date(cursorEnd.getTime() - 1);
    }

    const dayStart = startOfDay(cursorEnd);

    if (cursorStart >= dayStart) {
      const sec = Math.floor((cursorEnd.getTime() - cursorStart.getTime()) / 1000);
      segments.push({ dateISO: fmtISO(cursorEnd), seconds: sec });
      break;
    } else {
      const sec = Math.floor((cursorEnd.getTime() - dayStart.getTime()) / 1000);
      
      if (sec > 0) {
        segments.push({ dateISO: fmtISO(cursorEnd), seconds: sec });
        remaining -= sec;
        cursorEnd = dayStart; 
      } else {
        cursorEnd = new Date(dayStart.getTime() - 1);
      }

      cursorStart = new Date(cursorEnd.getTime() - remaining * 1000);
    }
  }

  return segments.reverse();
}

async function saveGeneric(
  seconds: number,
  notePrefix = "Zamanlayici"
) {
  if (!auth.isPremiumActive) {
    toast.warning(
      "Calisma zamanlayici kayitlari premium uyeler icindir. Premium'a gecerek surelerini kaydedebilirsin."
    );
    return;
  }
  if (seconds <= 0) return;
  const segments = splitDurationAcrossDays(new Date(), seconds);
  if (!segments.length) return;

  const payload = {
    note: humanTopic() ? `${notePrefix}: ${humanTopic()}` : notePrefix,
    curriculum_id: selectedCurriculumId(),
    topic_uuid: selectedTopicId(),
    topic_title: humanTopic() || null,
    section_id: toNullableNumber(sel.value?.section?.id),
    section_name: sel.value?.section?.name ?? null,
    lesson_id: toNullableNumber(sel.value?.lesson?.id),
    lesson_name: sel.value?.lesson?.name ?? null,
  };

  for (const segment of segments) {
    await createFromTimer.mutateAsync({
      ...payload,
      duration_seconds: segment.seconds,
      date: segment.dateISO,
    });
  }

  const lastSegment = segments[segments.length - 1];
  if (!lastSegment) return;
  const lastDate = lastSegment.dateISO;
  const sessionWeekStart = fmtISO(startOfWeek(new Date(lastDate)));
  if (weekStart.value !== sessionWeekStart) {
    weekStart.value = sessionWeekStart;
  }
  selectedDate.value = lastDate;
}

/* Genel zamanlayici kaydet */
async function saveCurrentTimerSession() {
  syncTimer();
  const seconds = timer.getEffectiveSeconds();
  if (seconds <= 0) return;
  await saveGeneric(seconds, "Genel Zamanlayici");
  timer.hardReset();
  stopTicking();
}

/* =========================================================
   ============   Haftalık Özet / Gün Detayı   =============
   ========================================================= */
function startOfWeek(d: Date) {
  const r = new Date(d);
  const diff = (r.getDay() + 6) % 7;
  r.setDate(r.getDate() - diff);
  r.setHours(0, 0, 0, 0);
  return r;
}
function startOfDay(d: Date) {
  const r = new Date(d);
  r.setHours(0, 0, 0, 0);
  return r;
}
function fmtISO(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
    2,
    "0"
  )}-${String(d.getDate()).padStart(2, "0")}`;
}
const today = new Date();
const weekStart = ref(fmtISO(startOfWeek(today)));
const weekRange = computed<{ from: string; to: string }>(() => {
  const s = startOfWeek(new Date(weekStart.value));
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  return { from: fmtISO(s), to: fmtISO(e) };
});
const selectedDate = ref(weekRange.value.to);

const { data: dailySummary } = useDailySummary(() => auth.userId, weekRange);
const { data: daySessions } = useSessionsByDate(
  () => auth.userId,
  selectedDate,
  { order: "desc" }
);

function fmtDateTR(date: string) {
  return new Date(`${date}T00:00:00`).toLocaleDateString("tr-TR", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}
function fmtMinutesHuman(m: number) {
  const hrs = Math.floor(m / 60);
  const mins = m % 60;
  if (hrs > 0) return `${hrs}sa ${String(mins).padStart(2, "0")}dk`;
  return `${mins}dk`;
}
function changeWeek(offset: number) {
  const d = startOfWeek(new Date(weekStart.value));
  d.setDate(d.getDate() + offset * 7);
  weekStart.value = fmtISO(startOfWeek(d));
  const s = startOfWeek(new Date(weekStart.value));
  const e = new Date(s);
  e.setDate(e.getDate() + 6);
  selectedDate.value = fmtISO(e);
}
</script>

<template>
  <div class="min-h-screen bg-white xl:bg-sky-100 flex flex-col px-0 sm:px-4">
    <header><Navbar /></header>

    <main class="flex-grow flex justify-center items-start px-0 py-6 xl:px-4 xl:py-8">
      <div
        class="w-full max-w-6xl bg-white p-4 xl:p-8 space-y-8 rounded-none shadow-none border-0 xl:rounded-3xl xl:shadow-2xl xl:border xl:border-slate-100"
      >
        <!-- Üst başlık -->
        <header class="space-y-2 text-center">
          <div class="flex justify-start">
            <button
              v-if="cameFromPlan"
              type="button"
              class="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
              @click="goBackToPlan"
            >
              ← Ders Programı
            </button>
          </div>

          <h1 class="text-3xl font-bold text-sky-700">⏱️ Çalışma Zamanlayıcıları</h1>
          <p class="text-sm text-slate-600">
            Pomodoro setleriyle odaklan, ya da serbest sayaçla süre tut. Kaydet ve
            ilerlemeni gör.
          </p>
        </header>

        <!-- Müfredat seçimi -->
        <section class="bg-white border border-slate-200 xl:bg-sky-50 xl:border-sky-100 rounded-2xl p-6 space-y-4">
          <header class="flex items-center justify-between">
            <div class="font-semibold text-sky-700">📚 Müfredat Seçimi</div>
            <div class="text-xs text-slate-500">
              <span v-if="sel?.topic" class="font-medium text-slate-700">
                Konu: {{ sel?.topic?.title }}
              </span>
            </div>
          </header>

          <CurriculumPicker
            storageKey="zamanlayici"
            :prefill="pickerPrefill"
            @change="onCurriculumChange"
          />
        </section>

        <!-- Pomodoro (Set Bazlı) -->
        <section class="bg-white border border-slate-200 xl:bg-sky-50 xl:border-sky-100 rounded-2xl p-6 space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div class="space-y-1">
              <h2 class="text-xl font-semibold text-sky-800">🍅 Pomodoro</h2>
              <p class="text-xs text-slate-600">
                Seçim:
                <span class="font-medium">{{ humanTopic() || "—" }}</span>
              </p>
              <p class="text-[11px] text-slate-500">
                Şema:
                <span class="font-medium"
                  >{{ pomo.workMinutes }} dk çalışma / {{ pomo.breakMinutes }} dk
                  mola</span
                >
                • Set:
                <span class="font-medium"
                  >{{ pomo.currentSet }} / {{ pomo.setsPlanned }}</span
                >
                • Aşama:
                <span class="font-medium">{{ currentPhaseLabel }}</span>
              </p>
            </div>

            <div class="flex flex-col items-start gap-3 text-sm text-slate-700">
              <div class="flex items-center gap-2">
                <label class="font-medium text-slate-700">Şema</label>
                <select
                  class="app-control app-control--compact"
                  v-model="pomoSchemeModel"
                  :disabled="pomo.running"
                >
                  <option value="25/5">25 / 5 (klasik)</option>
                  <option value="40/10">40 / 10 (derin odak)</option>
                </select>
              </div>

              <div class="flex items-center gap-2">
                <label class="font-medium text-slate-700">Set Sayısı</label>
                <input
                  type="number"
                  min="1"
                  class="app-control app-control--compact w-20"
                  v-model.number="setsPlannedModel"
                  :disabled="pomo.running"
                />
              </div>
            </div>
          </div>

          <!-- Süre göstergesi -->
          <div class="text-center space-y-2">
            <div class="text-5xl font-mono font-semibold text-slate-900">
              <template v-if="pomo.phase === 'done'"> BİTTİ 🎉 </template>
              <template v-else>
                {{ fmtMMSS(pomo.remainingSec) }}
              </template>
            </div>
            <div class="text-sm text-slate-500">
              <template v-if="pomo.phase === 'work'"> Çalışma süresi </template>
              <template v-else-if="pomo.phase === 'break'"> Mola süresi </template>
              <template v-else> Tüm setler tamamlandı </template>
            </div>
          </div>

          <!-- İlerleme barı -->
          <div class="w-full h-2 bg-slate-100 xl:bg-sky-100 rounded-full overflow-hidden">
            <div
              class="h-full bg-sky-500 transition-all duration-300"
              :style="{ width: `${pomoProgressPct}%` }"
            ></div>
          </div>

          <!-- Kontroller -->
          <div class="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
              @click="pomoStart"
              :disabled="!isPremiumActive || pomo.running || pomo.phase === 'done'"
            >
              {{
                pomo.phase === "work" &&
                pomo.phaseElapsedSec === 0 &&
                pomo.currentSet === 1
                  ? "Başlat"
                  : "Devam Et"
              }}
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
              @click="pomoPause"
              :disabled="!isPremiumActive || !pomo.running"
            >
              Duraklat
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
              @click="pomoReset"
              :disabled="!isPremiumActive || (pomo.phase === 'work' && pomo.phaseElapsedSec === 0 && pomo.currentSet === 1 && pomo.totalWorkAccum === 0)"
            >
              Sıfırla
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              @click="savePomodoro"
              :disabled="!isPremiumActive || pomo.effectiveStudySeconds <= 0 || isCreatePending"
            >
              Kaydet
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-slate-900 text-white hover:bg-black"
              @click="openFocusPomodoro"
              :disabled="!isPremiumActive"
            >
              Odak Modu
            </button>
          </div>

          <div
            v-if="!isPremiumActive"
            class="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 md:flex-row md:items-center md:justify-between"
          >
            <p class="text-sm font-semibold">
              Zamanlayici kayitlari premium uyeler icindir. Premium'a gecerek surelerini kaydedebilirsin.
            </p>
            <RouterLink
              to="/profile"
              class="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              Premium'a gec
            </RouterLink>
          </div>
        </section>

        <!-- Genel Zamanlayıcı (Up / Down) -->
        <section class="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-4">
          <header
            class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
          >
            <div>
              <h2 class="text-xl font-semibold text-slate-800">🧮 Genel Zamanlayıcı</h2>
              <p class="text-xs text-slate-600">
                Seçim:
                <span class="font-medium">{{ humanTopic() || "—" }}</span>
              </p>
              <p class="text-[11px] text-slate-500">
                Mod:
                <span class="font-medium">{{
                  timer.mode === "up" ? "Yukarı Say" : "Geri Say"
                }}</span>
                <template v-if="timer.mode === 'down'">
                  • Hedef:
                  <span class="font-medium">{{ timer.targetMinutes }} dk</span>
                </template>
              </p>
            </div>

            <div class="flex flex-wrap items-center gap-4 text-sm text-slate-700">
              <label class="inline-flex items-center gap-2">
                <input
                  type="radio"
                  value="up"
                  :checked="timer.mode === 'up'"
                  @change="changeMode('up')"
                  :disabled="timer.running"
                />
                Yukarı Say
              </label>

              <label class="inline-flex items-center gap-2">
                <input
                  type="radio"
                  value="down"
                  :checked="timer.mode === 'down'"
                  @change="changeMode('down')"
                  :disabled="timer.running"
                />
                Geri Say
              </label>

              <div v-if="timer.mode === 'down'" class="flex items-center gap-2">
                <label class="text-sm font-medium text-slate-700">Hedef (dk)</label>
                <input
                  type="number"
                  min="1"
                  class="app-control app-control--compact w-20"
                  v-model.number="timer.targetMinutes"
                  @change="applyTargetMinutes"
                  :disabled="timer.running"
                />
              </div>
            </div>
          </header>

          <!-- süre gösterimi -->
          <div class="text-center space-y-2">
            <div class="text-5xl font-mono font-semibold text-slate-900">
              {{ fmtMMSS(timer.displaySec) }}
            </div>
            <div class="text-sm text-slate-500">
              <template v-if="timer.mode === 'up'"> Geçen Süre </template>
              <template v-else> Kalan • Hedef: {{ timer.targetMinutes }} dk </template>
            </div>
          </div>

          <!-- progress bar (sadece geri sayŽñmda) -->
          <div
            v-if="showCountdownProgress"
            class="w-full h-2 bg-slate-200 rounded-full overflow-hidden"
            aria-label="Geri sayŽñm hedef ilerlemesi"
          >
            <div
              class="h-full bg-emerald-500 transition-all duration-300"
              :style="{ width: `${progressPct}%` }"
            ></div>
          </div>

          <!-- butonlar -->
          <div class="flex flex-wrap gap-2 pt-2">
            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
              @click="startTimer"
              :disabled="!isPremiumActive || timer.running || pomo.running"
            >
              {{ timer.displaySec === 0 ? "Başlat" : "Devam Et" }}
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
              @click="pauseTimer"
              :disabled="!isPremiumActive || !timer.running"
            >
              Duraklat
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
              @click="resetTimer"
              :disabled="!isPremiumActive || (timer.mode === 'up' ? timer.displaySec === 0 : timer.displaySec === timer.totalTargetSec)"
            >
              Sıfırla
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
              @click="saveCurrentTimerSession"
              :disabled="!isPremiumActive || timer.getEffectiveSeconds() <= 0 || isCreatePending"
            >
              Kaydet
            </button>

            <button
              type="button"
              class="rounded-md border px-3 py-1.5 text-sm font-semibold bg-slate-900 text-white hover:bg-black"
              @click="openFocusTimer"
              :disabled="!isPremiumActive"
            >
              Odak Modu
            </button>
          </div>

          <div
            v-if="!isPremiumActive"
            class="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 md:flex-row md:items-center md:justify-between"
          >
            <p class="text-sm font-semibold">
              Zamanlayici kayitlari premium uyeler icindir. Premium'a gecerek surelerini kaydedebilirsin.
            </p>
            <RouterLink
              to="/profile"
              class="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
            >
              Premium'a gec
            </RouterLink>
          </div>
        </section>

        <!-- Günlük Toplamlar -->
        <section class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <h2 class="text-xl font-semibold text-slate-800">
              📊 Günlük Toplamlar (Haftalık)
            </h2>
            <div class="flex items-center gap-2">
              <button
                class="rounded-md border px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200"
                @click="changeWeek(-1)"
              >
                ← Önceki Hafta
              </button>
              <button
                class="rounded-md border px-3 py-1.5 text-sm bg-slate-100 hover:bg-slate-200"
                @click="changeWeek(1)"
              >
                Sonraki Hafta →
              </button>
            </div>
          </div>

          <p class="text-sm text-slate-600">
            Aralık:
            <span class="font-medium">{{ weekRange.from }}</span>
            –
            <span class="font-medium">{{ weekRange.to }}</span>
          </p>

          <div
            v-if="(dailySummary?.length ?? 0) > 0"
            class="overflow-x-auto border border-slate-200 rounded-2xl"
          >
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead class="bg-slate-50 text-slate-600 uppercase text-xs tracking-wider">
                <tr>
                  <th class="px-4 py-3 text-left font-semibold">Tarih</th>
                  <th class="px-4 py-3 text-left font-semibold">Toplam Süre</th>
                  <th class="px-4 py-3 text-left font-semibold">Seans</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-slate-100">
                <tr
                  v-for="d in dailySummary"
                  :key="d.date"
                  class="cursor-pointer hover:bg-sky-50"
                  :class="selectedDate === d.date ? 'bg-sky-100/70' : ''"
                  @click="selectedDate = d.date"
                >
                  <td class="px-4 py-3 font-medium text-slate-800">
                    {{ fmtDateTR(d.date) }}
                  </td>
                  <td class="px-4 py-3 text-slate-700">
                    {{ fmtMinutesHuman(d.totalMinutes) }}
                  </td>
                  <td class="px-4 py-3 text-slate-700">
                    {{ d.count }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <p v-else class="text-sm text-slate-500">Bu hafta için kayıt bulunamadı.</p>
        </section>

        <!-- Gün Detayları -->
        <section class="space-y-4">
          <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <h2 class="text-xl font-semibold text-slate-800">🗂️ Seans Detayları</h2>
            <p class="text-sm text-slate-600">
              Seçilen gün:
              <span class="font-medium">{{ fmtDateTR(selectedDate) }}</span>
            </p>
          </div>

          <div v-if="(daySessions?.length ?? 0) > 0" class="space-y-3">
            <article
              v-for="s in daySessions"
              :key="s.id"
              class="border border-slate-200 rounded-xl px-4 py-3 bg-slate-50"
            >
              <div class="space-y-1">
                <div class="text-sm font-semibold text-slate-800">
                  {{ fmtMinutesHuman(s.duration_minutes) }}
                  <span v-if="s.topic_title" class="text-xs text-slate-600">
                    • {{ s.topic_title }}
                  </span>
                </div>

                <p v-if="s.note" class="text-xs text-slate-600">
                  {{ s.note }}
                </p>

                <p class="text-[11px] text-slate-500">
                  Kaydedildi:
                  {{
                    new Date(s.created_at).toLocaleTimeString("tr-TR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })
                  }}
                </p>
              </div>
            </article>
          </div>

          <p v-else class="text-sm text-slate-500">Bu gün için kayıt bulunmuyor.</p>
        </section>
      </div>
    </main>

    <!-- ===== Odak Modu: Pomodoro ===== -->
    <div
      v-if="showFocusPomodoro"
      class="fixed inset-0 z-50 bg-black text-white"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-8 p-6">
        <div class="text-center space-y-6">
          <p class="text-sm opacity-70" v-if="humanTopic()">
            {{ humanTopic() }}
          </p>

          <div class="flex items-center justify-center">
            <vue3-flip-countdown
              v-if="pomoDeadline && pomo.phase !== 'done'"
              :deadline="pomoDeadline"
              :show-days="false"
              :show-hours="false"
              :show-minutes="true"
              :show-seconds="true"
              :show-labels="false"
              countdown-size="5rem"
              main-color="#FFFFFF"
              label-color="#FFFFFF"
              main-flip-background-color="#111111"
              second-flip-background-color="#111111"
            />
            <div v-else class="text-6xl sm:text-7xl font-mono font-bold tracking-wide">
              <template v-if="pomo.phase === 'done'"> BİTTİ 🎉 </template>
              <template v-else>
                {{ fmtMMSS(pomo.remainingSec) }}
              </template>
            </div>
          </div>

          <p class="text-base opacity-80">
            Set {{ pomo.currentSet }} / {{ pomo.setsPlanned }} •
            {{
              pomo.phase === "work"
                ? "Çalışma"
                : pomo.phase === "break"
                ? "Mola"
                : "Tamamlandı"
            }}
            <br />
            Şema: {{ pomo.workMinutes }} / {{ pomo.breakMinutes }} dk
          </p>

          <div
            class="w-[92%] max-w-4xl h-3 bg-white/10 rounded-full overflow-hidden mx-auto"
          >
            <div
              class="h-full bg-white transition-all duration-300"
              :style="{ width: `${pomoProgressPct}%` }"
            ></div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-3">
          <button
            class="rounded-md px-4 py-2 bg-white text-black font-semibold disabled:opacity-60"
            @click="pomoStart"
            :disabled="pomo.running || pomo.phase === 'done'"
          >
            {{
              pomo.phase === "work" && pomo.phaseElapsedSec === 0 && pomo.currentSet === 1
                ? "Başlat"
                : "Devam Et"
            }}
          </button>

          <button
            class="rounded-md px-4 py-2 bg-white/10 text-white font-semibold disabled:opacity-60"
            @click="pomoPause"
            :disabled="!pomo.running"
          >
            Duraklat
          </button>

          <button
            class="rounded-md px-4 py-2 bg-white/10 text-white font-semibold disabled:opacity-60"
            @click="pomoReset"
            :disabled="
              pomo.phase === 'work' &&
              pomo.phaseElapsedSec === 0 &&
              pomo.currentSet === 1 &&
              pomo.totalWorkAccum === 0
            "
          >
            Sıfırla
          </button>

          <button
            class="rounded-md px-4 py-2 bg-emerald-500 text-white font-semibold disabled:opacity-60"
            @click="savePomodoro"
            :disabled="pomo.effectiveStudySeconds <= 0 || isCreatePending"
          >
            {{ isCreatePending ? "Kaydediliyor…" : "Kaydet" }}
          </button>

          <button
            class="rounded-md px-4 py-2 bg-red-500 text-white font-semibold"
            @click="closeFocusPomodoro"
          >
            Kapat (Esc)
          </button>
        </div>
      </div>
    </div>

    <!-- ===== Odak Modu: Genel Zamanlayıcı ===== -->
    <div
      v-if="showFocusTimer"
      class="fixed inset-0 z-50 bg-black text-white"
      role="dialog"
      aria-modal="true"
    >
      <div class="absolute inset-0 flex flex-col items-center justify-center gap-8 p-6">
        <div class="text-center space-y-4">
          <p class="text-sm opacity-70" v-if="humanTopic()">
            {{ humanTopic() }}
          </p>

          <div class="text-6xl sm:text-7xl font-mono font-bold tracking-wide">
            {{ fmtMMSS(timer.displaySec) }}
          </div>

          <p class="text-base opacity-80">
            {{
              timer.mode === "up"
                ? "Yukarı sayım"
                : `Geri sayım (hedef ${timer.targetMinutes} dk)`
            }}
          </p>
        </div>

        <div
          v-if="showCountdownProgress"
          class="w-[92%] max-w-4xl h-3 bg-white/10 rounded-full overflow-hidden"
          aria-label="Geri sayŽñm hedef ilerlemesi"
        >
          <div
            class="h-full bg-white transition-all duration-300"
            :style="{ width: `${progressPct}%` }"
          ></div>
        </div>

        <div class="flex flex-wrap items-center justify-center gap-3">
          <button
            class="rounded-md px-4 py-2 bg-white text-black font-semibold disabled:opacity-60"
            @click="startTimer"
            :disabled="timer.running || pomo.running"
          >
            {{ timer.displaySec === 0 ? "Başlat" : "Devam Et" }}
          </button>

          <button
            class="rounded-md px-4 py-2 bg-white/10 text-white font-semibold disabled:opacity-60"
            @click="pauseTimer"
            :disabled="!timer.running"
          >
            Duraklat
          </button>

          <button
            class="rounded-md px-4 py-2 bg-white/10 text-white font-semibold disabled:opacity-60"
            @click="resetTimer"
            :disabled="
              timer.mode === 'up'
                ? timer.displaySec === 0
                : timer.displaySec === timer.totalTargetSec
            "
          >
            Sıfırla
          </button>

          <button
            class="rounded-md px-4 py-2 bg-emerald-500 text-white font-semibold disabled:opacity-60"
            @click="saveCurrentTimerSession"
            :disabled="timer.getEffectiveSeconds() <= 0 || isCreatePending"
          >
            {{ isCreatePending ? "Kaydediliyor…" : "Kaydet" }}
          </button>

          <button
            class="rounded-md px-4 py-2 bg-red-500 text-white font-semibold"
            @click="closeFocusTimer"
          >
            Kapat (Esc)
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
