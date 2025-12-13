<!-- src/views/CurriculumImportView.vue -->
<script setup lang="ts">
import { ref, computed } from 'vue'
import Navbar from '../components/Navbar.vue'
import { useQueryClient } from '@tanstack/vue-query'
import { qk } from '../queries/keys'
import { CurriculumImportAPI, computeStats, suggestIdForOne, type CurriculumDoc, type ImportOptions } from '../api/curriculumImport'

/* ---- UI State ---- */
const jsonText = ref<string>('')
const parsed = ref<CurriculumDoc | CurriculumDoc[] | null>(null)
const parseError = ref<string>('')

const stats = ref<{ sections: number; lessons: number; topics: number } | null>(null)

/* Tek doküman için id alanları */
const suggestedId = ref<string>('')
const overrideId = ref<string>('')

/* Import seçenekleri */
const mergeMode = ref<boolean>(true)
const preferExamTitle = ref<boolean>(true)
const importing = ref<boolean>(false)

const successMsg = ref<string>('')
const errorMsg = ref<string>('')

const resultIds = ref<string[]>([])

const isArray = computed(() => Array.isArray(parsed.value))
const canImport = computed(() => !!parsed.value && !importing.value)

/* ---- Preview ---- */
function onPreview() {
  parseError.value = ''
  parsed.value = null
  stats.value = null
  successMsg.value = ''
  errorMsg.value = ''
  resultIds.value = []
  suggestedId.value = ''
  overrideId.value = ''

  try {
    const obj = JSON.parse(jsonText.value || '')
    if (Array.isArray(obj)) {
      if (!obj.length) throw new Error('Boş dizi içe aktarılamaz.')
      parsed.value = obj as CurriculumDoc[]
      stats.value = computeStats(obj)
    } else {
      parsed.value = obj as CurriculumDoc
      suggestedId.value = suggestIdForOne(parsed.value)
      stats.value = computeStats([parsed.value])
    }
  } catch (e: any) {
    parseError.value = e?.message || 'JSON ayrıştırılamadı.'
  }
}

/* ---- Import ---- */
const qc = useQueryClient()

