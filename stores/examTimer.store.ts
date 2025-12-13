// src/stores/examTimer.store.ts
import { defineStore } from 'pinia'

type SectionSnap = {
    sectionName: string | null
    sectionId: number | null
    lessonName: string | null
    lessonId: number | null
}

type ExamTimerState = {
    running: boolean
    paused: boolean

    // zaman ölçümü
    startedAtMs: number | null      // en son "resume" anının Date.now() ms
    accumulatedMs: number           // önceki turlardan biriken ms
    cachedSec: number               // son syncNow() sonucu saniye (UI buradan okuyor)

    // süre planı
    plannedMinutes: number          // hedef süre dk
    addMinutes: number              // UI'daki ek süre alanı (varsayılan 5 dk)

    // sınav bilgileri
    questionCount: number
    correct: number
    wrong: number
    blank: number

    // hangi konuya kaydedilecek? start anındaki snapshot
    activeSectionName: string | null
    activeSectionId: number | null
    activeLessonName: string | null
    activeLessonId: number | null

    startedAtISO: string | null
    finishedAtISO: string | null
}

export const useExamTimerStore = defineStore('examTimer', {
    state: (): ExamTimerState => ({
        running: false,
        paused: false,

        startedAtMs: null,
        accumulatedMs: 0,
        cachedSec: 0,

        plannedMinutes: 45,
        addMinutes: 5,

        questionCount: 20,
        correct: 0,
        wrong: 0,
        blank: 0,

        activeSectionName: null,
        activeSectionId: null,
        activeLessonName: null,
        activeLessonId: null,

        startedAtISO: null,
        finishedAtISO: null,
    }),

    getters: {
        /** şu anki toplam süre (saniye) - bile bile cachedSec'i dönüyoruz */
        sec(state): number {
            return state.cachedSec
        },

        /** progress bar yüzdesi */
        progressPct(state): number {
            const total = (state.plannedMinutes || 0) * 60 || 1
            return Math.min(100, Math.round((state.cachedSec / total) * 100))
        },

        /** pause/duraklat butonu label */
        pauseResumeLabel(state): string {
            return state.paused ? 'Devam Et' : 'Duraklat'
        },
    },

    actions: {
        /** her 1 saniyede çağırılır -> cachedSec güncellenir */
        syncNow(nowMs = Date.now()) {
            let totalMs = this.accumulatedMs
            if (this.running && !this.paused && this.startedAtMs !== null) {
                totalMs += nowMs - this.startedAtMs
            }
            const nextSec = Math.max(0, Math.floor(totalMs / 1000))
            if (nextSec !== this.cachedSec) {
                this.cachedSec = nextSec
            }
        },

        /** sınavı başlat */
        start(snap: SectionSnap) {
            if (this.running) return
            this.running = true
            this.paused = false

            this.startedAtMs = Date.now()
            this.accumulatedMs = 0
            this.cachedSec = 0

            // net sayacı temizle
            this.correct = 0
            this.wrong = 0
            this.blank = 0

            this.startedAtISO = new Date().toISOString()
            this.finishedAtISO = null

            // o anki seçim snapshot
            this.activeSectionName = snap.sectionName
            this.activeSectionId = snap.sectionId
            this.activeLessonName = snap.lessonName
            this.activeLessonId = snap.lessonId
        },

        /** duraklat */
        pause() {
            if (!this.running || this.paused) return
            this.syncNow()
            if (this.startedAtMs !== null) {
                this.accumulatedMs += Date.now() - this.startedAtMs
            }
            this.paused = true
            this.startedAtMs = null
        },

        /** devam et */
        resume() {
            if (!this.running || !this.paused) return
            this.paused = false
            this.startedAtMs = Date.now()
        },

        /** bitir (süre saymayı kapat) */
        finish() {
            if (!this.running) return
            this.syncNow()

            // final toplama
            if (this.startedAtMs !== null) {
                this.accumulatedMs += Date.now() - this.startedAtMs
            }

            this.running = false
            this.paused = false
            this.startedAtMs = null
            this.finishedAtISO = new Date().toISOString()

            // son kez senkronla
            this.syncNow()
        },

        /** tamamen sıfırla (plana ve soru sayısına dokunmadan) */
        reset() {
            this.running = false
            this.paused = false
            this.startedAtMs = null
            this.accumulatedMs = 0
            this.cachedSec = 0

            this.correct = 0
            this.wrong = 0
            this.blank = 0

            this.startedAtISO = null
            this.finishedAtISO = null

            this.activeSectionName = null
            this.activeSectionId = null
            this.activeLessonName = null
            this.activeLessonId = null
        },

        /** planlanan süreyi artır (+5 dk vs) */
        addExtra(minutes: number) {
            const v = Number(minutes)
            if (!Number.isFinite(v) || v <= 0) return
            const next = Number(this.plannedMinutes || 0) + v
            // güvenli clamp
            this.plannedMinutes = Math.max(1, Math.min(600, next))
        },
    },

    // localStorage persist
    persist: {
        pick: [
            'running',
            'paused',
            'startedAtMs',
            'accumulatedMs',
            'cachedSec',
            'plannedMinutes',
            'addMinutes',
            'questionCount',
            'correct',
            'wrong',
            'blank',
            'activeSectionName',
            'activeSectionId',
            'activeLessonName',
            'activeLessonId',
            'startedAtISO',
            'finishedAtISO',
        ],
    },
})
