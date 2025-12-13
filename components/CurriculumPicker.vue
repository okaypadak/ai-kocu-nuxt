<script setup lang="ts">
import { computed, ref, watch, onMounted } from "vue";
import { useAuthStore } from "../stores/auth.store";
import { useSections, useLessons, useTopics } from "../queries/useCurricula";
import type { Section, Lesson, Topic } from "../api/curriculum";

type PickerPrefill = {
  curriculumId?: string | null;
  sectionCode?: string | null;
  sectionId?: number | null;
  sectionName?: string | null;
  lessonId?: number | null;
  lessonCode?: string | null;
  lessonName?: string | null;
  topicId?: string | null;
  topicTitle?: string | null;
};

const props = defineProps<{
  /** "topic" => konu dropdown görünsün
   *   "general" => konu dropdown gizlensin
   */
  mode?: "topic" | "general";
  prefill?: PickerPrefill | null;
  storageKey?: string | null;
}>();

const emit = defineEmits<{
  (
    e: "change",
    payload: {
      curriculumId: string | null;
      section: Section | null;
      lesson: Lesson | null;
      topic: Topic | null;
    }
  ): void;
}>();

/* aktif müfredat */
const auth = useAuthStore();
const curriculumId = computed(() => auth.preferredCurriculumId ?? null);

/* Bölümler */
const { data: sections, isPending: sectionsPending } = useSections(
  () => curriculumId.value ?? undefined
);

/**
 * STATE
 * - sectionCode: '' => Seçimsiz
 * - lessonId: null => Seçimsiz
 * - topicId: '' => Seçimsiz
 */
const sectionCode = ref<string>(""); // bölüm.code | '' (seçimsiz)
const lessonId = ref<number | null>(null); // lesson.id | null
const topicId = ref<string>(""); // topic.id | '' (seçimsiz)

// ders id'sini string<->number çevirerek v-model yap
const lessonIdModel = computed({
  get: () => (lessonId.value === null ? "" : lessonId.value),
  set: (value: string | number | null) => {
    if (value === "" || value === null) {
      lessonId.value = null;
      return;
    }
    const numeric = typeof value === "number" ? value : Number(value);
    lessonId.value = Number.isNaN(numeric) ? null : numeric;
  },
});

const selectedSection = computed<Section | null>(() => {
  if (!sectionCode.value) return null;
  return (sections.value ?? []).find((s) => s.code === sectionCode.value) ?? null;
});

/* Dersler (section.id) */
const { data: lessons } = useLessons(() => selectedSection.value?.id);
const selectedLesson = computed<Lesson | null>(() => {
  if (lessonId.value === null) return null;
  return (lessons.value ?? []).find((l) => l.id === lessonId.value) ?? null;
});

/* Konular (lesson.id) */
const { data: topics } = useTopics(() => selectedLesson.value?.id);
const selectedTopic = computed<Topic | null>(() => {
  if (!topicId.value) return null;
  return (topics.value ?? []).find((t) => t.id === topicId.value) ?? null;
});

/* ================= localStorage helpers ================= */

function lsKey() {
  return props.storageKey ? `currpick:${props.storageKey}` : null;
}

function saveToLocalStorage() {
  const key = lsKey();
  if (!key) return;
  try {
    const payload: PickerPrefill = {
      curriculumId: curriculumId.value ?? null,
      sectionCode: sectionCode.value || null,
      sectionId: selectedSection.value?.id ?? null,
      sectionName: selectedSection.value?.name ?? null,
      lessonId: lessonId.value ?? null,
      lessonCode: selectedLesson.value?.code ?? null,
      lessonName: selectedLesson.value?.name ?? null,
      topicId: topicId.value || null,
      topicTitle: selectedTopic.value?.title ?? null,
    };
    localStorage.setItem(key, JSON.stringify(payload));
  } catch (err) {
    console.warn("[CurriculumPicker] ls write failed:", err);
  }
}

function loadFromLocalStorage(): PickerPrefill | null {
  const key = lsKey();
  if (!key) return null;
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return parsed ?? null;
  } catch (err) {
    console.warn("[CurriculumPicker] ls read failed:", err);
    return null;
  }
}

/* ================= prefill mantığı ====================== */

const pendingPrefill = ref<PickerPrefill | null>(null);

