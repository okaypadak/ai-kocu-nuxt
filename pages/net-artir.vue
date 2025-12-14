<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from "vue";
import Navbar from "../components/Navbar.vue";
import CurriculumPicker from "../components/CurriculumPicker.vue";
import { useAuthStore } from "../stores/auth.store";
import {
  useCreateExamResult,
  useCreateGeneralExamResult,
  useWeeklyExamResults,
  useWeeklyGeneralExamResults,
} from "../queries/useExamResults";
import { useCurriculumTree } from "../queries/useCurricula";
import { useToast } from "vue-toastification";

/* toast */
const toast = useToast();

/* auth */
const auth = useAuthStore();
const isPremiumActive = computed(() => auth.isPremiumActive);

/* =========================================================
   SEKME MODU
   - topic   : Konu Bazlı
       * konu zorunlu
       * picker mode="topic" (Bölüm+Ders+Konu)
       * Net Hesabı tek satır input
   - general : Genel Sınav
       * konu zorunlu değil
       * picker mode="general" (Bölüm+Ders, konu yok)
       * Net Hesabı tablo (ders bazlı)
========================================================= */
const modeTab = ref<"topic" | "general">("general");
const isTopicMode = computed(() => modeTab.value === "topic");

const modeHelpText = computed(() => {
  if (isTopicMode.value) {
    return "Bu modda konu zorunlu. Sadece seçilen konuya ait test çözüyorsun.";
  }
  return "Genel modda sadece Genel Yetenek ve Genel Kültür başlıkları için net girersin.";
});

/* =========================================================
   GENEL SINAV TİPİ SEÇİMİ
   (Genel Sınav / Genel Yetenek / Genel Kültür)
========================================================= */
const generalExamType = ref<"genel_sinav" | "genel_yetenek" | "genel_kultur">("genel_sinav");

// Tip değişince varsayılanları güncelle
// Tip değişince varsayılanları güncelle
watch(generalExamType, (val) => {
  if (modeTab.value !== "general") return;
  
  if (val === "genel_sinav") {
    plannedMinutes.value = 130;
    questionCount.value = 120;
  } else {
    // genel_yetenek veya genel_kultur
    plannedMinutes.value = 65;
    questionCount.value = 60;
  }
  // User request: "seçilen seçeneğe göre ilgili süreyi elle seçeceğim bölümünede ekle"
  manualMinutes.value = plannedMinutes.value;
});

/* =========================================================
   CURRICULUM PICKER
   storageKey='sinav-net' -> bu sayfaya özel seçimleri saklıyoruz
========================================================= */
const sel = ref<{
  curriculumId: string | null;
  section: any;
  lesson: any;
  topic: any;
} | null>(null);

function onCurriculumChange(payload: any) {
  sel.value = payload;
}

const curriculumId = computed(() => sel.value?.curriculumId || "");
const { data: curriculumTree } = useCurriculumTree(curriculumId);

const sectionObj = computed(() => sel.value?.section || null);
const lessonObj = computed(() => sel.value?.lesson || null);
const topicObj = computed(() => sel.value?.topic || null);

const topicId = computed(() => topicObj.value?.uuid || "");
const topicTitle = computed(() => topicObj.value?.title || "");

/* Görsel breadcrumb */
const selectionLine = computed(() => {
  const sec = sectionObj.value?.name || sectionObj.value?.title;
  const les = lessonObj.value?.name || lessonObj.value?.title;
  const top = topicObj.value?.title;
  return [sec, les, top].filter(Boolean).join(" › ");
});

/* =========================================================
   SAYAÇ / SINAV DURUMU  (ÖNCE bunları tanımlıyoruz ki rebuildRows bunları görebilsin)
========================================================= */
const running = ref(false);
const paused = ref(false);
const sec = ref(0); // geçen süre (saniye)

let handle: any = null;
let timerStartAt: number | null = null;
let accumulatedMs = 0;

const plannedMinutes = ref(45);
const addMinutes = ref(5);

const questionCount = ref(20);



const GENERAL_SECTION_MAX = 60;

/* Konu Bazlı mod için tek set skor */
const singleCorrect = ref(0);
const singleWrong = ref(0);

/* zaman damgaları */
let startedAt: Date | null = null;
let finishedAt: Date | null = null;

const isManualDuration = ref(false);
const manualMinutes = ref(0);

/* Manuel mod açıldığında veya manualMinutes değiştiğinde sec'i güncelle */
watch(
  [isManualDuration, manualMinutes],
  ([isMan, min]) => {
     if (isMan) {
       // Timer çalışıyorsa durduralım
       if (running.value) {
         pause();
         running.value = false;
         paused.value = false;
       }
       // sec değerini manuel dakikaya eşitle
       sec.value = (Number(min) || 0) * 60;
     }
  }
);

/* helpers */
function secondsToMinutes(seconds: number) {
  const raw = Number(seconds);
  if (!Number.isFinite(raw) || raw <= 0) return 0;
  const sVal = Math.max(0, Math.floor(raw));
  if (sVal <= 0) return 0;
  return Math.max(1, Math.round(sVal / 60));
}
function toSafeInt(value: unknown) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return 0;
  return Math.max(0, Math.round(numeric));
}