async function onImport() {
  if (!parsed.value) return
  importing.value = true
  errorMsg.value = ''
  successMsg.value = ''
  resultIds.value = []

  try {
    const opts: ImportOptions = {
      id: !Array.isArray(parsed.value) ? (overrideId.value?.trim() || suggestedId.value?.trim()) : undefined,
      merge: !!mergeMode.value,
      preferExamTitle: !!preferExamTitle.value,
    }

    let ids: string[] = []
    if (Array.isArray(parsed.value)) {
      ids = await CurriculumImportAPI.upsertMany(parsed.value as CurriculumDoc[], opts)
    } else {
      const id = await CurriculumImportAPI.upsertOne(parsed.value as CurriculumDoc, opts)
      ids = [id]
    }

    resultIds.value = ids
    successMsg.value = Array.isArray(parsed.value)
        ? `${ids.length} doküman içe aktarıldı.`
        : `“${ids[0]}” id'li doküman içe aktarıldı.`

    // Liste cache’lerini invalidation (müfredat/sections)
    qc.invalidateQueries({ queryKey: qk.curricula })
    ids.forEach((id) => qc.invalidateQueries({ queryKey: qk.sections(id) }))
  } catch (e: any) {
    errorMsg.value = e?.message || 'İçe aktarma başarısız.'
  } finally {
    importing.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-sky-100 flex flex-col">
    <!-- Header -->
    <header class="px-4">
      <Navbar />
    </header>

    <!-- Main (ProfileView ile aynı kalıp) -->
    <main class="flex-grow flex justify-center items-start px-4 py-8">
      <div class="w-full max-w-6xl bg-white rounded-[24px] shadow-2xl p-6 sm:p-8 space-y-8">
        <!-- Başlık -->
        <header class="text-center space-y-2">
          <h1 class="text-3xl font-bold text-sky-700">📥 Müfredat JSON İçe Aktar</h1>
          <p class="text-slate-600">
            JSON'u metin kutusuna yapıştırın, önizleyin ve
            <span class="font-semibold">curriculum</span> tablolarına kaydedin.
          </p>
        </header>

        <!-- JSON Girişi -->
        <section class="space-y-3">
          <label class="text-sm font-semibold text-slate-700">JSON</label>
          <textarea
              class="w-full min-h-[220px] rounded-xl border border-slate-200 p-3 focus:outline-none focus:ring-2 focus:ring-sky-400"
              placeholder='Buraya tek doküman veya doküman dizisi ([]) olarak JSON yapıştırın'
              v-model="jsonText"
          ></textarea>

          <div class="flex items-center gap-3">
            <button
                class="rounded-xl px-4 py-2 border border-sky-200 text-sky-700 font-semibold hover:bg-sky-50 active:scale-[0.98] transition"
                @click="onPreview"
            >
              Önizle
            </button>
            <span v-if="parseError" class="text-sm text-red-600">{{ parseError }}</span>
          </div>
        </section>

        <!-- Önizleme -->
        <section v-if="parsed" class="space-y-4">
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div class="bg-sky-50 border border-sky-100 rounded-xl p-4">
              <div class="text-xs text-slate-500">Tür</div>
              <div class="text-lg font-semibold text-slate-800">
                {{ isArray ? 'Çoklu (Array)' : 'Tek Doküman' }}
              </div>
            </div>
            <div class="bg-sky-50 border border-sky-100 rounded-xl p-4">
              <div class="text-xs text-slate-500">İstatistik</div>
              <div class="text-sm text-slate-700">
                Bölüm: <span class="font-semibold">{{ stats?.sections || 0 }}</span>,
                Ders: <span class="font-semibold">{{ stats?.lessons || 0 }}</span>,
                Konu: <span class="font-semibold">{{ stats?.topics || 0 }}</span>
              </div>
            </div>
            <div class="bg-sky-50 border border-sky-100 rounded-xl p-4">
              <div class="text-xs text-slate-500">Hedef</div>
              <div class="text-lg font-semibold text-slate-800">curriculum_json + ilgili tablolar</div>
            </div>
          </div>

          <!-- Tek doküman ise ID önerisi / override -->
          <div v-if="!isArray" class="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Önerilen ID</label>
              <input
                  class="w-full rounded-xl border border-slate-200 p-2"
                  :value="suggestedId"
                  readonly
              />
              <p class="text-xs text-slate-500">İstersen aşağıdaki “Belirtilen ID” ile override edebilirsin.</p>
            </div>

            <div class="space-y-2">
              <label class="text-sm font-semibold text-slate-700">Belirtilen ID (opsiyonel)</label>
              <input
                  class="w-full rounded-xl border border-slate-200 p-2"
                  placeholder="ör. kpss-on-lisans-2025"
                  v-model="overrideId"
              />
            </div>
          </div>

          <!-- Import seçenekleri -->
          <div class="grid grid-cols-1 md:grid-cols-3 gap-4">
            <label class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <input type="checkbox" class="size-4" v-model="mergeMode" />
              <span class="text-sm text-slate-700">Merge (varsa alanları birleştir)</span>
            </label>

            <label class="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
              <input type="checkbox" class="size-4" v-model="preferExamTitle" />
              <span class="text-sm text-slate-700"><code>title</code> alanını <code>exam</code> ile eşitle</span>
            </label>

            <div class="flex items-center">
              <button
                  class="w-full rounded-xl px-4 py-2 bg-sky-600 text-white font-semibold hover:bg-sky-700 active:scale-[0.98] transition disabled:opacity-60 disabled:cursor-not-allowed"
                  :disabled="!canImport"
                  @click="onImport"
              >
                {{ importing ? 'İçe aktarılıyor…' : 'İçe Aktar' }}
              </button>
            </div>
          </div>

          <!-- Sonuç / Hatalar -->
          <div v-if="successMsg" class="rounded-xl border border-green-200 bg-green-50 p-3 text-green-800 text-sm">
            {{ successMsg }}
            <div v-if="resultIds.length" class="mt-1 text-xs text-green-700">
              ID'ler: {{ resultIds.join(', ') }}
            </div>
          </div>
          <div v-if="errorMsg" class="rounded-xl border border-red-200 bg-red-50 p-3 text-red-800 text-sm">
            {{ errorMsg }}
          </div>
        </section>
      </div>
    </main>
  </div>
</template>