function toId(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function sanitizePrefill(src?: PickerPrefill | null): PickerPrefill | null {
  if (!src) return null;
  const cleaned: PickerPrefill = {};

  if (src.sectionCode !== undefined) cleaned.sectionCode = src.sectionCode || null;

  const secId = toId(src.sectionId);
  if (secId !== null) cleaned.sectionId = secId;

  if (src.sectionName !== undefined) cleaned.sectionName = src.sectionName || null;

  const lesId = toId(src.lessonId);
  if (lesId !== null) cleaned.lessonId = lesId;

  if (src.lessonCode !== undefined) cleaned.lessonCode = src.lessonCode || null;
  if (src.lessonName !== undefined) cleaned.lessonName = src.lessonName || null;

  if (src.topicId !== undefined) cleaned.topicId = src.topicId || null;
  if (src.topicTitle !== undefined) cleaned.topicTitle = src.topicTitle || null;

  if (src.curriculumId !== undefined) cleaned.curriculumId = src.curriculumId ?? null;

  return Object.keys(cleaned).length ? cleaned : null;
}

function findTopicByAnyId(topicList: Topic[], value?: string | null) {
  if (!value) return null;
  return (
    topicList.find((t) => t.id === value) ||
    topicList.find((t) => t.uuid === value)
  ) ?? null;
}

/** pendingPrefill belirle:
 * 1) props.prefill
 * 2) yoksa localStorage
 */
function refreshPendingPrefill() {
  const fromProp = sanitizePrefill(props.prefill ?? null);
  if (fromProp) {
    pendingPrefill.value = fromProp;
    return;
  }
  const fromLS = sanitizePrefill(loadFromLocalStorage());
  if (fromLS) {
    pendingPrefill.value = fromLS;
    return;
  }
  pendingPrefill.value = null;
}

/** pendingPrefill -> gerçek dropdownlara uygula.
 * Eğer data henüz gelmediyse (dersler/topics yok), bırak
 * watcher'lar tekrar dener.
 */
function tryApplyPrefill() {
  const pref = pendingPrefill.value;
  if (!pref) return;

  const sectionList = sections.value ?? [];
  const lessonList = lessons.value ?? [];
  const topicList = topics.value ?? [];

  // SECTION
  if (pref.sectionCode || pref.sectionId !== undefined || pref.sectionName) {
    if (
      pref.sectionCode === null &&
      pref.sectionId === undefined &&
      pref.sectionName === null
    ) {
      sectionCode.value = "";
    } else {
      const targetSection =
        (pref.sectionCode && sectionList.find((s) => s.code === pref.sectionCode)) ||
        (pref.sectionId !== undefined &&
          sectionList.find((s) => s.id === pref.sectionId)) ||
        (pref.sectionName && sectionList.find((s) => s.name === pref.sectionName));

      if (!targetSection) {
        return;
      }
      if (sectionCode.value !== targetSection.code) {
        sectionCode.value = targetSection.code;
      }
    }
  }

  // LESSON
  if (pref.lessonId !== undefined || pref.lessonCode || pref.lessonName) {
    if (pref.lessonId === undefined && !pref.lessonCode && !pref.lessonName) {
      lessonId.value = null;
    } else {
      if (!lessonList.length) return;
      const targetLesson =
        (pref.lessonId !== undefined && lessonList.find((l) => l.id === pref.lessonId)) ||
        (pref.lessonCode && lessonList.find((l) => l.code === pref.lessonCode)) ||
        (pref.lessonName && lessonList.find((l) => l.name === pref.lessonName));

      if (!targetLesson) {
        return;
      }
      if (lessonId.value !== targetLesson.id) {
        lessonId.value = targetLesson.id;
      }
    }
  }

  // TOPIC (sadece topic modunda anlamlı ama yine de state'i dolduralım)
  if (pref.topicId || pref.topicTitle) {
    if (!pref.topicId && !pref.topicTitle) {
      topicId.value = "";
    } else {
      if (!topicList.length) return;
      const targetTopic =
        (pref.topicId && findTopicByAnyId(topicList, pref.topicId)) ||
        (pref.topicTitle && topicList.find((t) => t.title === pref.topicTitle));

      if (!targetTopic) {
        return;
      }
      if (topicId.value !== targetTopic.id) {
        topicId.value = targetTopic.id;
      }
    }
  }

  pendingPrefill.value = null;
}

/* ================= WATCH / INIT ========================= */

refreshPendingPrefill();

watch(
  () => props.prefill,
  () => {
    refreshPendingPrefill();
    tryApplyPrefill();
  },
  { deep: true }
);

// müfredat değişince hepsini sıfırla
watch(curriculumId, () => {
  sectionCode.value = "";
  lessonId.value = null;
  topicId.value = "";
  tryApplyPrefill();
});

// bölüm değişince alt seviyeleri resetle
watch(selectedSection, () => {
  lessonId.value = null;
  topicId.value = "";
  tryApplyPrefill();
});

// dersler geldikçe
watch(lessons, (rows) => {
  if (!rows?.length) {
    lessonId.value = null;
    topicId.value = "";
    return;
  }
  if (!rows.find((l) => l.id === lessonId.value)) {
    lessonId.value = null;
    topicId.value = "";
  }
  tryApplyPrefill();
});

// ders değişince konu resetle
watch(selectedLesson, () => {
  topicId.value = "";
  tryApplyPrefill();
});

// konular geldikçe
watch(topics, (rows) => {
  if (!rows?.length) {
    topicId.value = "";
    return;
  }
  if (!rows.find((t) => t.id === topicId.value)) {
    // artık otomatik ilk konuyu seçmiyoruz
    topicId.value = "";
  }
  tryApplyPrefill();
});

/**
 * her değişim:
 * - parent'e emit('change', {...})
 * - localStorage kaydet
 */
watch(
  [
    curriculumId,
    selectedSection,
    selectedLesson,
    selectedTopic,
    sectionCode,
    lessonId,
    topicId,
  ],
  () => {
    emit("change", {
      curriculumId: curriculumId.value,
      section: selectedSection.value ?? null,
      lesson: selectedLesson.value ?? null,
      topic: selectedTopic.value ?? null,
    });
    saveToLocalStorage();
  },
  { immediate: true }
);

/* mount sonrası bir kere daha dene */
onMounted(() => {
  tryApplyPrefill();
});

/* UI koşulu: Genel moddaysak konu dropdown'unu hiç göstermeyeceğiz */
const showTopic = computed(() => props.mode !== "general");
const sectionPlaceholder = computed(() =>
  props.mode === "general" ? "Genel Sınav" : "— Seçimsiz —"
);
const layoutClass = computed(() =>
  showTopic.value
    ? "grid grid-cols-1 md:grid-cols-3 gap-3"
    : "grid grid-cols-1 md:grid-cols-2 gap-3"
);
</script>

<template>
  <div :class="layoutClass">
    <!-- Bölüm -->
    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-slate-700">Bölüm</label>
      <select
        class="form-select"
        v-model="sectionCode"
        :disabled="sectionsPending || !curriculumId"
      >
        <option value="">{{ sectionPlaceholder }}</option>
        <option v-for="s in sections ?? []" :key="s.id" :value="s.code">
          {{ s.name }}
        </option>
      </select>
    </div>

    <!-- Ders -->
    <div class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-slate-700">Ders</label>
      <select class="form-select" v-model="lessonIdModel" :disabled="!selectedSection">
        <option value="">— Seçimsiz —</option>
        <option v-for="l in lessons ?? []" :key="l.id" :value="l.id">
          {{ l.name }}
        </option>
      </select>
    </div>

    <!-- Konu (sadece topic modunda görünür) -->
    <div v-if="showTopic" class="flex flex-col gap-1">
      <label class="text-sm font-semibold text-slate-700">Konu</label>
      <select class="form-select" v-model="topicId" :disabled="!selectedLesson">
        <option value="">— Seçimsiz —</option>
        <option v-for="t in topics ?? []" :key="t.id" :value="t.id">
          {{ t.title }}
        </option>
      </select>
    </div>
  </div>
</template>

<style scoped>
@reference "tailwindcss";

.form-select {
  @apply w-full px-4 py-2 rounded-lg border border-gray-300 bg-blue-50
    focus:outline-none focus:ring-2 focus:ring-sky-300
    disabled:opacity-60 disabled:cursor-not-allowed appearance-none;
  background-image: url("data:image/svg+xml,%3Csvg fill='none' stroke='%236b7280' stroke-width='2' viewBox='0 0 24 24' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E");
  background-repeat: no-repeat;
  background-position: right 1rem center;
  background-size: 1.25em;
  color: #0f172a;
}

:global(.dark) .form-select {
  color: #000;
}
</style>