function computeRowNet(correct: unknown, wrong: unknown) {
  const c = toSafeInt(correct);
  const w = toSafeInt(wrong);
  return Number((c - w / 4).toFixed(2));
}

function fmtMMSS(s: number) {
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${String(m).padStart(2, "0")}:${String(r).padStart(2, "0")}`;
}

function stopTimerInterval() {
  if (handle) clearInterval(handle);
  handle = null;
}

function syncExamTimer(now = Date.now()) {
  let totalMs = accumulatedMs;
  if (running.value && !paused.value && timerStartAt !== null) {
    totalMs += now - timerStartAt;
  }
  sec.value = Math.max(0, Math.floor(totalMs / 1000));
}

const progress = computed(() => {
  const total = plannedMinutes.value * 60 || 1;
  return Math.min(100, Math.round((sec.value / total) * 100));
});

const pauseResumeLabel = computed(() => (paused.value ? "Devam Et" : "Duraklat"));

/* Ek süre */
function addExtra(m?: number) {
  if (!running.value) return;
  const v = Number(m ?? addMinutes.value ?? 0);
  if (!Number.isFinite(v) || v <= 0) return;
  const next = Number(plannedMinutes.value || 0) + v;
  plannedMinutes.value = Math.max(1, Math.min(600, next)); // 10 saate kadar
}

/* =========================================================
   START koşulları:
   - curriculumId zorunlu
   - eğer topic modundaysa topic zorunlu
========================================================= */
const canStartNow = computed(() => {
  if (!curriculumId.value) return false;
  if (isTopicMode.value && !topicId.value) return false;
  return true;
});

/* snapshot'lanmış seçim bilgileri
   (DB kaydına yazmak için sınav başında donduyoruz) */
const activeSectionName = ref<string | null>(null);
const activeSectionId = ref<number | null>(null);
const activeLessonName = ref<string | null>(null);
const activeLessonId = ref<number | null>(null);

function sectionNameFromSelection() {
  const s = sectionObj.value;
  return s?.name || s?.title || null;
}
function sectionIdFromSelection() {
  const id = sectionObj.value?.id;
  return typeof id === "number" ? id : null;
}
function lessonNameFromSelection() {
  const l = lessonObj.value;
  return l?.name || l?.title || null;
}
function lessonIdFromSelection() {
  const id = lessonObj.value?.id;
  return typeof id === "number" ? id : null;
}

function generalExamName() {
  switch (generalExamType.value) {
    case "genel_yetenek":
      return "Genel Yetenek";
    case "genel_kultur":
      return "Genel Kültür";
    default:
      return "Genel Sınav";
  }
}

function captureSelectionSnapshot() {
  activeSectionName.value = sectionNameFromSelection();
  activeSectionId.value = sectionIdFromSelection();
  activeLessonName.value = lessonNameFromSelection();
  activeLessonId.value = lessonIdFromSelection();
}

/* START */
function start() {
  if (running.value) return;
  if (!auth.isPremiumActive) {
    toast.warning("Sinav zamanlayicisini baslatmak icin lutfen premium kullanicisi olunuz.");
    return;
  }

  if (isManualDuration.value) {
    toast.warning("Manuel süre girişi aktifken zamanlayıcı başlatılamaz. Önce 'Süreyi elle gireceğim' işaretini kaldırın.");
    return;
  }

  if (!curriculumId.value) {
    toast.warning("Önce müfredat seçin.");
    return;
  }
  if (isTopicMode.value && !topicId.value) {
    toast.warning("Önce konu seçin.");
    return;
  }

  // Genel moddaysak tabloyu şu anki seçime göre kilitle
  rebuildRows();

  // seçim snapshot
  captureSelectionSnapshot();

  running.value = true;
  paused.value = false;
  accumulatedMs = 0;
  sec.value = 0;

  // skorları sıfırla
  singleCorrect.value = 0;
  singleWrong.value = 0;
  for (const r of rows.value) {
    r.correct = 0;
    r.wrong = 0;
  }

  startedAt = new Date();
  finishedAt = null;

  timerStartAt = Date.now();
  syncExamTimer();
  stopTimerInterval();
  handle = setInterval(() => {
    syncExamTimer();
  }, 1000);
}

/* PAUSE / RESUME */
function pause() {
  if (!running.value || paused.value) return;
  if (timerStartAt !== null) {
    accumulatedMs += Date.now() - timerStartAt;
  }
  paused.value = true;
  timerStartAt = null;
  stopTimerInterval();
  syncExamTimer();
}
function resume() {
  if (!running.value || !paused.value) return;
  paused.value = false;
  timerStartAt = Date.now();
  stopTimerInterval();
  handle = setInterval(() => {
    syncExamTimer();
  }, 1000);
  syncExamTimer();
}
function togglePause() {
  if (!running.value) return;
  if (paused.value) resume();
  else pause();
}

/* FINISH */
function finish() {
  if (!running.value) return;
  syncExamTimer();
  running.value = false;
  paused.value = false;
  stopTimerInterval();

  finishedAt = new Date();
  if (startedAt && finishedAt) {
    const diff = Math.max(
      1,
      Math.round((finishedAt.getTime() - startedAt.getTime()) / 1000)
    );
    if (diff > sec.value) sec.value = diff;
  }

  timerStartAt = null;
  accumulatedMs = sec.value * 1000;
}

/* RESET */
const feedback = ref("");
function reset() {
  stopTimerInterval();
  timerStartAt = null;
  running.value = false;
  paused.value = false;
  accumulatedMs = 0;
  sec.value = 0;
  startedAt = null;
  finishedAt = null;
  feedback.value = "";

  activeSectionName.value = null;
  activeSectionId.value = null;
  activeLessonName.value = null;
  activeLessonId.value = null;

  singleCorrect.value = 0;
  singleWrong.value = 0;

  for (const r of rows.value) {
    r.correct = 0;
    r.wrong = 0;
  }

  // bitince tabloyu tekrar serbest hale getir
  rebuildRows();
}

/* =========================================================
   GENEL MOD TABLO SATIRLARI
   rows = [
     { code, lessonId, lessonName, correct, wrong }
   ]
========================================================= */
type RowScore = {
  code?: string;
  lessonId: number | null;
  lessonName: string;
  correct: number;
  wrong: number;
};

const defaultGeneralRows: RowScore[] = [
  {
    code: "genel_yetenek",
    lessonId: null,
    lessonName: "Genel Yetenek",
    correct: 0,
    wrong: 0,
  },
  {
    code: "genel_kultur",
    lessonId: null,
    lessonName: "Genel Kültür",
    correct: 0,
    wrong: 0,
  },
];

const rows = ref<RowScore[]>([]);

function cloneGeneralRows(): RowScore[] {
  return defaultGeneralRows.map((r) => ({ ...r }));
}

function normalizeLabel(val?: string | null) {
  return (val || "").toLowerCase();
}

function isGeneralSection(section: { name?: string; code?: string } | null | undefined) {
  if (!section) return false;
  const label = normalizeLabel(section.name) || normalizeLabel(section.code);
  return (
    label.includes("genel yetenek") ||
    label.includes("genel_yetenek") ||
    label === "gy" ||
    label.includes("genel kültür") ||
    label.includes("genel kultur") ||
    label.includes("genel_kultur") ||
    label === "gk"
  );
}



function buildRowsFromCurriculum(): RowScore[] {
  if (!curriculumTree.value || !sectionObj.value) return [];
  if (!isGeneralSection(sectionObj.value)) return [];

  const targetSection =
    curriculumTree.value.sections.find((s) => s.id === sectionObj.value?.id) ||
    curriculumTree.value.sections.find(
      (s) => normalizeLabel(s.code) === normalizeLabel(sectionObj.value?.code)
    ) ||
    curriculumTree.value.sections.find(
      (s) => normalizeLabel(s.name) === normalizeLabel(sectionObj.value?.name)
    );

  if (!targetSection) return [];



  // Filter lessons if a specific lesson is selected
  let lessons = targetSection.lessons || [];
  if (lessonObj.value && lessonObj.value.id) {
    lessons = lessons.filter((l) => l.id === lessonObj.value.id);
  }

  return lessons.slice(0, GENERAL_SECTION_MAX).map((l) => ({
    code: l.code,
    lessonId: l.id,
    lessonName: l.name,
    correct: 0,
    wrong: 0,
  }));
}

function rebuildRows() {
  if (isTopicMode.value) {
    rows.value = [];
    return;
  }

  if (running.value || sec.value > 0) {
    return;
  }

  const curriculumRows = buildRowsFromCurriculum();
  rows.value = curriculumRows.length ? curriculumRows : cloneGeneralRows();
}

/* rebuildRows'i tetikleyecek watcher
   (Bu watcher burada tan?ml? kalabilir ??nk? rebuildRows art?k yukar?da) */
/* rebuildRows'i tetikleyecek watcher */
watch(
  modeTab,
  () => {
    rebuildRows();
    if (modeTab.value === "general") {
      // Mod ilk açıldığında genelExamType'a göre resetle
      if (generalExamType.value === "genel_sinav") {
        plannedMinutes.value = 130;
        questionCount.value = 120;
      } else {
        plannedMinutes.value = 65;
        questionCount.value = 60;
      }
    }
  },
  { immediate: true }
);

watch([sectionObj, curriculumTree, lessonObj], () => {
  rebuildRows();

  // "combobax'ta ne seçtimse" kuralı gereği:
  if (!isTopicMode.value) {
    let newType: "genel_sinav" | "genel_yetenek" | "genel_kultur" = "genel_sinav";

    if (sectionObj.value) {
      const s = sectionObj.value;
      const label = (s.name || s.code || "").toLowerCase();

      if (label.includes("yetenek") || label === "gy") {
        newType = "genel_yetenek";
      } else if (label.includes("kültür") || label.includes("kultur") || label === "gk") {
        newType = "genel_kultur";
      }
    }
    // If sectionObj is null (e.g. root selection 'Genel Sınav'), we default to 'genel_sinav'

    generalExamType.value = newType;

    // Type değişmese bile süreleri/soruları zorla resetle
    if (newType === "genel_sinav") {
      plannedMinutes.value = 130;
      questionCount.value = 120;
    } else {
      plannedMinutes.value = 65;
      questionCount.value = 60;
    }
    manualMinutes.value = plannedMinutes.value;
  }
});

/* =========================================================
   TOPLAM DOĞRU/YANLIŞ/BOŞ ve NET
   Topic modunda -> singleCorrect/singleWrong
   Genel modunda -> rows içinden toplanıyor
========================================================= */
const totalCorrect = computed(() => {
  if (isTopicMode.value) return Number(singleCorrect.value || 0);
  let acc = 0;
  for (const r of rows.value) acc += Number(r.correct || 0);
  return acc;
});
const totalWrong = computed(() => {
  if (isTopicMode.value) return Number(singleWrong.value || 0);
  let acc = 0;
  for (const r of rows.value) acc += Number(r.wrong || 0);
  return acc;
});
const totalBlank = computed(() => {
  const q = Number(questionCount.value || 0);
  const derived = q - Number(totalCorrect.value || 0) - Number(totalWrong.value || 0);
  return Math.max(0, derived);
});

const totalAnswered = computed(
  () => Number(totalCorrect.value || 0) + Number(totalWrong.value || 0)
);

const net = computed(() => {
  return Number(
    (Number(totalCorrect.value || 0) - Number(totalWrong.value || 0) / 4).toFixed(2)
  );
});

const accuracy = computed(() => {
  const q = Number(questionCount.value || 0);
  if (!q) return -1;
  if (!totalAnswered.value) return 0;
  return (Number(totalCorrect.value || 0) / q) * 100;
});

  /* =========================================================
     KAYDETME
  ========================================================= */
  const createTopicMut = useCreateExamResult(() => auth.userId);
  const createGeneralMut = useCreateGeneralExamResult(() => auth.userId);
  const saving = ref(false);
  
  const canSave = computed(() => !running.value && sec.value > 0 && !!curriculumId.value);
  
  function toISO(d: Date | null) {
    return d ? d.toISOString() : new Date().toISOString();
  }
  
  function currentSectionName() {
    return activeSectionName.value ?? sectionNameFromSelection();
  }
  function currentSectionId() {
    return activeSectionId.value ?? sectionIdFromSelection();
  }
  function currentLessonName() {
    return activeLessonName.value ?? lessonNameFromSelection();
  }
  function currentLessonId() {
    return activeLessonId.value ?? lessonIdFromSelection();
  }
  
  function save() {
    if (!canSave.value || saving.value) return;
    if (!auth.isPremiumActive) {
      toast.warning("Sinav sonuclarini kaydetmek icin lutfen premium kullanicisi olunuz.");
      return;
    }
    saving.value = true;
  
    const baseTopicPayload = {
      section_id: currentSectionId(),
      section_name: currentSectionName(),
      lesson_id: currentLessonId(),
      lesson_name: currentLessonName(),
      correct_count: Number(totalCorrect.value) || 0,
      wrong_count: Number(totalWrong.value) || 0,
    };
  
    const plannedDuration = isTopicMode.value
      ? Number(plannedMinutes.value) || 0
      : (modeTab.value === 'general' ? Number(plannedMinutes.value) : 130);
      
    const durationMinutes = secondsToMinutes(sec.value);
    
    const questionTotal = isTopicMode.value
      ? Number(questionCount.value) || 0
      : (generalExamType.value === 'genel_sinav' ? 120 : 60);
  
    const baseTimingPayload = {
      planned_duration_minutes: plannedDuration,
      duration_minutes: durationMinutes,
      started_at: toISO(startedAt),
      finished_at: toISO(finishedAt),
    };
  
    const sharedCallbacks = {
      onSuccess: () => {
        feedback.value = "Sonuç kaydedildi.";
        reset();
        refetchWeeklyTopic();
        refetchWeeklyGeneral();
      },
      onError: (e: any) => {
        feedback.value = e?.message || "Kayıt başarısız.";
      },
      onSettled: () => {
        saving.value = false;
      },
    };
  
    if (isTopicMode.value) {
      createTopicMut.mutate(
        {
          curriculum_id: curriculumId.value!,
          topic_uuid: topicId.value || null,
          topic_title: topicTitle.value || null,
          ...baseTopicPayload,
          ...baseTimingPayload,
          question_count: questionTotal,
        },
        sharedCallbacks
      );
      return;
    }
  
    const toGeneralCode = (name: string) => {
      const lower = name.toLowerCase();
      if (lower.includes("kültür") || lower.includes("kultur")) return "genel_kultur";
      if (lower.includes("yetenek")) return "genel_yetenek";
      return "genel_sinav";
    };
  
    // Explicitly grab the current value at save time
    const generalType = generalExamType.value;
  
    const detailRows =
      rows.value.length > 0
        ? rows.value.map((r) => {
            const label = r.lessonName || generalExamName();
            const correct = toSafeInt(r.correct);
            const wrong = toSafeInt(r.wrong);
            const netScore = computeRowNet(correct, wrong);
            return {
              code: r.code || toGeneralCode(label),
              name: label,
              correct_count: correct,
              wrong_count: wrong,
              net_score: netScore,
            };
          })
        : [ // Fallback row
            {
              code: generalType, // use the type as code for single row fallback
              name: generalExamName(),
              correct_count: toSafeInt(totalCorrect.value),
              wrong_count: toSafeInt(totalWrong.value),
              net_score: computeRowNet(totalCorrect.value, totalWrong.value),
            },
          ];
  
    const detailPayload = {
      type: generalType,
      question_count: questionTotal,
      score: null,
      rows: detailRows,
    };
  
    createGeneralMut.mutate(
      {
        curriculum_id: curriculumId.value!,
        name: generalExamName(),
        ...baseTimingPayload,
        detail: detailPayload,
      },
      sharedCallbacks
    );
  }
  
  /* =========================================================
     HAFTALIK ÖZET
     - Haftanın Pazartesi 00:00'ını weekStartRef'te tut
     - Prev / Next ile +-7 gün kay
     - useWeeklyExamResults() ile verileri çek
     - Sonra gün bazında topla
  ========================================================= */
  
  /** Pazartesi başlangıcını bul */
function startOfWeekMonday(src: Date): Date {
  const d = new Date(src);
  // 0=PAZAR ... 1=PAZARTESİ ...
  const day = d.getDay();
  // Pazartesi -> diff=0, Salı->1 ... Pazar->6
  const diff = (day + 6) % 7;
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - diff);
  return d;
}
function addDays(date: Date, n: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + n);
  return d;
}

function formatDateKey(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

const weekStartRef = ref<Date>(startOfWeekMonday(new Date()));
function shiftWeek(delta: number) {
  weekStartRef.value = addDays(weekStartRef.value, delta * 7);
}

const weekEndRef = computed<Date>(() => addDays(weekStartRef.value, 7));
const weekStartISO = computed(() => weekStartRef.value.toISOString());
const weekEndISO = computed(() => weekEndRef.value.toISOString());

/* supabase'den bu haftan?n exam_results kay?tlar?n? ?ek */
const { data: weeklyTopicRaw, refetch: refetchWeeklyTopic } = useWeeklyExamResults(
  () => auth.userId,
  weekStartISO,
  weekEndISO,
  curriculumId // ayn? m?fredat i?inde kals?n
);
const {
  data: weeklyGeneralRaw,
  refetch: refetchWeeklyGeneral,
} = useWeeklyGeneralExamResults(() => auth.userId, weekStartISO, weekEndISO, curriculumId);

type WeeklyRow = {
  finished_at: string | null;
  created_at: string | null;
  net_score: number | null;
  duration_minutes: number | null;
};

function toSafeNumber(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

const weeklyRows = computed<WeeklyRow[]>(() => {
  const topicRows = weeklyTopicRaw.value ?? [];
  const generalRows =
    weeklyGeneralRaw.value?.map((row) => {
      const detail = row.detail ?? null;
      const detailRows = Array.isArray(detail?.rows) ? detail.rows : [];
      const totalNet =
        detail?.totals?.net_score ??
        detailRows.reduce(
          (acc, d) => acc + toSafeNumber((d as any)?.net_score),
          0
        );

      return {
        finished_at: row.finished_at,
        created_at: row.created_at,
        net_score: Number(toSafeNumber(totalNet).toFixed(2)),
        duration_minutes: toSafeNumber(row.duration_minutes),
      };
    }) ?? [];

  return [...topicRows, ...generalRows];
});


/**
 * dailyAgg:
 *  {
 *    dayKey: '2025-10-25',
 *    label: '25.10 Cmt',
 *    examCount: number,
 *    totalNet: number,
 *    totalMin: number
 *  }[]
 *
 * 7 günlüğü dolduruyoruz, hiç kayıt olmasa bile.
 */
const dailyAgg = computed(() => {
  const map: Record<
    string,
    { examCount: number; totalNet: number; totalMin: number; dateObj: Date }
  > = {};

  // önce 7 günü boş doldur
  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStartRef.value, i);
    const key = formatDateKey(d);
    map[key] = {
      examCount: 0,
      totalNet: 0,
      totalMin: 0,
      dateObj: d,
    };
  }

  // veriden doldur
  for (const row of weeklyRows.value ?? []) {
    const fin = row.finished_at || row.created_at;
    if (!fin) continue;
    const dt = new Date(fin);
    const key = formatDateKey(dt);

    if (!map[key]) {
      map[key] = {
        examCount: 0,
        totalNet: 0,
        totalMin: 0,
        dateObj: dt,
      };
    }

    map[key].examCount += 1;
    map[key].totalNet += Number(row.net_score ?? 0);
    map[key].totalMin += Number(row.duration_minutes ?? 0);
  }

  // output sırala (haftanın 7 günü sırayla)
  const out: {
    dayKey: string;
    label: string;
    examCount: number;
    totalNet: number;
    totalMin: number;
  }[] = [];

  for (let i = 0; i < 7; i++) {
    const d = addDays(weekStartRef.value, i);
    const key = formatDateKey(d);
    const rec =
      map[key] ??
      {
        examCount: 0,
        totalNet: 0,
        totalMin: 0,
        dateObj: d,
      };

    const dayStr = d.toLocaleDateString("tr-TR", {
      weekday: "short",
      day: "2-digit",
      month: "2-digit",
    });

    out.push({
      dayKey: key,
      label: dayStr,
      examCount: rec.examCount,
      totalNet: Number(rec.totalNet.toFixed(2)),
      totalMin: rec.totalMin,
    });
  }

  return out;
});

/* =========================================================
   GLOBAL EVENTLER
========================================================= */
function onEsc(e: KeyboardEvent) {
  if (e.key === "Escape") {
    // ilerde modal vs.
  }
}
function onVisibilityChange() {
  if (document.visibilityState === "visible") {
    syncExamTimer();
  }
}
onMounted(() => {
  window.addEventListener("keydown", onEsc);
  document.addEventListener("visibilitychange", onVisibilityChange);
});
onBeforeUnmount(() => {
  window.removeEventListener("keydown", onEsc);
  document.removeEventListener("visibilitychange", onVisibilityChange);
});

/* mod değişince tabloyu tekrar kur */
watch(modeTab, () => {
  rebuildRows();
});
</script>

<template>
  <div class="min-h-screen bg-white xl:bg-sky-100 flex flex-col px-0 sm:px-4">
    <header><Navbar /></header>

    <main class="flex-grow flex items-start justify-center px-0 py-6 xl:px-4 xl:py-8">
      <div
        class="w-full max-w-6xl bg-white p-4 xl:p-8 space-y-8 rounded-none shadow-none border-0 xl:rounded-3xl xl:shadow-2xl xl:border xl:border-slate-100"
      >
        <!-- BAŞLIK -->
        <header class="space-y-2 text-center">
          <h1 class="text-3xl font-bold text-sky-700">🎯 Sınav Net Hesaplama</h1>
          <p class="text-sm text-slate-600">
            Müfredat / konu / ders seç, süreyi tut, doğru-yanlışı gir ve sonucu kaydet.
          </p>
        </header>

        <!-- MOD SEÇ + PICKER -->
        <section class="bg-white border border-slate-200 xl:bg-sky-50 xl:border-sky-100 rounded-2xl p-6 space-y-4">
          <!-- Sekme butonları -->
          <div class="flex flex-wrap items-center gap-2">
            <button
              type="button"
              class="px-3 py-1.5 text-sm font-semibold rounded-md border"
              :class="[
                modeTab === 'topic'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-sky-300 hover:text-sky-700',
              ]"
              @click="modeTab = 'topic'"
            >
              Konu Bazlı
            </button>

            <button
              type="button"
              class="px-3 py-1.5 text-sm font-semibold rounded-md border"
              :class="[
                modeTab === 'general'
                  ? 'bg-sky-600 text-white border-sky-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:border-sky-300 hover:text-sky-700',
              ]"
              @click="modeTab = 'general'"
            >
              Genel Sınav
              <span class="text-[11px] text-white/80" v-if="modeTab === 'general'">
                (Bölüm / Ders / Tam)
              </span>
            </button>
          </div>




          <!-- A??klama -->
          <p class="text-xs text-slate-600 leading-relaxed">
            {{ modeHelpText }}
          </p>

          <!-- CurriculumPicker -->
          <div class="grid gap-3">
            <CurriculumPicker
              storageKey="sinav-net"
              :mode="modeTab"
              @change="onCurriculumChange"
            />

            <!-- se?imin ?zeti -->
            <p class="text-xs text-slate-600">
              <span class="font-medium text-slate-700">
                Se?im: 
              </span>
              <span v-if="selectionLine" class="text-slate-400 mx-1">?</span>
              <span>
                {{ selectionLine || "B?l?m / Ders / Konu se?iniz" }}
              </span>
            </p>
          </div>

        </section>

        <!-- SAYAÇ + NET HESABI -->
        <section class="grid grid-cols-1 gap-6">
          <!-- Sayaç -->
          <div
            class="bg-white border border-slate-200 rounded-2xl p-6 space-y-6 shadow-inner"
          >
            <header class="space-y-1 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h2 class="text-xl font-semibold text-slate-800">⏱️ Test Süreci</h2>
                <p class="text-sm text-slate-500">
                  Süreyi tut veya elle gir. Bitirdiğinde netini kaydet.
                </p>
              </div>

              <!-- Manuel Mod Toggle -->
              <div class="flex items-center gap-2">
                 <input 
                   type="checkbox" 
                   id="manualModeToggle" 
                   v-model="isManualDuration"
                   class="w-4 h-4 rounded text-sky-600 focus:ring-sky-500 border-gray-300"
                 />
                 <label for="manualModeToggle" class="text-sm font-medium text-slate-700 select-none">
                   Süreyi elle gireceğim
                 </label>
              </div>
            </header>

            <!-- SORU SAYISI (ORTAK) -->
            <div class="flex flex-col space-y-1">
               <label class="text-sm font-medium text-slate-700">Soru Sayısı (toplam)</label>
               <input
                 type="number"
                 min="1"
                 max="200"
                 class="w-full rounded-md border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                 :disabled="running || !isTopicMode"
                 v-model.number="questionCount"
               />
            </div>

            <!-- MANUEL MOD GİRİŞİ -->
            <div v-if="isManualDuration" class="bg-amber-50 border border-amber-100 rounded-xl p-4 space-y-3">
              <p class="text-sm text-amber-800">
                Kronometre yerine sınavın toplam süresini doğrudan aşağıya girebilirsin.
              </p>
               <div class="flex flex-col space-y-1">
                <label class="text-sm font-medium text-slate-700">Geçen Süre (dk)</label>
                <input
                  type="number"
                  min="1"
                  max="600"
                  class="w-full rounded-md border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                  v-model.number="manualMinutes"
                  placeholder="Örn: 45"
                />
              </div>
            </div>

            <!-- KRONOMETRE MODU (Eğer manuel kapalıysa) -->
            <div v-else class="space-y-6">

            <!-- Planlanan süre -->
            <!-- Planlanan süre -->
            <div class="grid grid-cols-1 gap-4">
              <div class="flex flex-col space-y-1">
                <label class="text-sm font-medium text-slate-700"
                  >Planlanan Süre (dk)</label
                >
                <input
                  type="number"
                  min="5"
                  max="240"
                  step="5"
                  class="w-full rounded-md border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                   :disabled="running || !isTopicMode"
                  v-model.number="plannedMinutes"
                />
              </div>
            </div>

            <!-- Kronometre -->
            <div class="text-center space-y-2">
              <p class="text-5xl font-mono font-semibold text-slate-800 tracking-wide">
                {{ fmtMMSS(sec) }}
              </p>
              <p class="text-sm text-slate-500">
                Hedef: {{ plannedMinutes }} dk • Geçen: {{ (sec / 60).toFixed(1) }} dk
              </p>

              <div class="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  class="h-full bg-sky-500 transition-all duration-300"
                  :style="{ width: `${progress}%` }"
                ></div>
              </div>

              <!-- Ek süre -->
              <div
                v-if="running"
                class="flex flex-col sm:flex-row items-center justify-center gap-2 pt-2 text-sm"
              >
                <label class="text-slate-700">Ek Süre (dk):</label>
                <input
                  type="number"
                  min="1"
                  max="120"
                  step="1"
                  class="w-20 rounded-md border border-slate-300 px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                  v-model.number="addMinutes"
                />
                <button
                  type="button"
                  class="rounded-md px-3 py-1.5 font-medium bg-slate-100 hover:bg-slate-200"
                  @click="addExtra()"
                >
                  Ekle
                </button>

                <div class="hidden sm:flex items-center gap-1">
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 bg-slate-100 hover:bg-slate-200"
                    @click="addExtra(5)"
                  >
                    +5 dk
                  </button>
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 bg-slate-100 hover:bg-slate-200"
                    @click="addExtra(10)"
                  >
                    +10 dk
                  </button>
                  <button
                    type="button"
                    class="rounded-md px-2 py-1 bg-slate-100 hover:bg-slate-200"
                    @click="addExtra(15)"
                  >
                    +15 dk
                  </button>
                </div>
              </div>
            </div>

            <!-- Kontroller -->
            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <button
                type="button"
                class="rounded-md px-3 py-2 font-semibold text-sm bg-sky-600 text-white hover:bg-sky-700 disabled:opacity-60"
                @click="start"
                :disabled="!isPremiumActive || running || !canStartNow"
              >
                Başlat
              </button>

              <button
                type="button"
                class="rounded-md px-3 py-2 font-semibold text-sm bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-60"
                @click="togglePause"
                :disabled="!isPremiumActive || !running"
              >
                {{ pauseResumeLabel }}
              </button>

              <button
                type="button"
                class="rounded-md px-3 py-2 font-semibold text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
                @click="finish"
                :disabled="!isPremiumActive || !running"
              >
                Bitir
              </button>

              <button
                type="button"
                class="rounded-md px-3 py-2 font-semibold text-sm bg-slate-100 hover:bg-slate-200 disabled:opacity-60"
                @click="reset"
                :disabled="!isPremiumActive || (running && sec === 0)"
              >
                Sıfırla
              </button>
            </div>
          </div>
          <!-- /KRONOMETRE MODU -->
        </div>

          <!-- NET HESABI -->
          <div class="bg-slate-50 border border-slate-200 rounded-2xl p-6 space-y-6">
            <header class="space-y-1">
              <h2 class="text-xl font-semibold text-slate-800">🧮 Net Hesabı</h2>
              <p class="text-sm text-slate-500">
                Bitirdikten sonra doğru / yanlış sayılarını gir ve sonucu kaydet.
              </p>
            </header>

            <!-- TOPIC MODU: tek satırlık giriş -->
            <div v-if="isTopicMode" class="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div class="flex flex-col space-y-1">
                <label class="text-sm font-medium text-slate-700">Doğru</label>
                <input
                  type="number"
                  min="0"
                  :max="questionCount"
                  class="rounded-md border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                  :disabled="running"
                  v-model.number="singleCorrect"
                />
              </div>

              <div class="flex flex-col space-y-1">
                <label class="text-sm font-medium text-slate-700">Yanlış</label>
                <input
                  type="number"
                  min="0"
                  :max="questionCount"
                  class="rounded-md border border-slate-300 px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-sky-300"
                  :disabled="running"
                  v-model.number="singleWrong"
                />
              </div>
            </div>

            <!-- GENEL MODU: ders tablosu -->
            <div v-else class="space-y-3">
              <div class="overflow-x-auto border border-slate-200 rounded-xl bg-white">
                <table class="min-w-full text-sm">
                  <thead
                    class="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wide"
                  >
                    <tr>
                      <th class="px-3 py-2 text-left font-semibold">Ders</th>
                      <th class="px-3 py-2 text-left font-semibold">Doğru</th>
                      <th class="px-3 py-2 text-left font-semibold">Yanlış</th>
                      <th class="px-3 py-2 text-left font-semibold">Net</th>
                    </tr>
                  </thead>
                  <tbody class="divide-y divide-slate-100">
                    <tr v-for="(r, idx) in rows" :key="idx" class="bg-white">
                      <td class="px-3 py-2 font-medium text-slate-800">
                        {{ r.lessonName }}
                      </td>
                      <td class="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          :max="questionCount"
                          class="w-20 rounded-md border border-slate-300 px-2 py-1 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
                          :disabled="running"
                          v-model.number="r.correct"
                        />
                      </td>
                      <td class="px-3 py-2">
                        <input
                          type="number"
                          min="0"
                          :max="questionCount"
                          class="w-20 rounded-md border border-slate-300 px-2 py-1 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-sky-300 disabled:opacity-60"
                          :disabled="running"
                          v-model.number="r.wrong"
                        />
                      </td>
                      <td class="px-3 py-2 text-slate-800 font-semibold">
                        {{ computeRowNet(r.correct, r.wrong).toFixed(2) }}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

            </div>

            <!-- Özet kart -->
            <div v-if="isTopicMode" class="bg-white border border-slate-100 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <p class="text-3xl font-bold text-sky-600">{{ net.toFixed(2) }} Net</p>
                <p class="text-xs text-slate-500">Formül: Doğru − Yanlış / 4</p>
              </div>

              <div class="text-sm text-slate-600">
                <p>
                  Toplam D/Y/B:
                  <span class="font-medium text-green-600">{{ totalCorrect }}</span>
                  /
                  <span class="font-medium text-red-600">{{ totalWrong }}</span>
                  /
                  <span class="font-medium text-slate-700">{{ totalBlank }}</span>
                </p>

                <p>
                  Süre:
                  <span class="font-medium">
                    {{ Math.floor(sec / 60) }} dk
                    {{ String(sec % 60).padStart(2, "0") }} sn
                  </span>
                </p>

                <p v-if="accuracy >= 0">
                  Başarı:
                  <span class="font-medium">%{{ accuracy.toFixed(1) }}</span>
                </p>
              </div>
            </div>
            

            <!-- Kaydet -->
            <div class="space-y-2">
              <button
                class="w-full rounded-md px-3 py-2 font-semibold text-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-60"
                @click="save"
                :disabled="!isPremiumActive || running || !canSave || saving"
              >
                {{ saving ? "Kaydediliyor…" : "Sonucu Kaydet" }}
              </button>

              <div
                v-if="!isPremiumActive"
                class="flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-amber-800 md:flex-row md:items-center md:justify-between"
              >
                <p class="text-sm font-semibold">
                  Net hesabi kaydetme premium uyeler icindir. Premium'a gecerek denemelerini kaydedebilirsin.
                </p>
                <RouterLink
                  to="/profil"
                  class="inline-flex items-center justify-center rounded-xl border border-amber-300 bg-white px-4 py-2 text-sm font-semibold text-amber-800 shadow-sm transition hover:bg-amber-100"
                >
                  Premium'a gec
                </RouterLink>
              </div>
            </div>
          </div>
        </section>

        <!-- HAFTALIK PERFORMANS -->
        <section class="space-y-4 bg-white border border-slate-200 rounded-2xl p-6">
          <header
            class="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
          >
            <div class="space-y-1">
              <h2 class="text-xl font-semibold text-slate-800">📊 Haftalık Performans</h2>
              <p class="text-xs text-slate-500">
                Bu hafta çözdüğün denemelerin günlük toplamları (aynı müfredat için).
              </p>
            </div>

            <div class="flex items-center gap-2 text-sm">
              <button
                type="button"
                class="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700"
                @click="shiftWeek(-1)"
              >
                ← Önceki Hafta
              </button>

              <button
                type="button"
                class="px-2 py-1 rounded-md bg-slate-100 hover:bg-slate-200 border border-slate-300 text-slate-700"
                @click="shiftWeek(1)"
              >
                Sonraki Hafta →
              </button>
            </div>
          </header>

          <div class="overflow-x-auto border border-slate-200 rounded-2xl">
            <table class="min-w-full divide-y divide-slate-200 text-sm">
              <thead
                class="bg-slate-50 text-slate-600 uppercase text-[11px] tracking-wide"
              >
                <tr>
                  <th class="px-4 py-3 text-left font-semibold">Gün</th>
                  <th class="px-4 py-3 text-left font-semibold">Deneme</th>
                  <th class="px-4 py-3 text-left font-semibold">Toplam Süre</th>
                  <th class="px-4 py-3 text-left font-semibold">Toplam Net</th>
                </tr>
              </thead>
              <tbody class="bg-white divide-y divide-slate-100">
                <tr v-for="d in dailyAgg" :key="d.dayKey" class="hover:bg-sky-50">
                  <td class="px-4 py-3 text-slate-700 font-medium">
                    {{ d.label }}
                  </td>

                  <td class="px-4 py-3 text-slate-700">{{ d.examCount }} adet</td>

                  <td class="px-4 py-3 text-slate-700">{{ d.totalMin }} dk</td>

                  <td class="px-4 py-3 font-bold text-sky-700">
                    {{ d.totalNet.toFixed(2) }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <p v-if="weeklyRows.length === 0" class="text-xs text-slate-500">
            Bu hafta kayıt yok.
          </p>
        </section>

      </div>
    </main>
  </div>
</template>
