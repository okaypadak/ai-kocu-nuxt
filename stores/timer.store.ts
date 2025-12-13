// src/stores/timer.store.ts
import { defineStore } from 'pinia'

export type TimerMode = 'up' | 'down'

type TimerState = {
    mode: TimerMode          // 'up' | 'down'
    targetMinutes: number    // sadece 'down' için anlamlı (kullanıcının hedefi dk)

    elapsedSec: number       // 'up' modunda toplam geçen süre (saniye)
    remainingSec: number     // 'down' modunda kalan süre (saniye)

    running: boolean         // sayaç aktif mi
    startedAt: number | null // Date.now() ms olarak, en son start/resume anı

    // snapshot'lar:
    // running=true iken eklenen süreyi hesaplamak için başlangıç değerlerini saklıyoruz
    elapsedStartSnapshot: number | null        // up modunda start anındaki elapsedSec
    remainingStartSnapshot: number | null      // down modunda start anındaki remainingSec
}

export const useTimerStore = defineStore('timer', {
    state: (): TimerState => ({
        mode: 'up',
        targetMinutes: 30,

        elapsedSec: 0,
        remainingSec: 30 * 60,

        running: false,
        startedAt: null,

        elapsedStartSnapshot: null,
        remainingStartSnapshot: null,
    }),

    getters: {
        /** hedef saniye (down modu için total referans) */
        totalTargetSec(state): number {
            const mins = state.targetMinutes
            const minSafe = typeof mins === 'number' && mins > 0 ? mins : 1
            return minSafe * 60
        },

        /** UI'da gösterilecek ana saniye */
        displaySec(state): number {
            return state.mode === 'up'
                ? state.elapsedSec
                : state.remainingSec
        },

        /** progress bar yüzdesi */
        progressPct(state): number {
            if (state.mode === 'up') {
                // yukarı modunda görsel referans: 1 saat
                const visualMax = 60 * 60
                if (visualMax <= 0) return 0
                return Math.min(
                    100,
                    Math.round((state.elapsedSec / visualMax) * 100)
                )
            } else {
                // down modunda: hedefin ne kadarını kullandın
                if (this.totalTargetSec <= 0) return 0
                const used = this.totalTargetSec - state.remainingSec
                return Math.min(
                    100,
                    Math.round((used / this.totalTargetSec) * 100)
                )
            }
        },
    },

    actions: {
        /** Dahili sync:
         * running=true ise startedAt'tan şu ana kadar geçen süre ile
         * elapsedSec / remainingSec'i günceller.
         *
         * Bu fonksiyon sayfa açılınca da çağrılıyor ki
         * localStorage'dan restore sonrası zaman doğru olsun.
         */
        _syncNow(nowMs = Date.now()) {
            if (!this.running || this.startedAt === null) return

            const diffSec = Math.max(
                0,
                Math.floor((nowMs - this.startedAt) / 1000)
            )

            if (this.mode === 'up') {
                // up: geçen süre = snapshot + diff
                const base = this.elapsedStartSnapshot ?? this.elapsedSec
                this.elapsedSec = base + diffSec

            } else {
                // down: kalan süre = snapshot - diff
                const base = this.remainingStartSnapshot ?? this.remainingSec
                const left = base - diffSec
                this.remainingSec = left > 0 ? left : 0

                if (left <= 0) {
                    // süre bittiğinde otomatik dur
                    this.running = false
                    this.startedAt = null
                    this.remainingSec = 0
                    this.elapsedStartSnapshot = null
                    this.remainingStartSnapshot = null
                }
            }
        },

        /** modu değiştir (up <-> down)
         * mod değişince zamanlayıcı çalışıyorsa önce durdurup senkronize ediyoruz,
         * çünkü modların mantığı tamamen farklı.
         */
        setMode(m: TimerMode) {
            if (this.running) {
                this.pauseSync()
            }
            this.mode = m

            // down moduna geçtiysek remainingSec'in mantıklı olduğundan emin ol
            if (m === 'down') {
                const tgt = this.totalTargetSec
                if (this.remainingSec <= 0 || this.remainingSec > tgt) {
                    this.remainingSec = tgt
                }
            }
        },

        /** hedef dk ayarla (sadece down için anlamlı ama kaydediyoruz) */
        setTargetMinutes(mins: number) {
            const safe = mins > 0 ? mins : 1
            this.targetMinutes = safe
            const tgt = safe * 60

            // çalışmıyorsa down modunda kalan süreyi yeni hedefe hizala
            if (!this.running && this.mode === 'down') {
                this.remainingSec = tgt
            }
        },

        /** Start / resume */
        start() {
            if (this.running) return

            // down modunda eğer remainingSec saçmaysa toparla
            if (this.mode === 'down') {
                const tgt = this.totalTargetSec
                if (this.remainingSec <= 0 || this.remainingSec > tgt) {
                    this.remainingSec = tgt
                }
            }

            this.running = true
            this.startedAt = Date.now()

            // snapshot'ları anlık değerden dolduruyoruz ki
            // reload + _syncNow() ile doğru devam etsin
            if (this.mode === 'up') {
                this.elapsedStartSnapshot = this.elapsedSec
                this.remainingStartSnapshot = null
            } else {
                this.remainingStartSnapshot = this.remainingSec
                this.elapsedStartSnapshot = null
            }
        },

        /** Duraklat (pause) */
        pauseSync() {
            // önce şu ana kadar olanı işle
            this._syncNow()

            this.running = false
            this.startedAt = null

            // snapshotları temizliyoruz ki
            // tekrar start ederken yeni snapshot alınsın
            this.elapsedStartSnapshot = null
            this.remainingStartSnapshot = null
        },

        /** Tam sıfırla (Sıfırla butonu ya da Kaydet sonrası) */
        hardReset() {
            this.running = false
            this.startedAt = null
            this.elapsedStartSnapshot = null
            this.remainingStartSnapshot = null

            if (this.mode === 'up') {
                this.elapsedSec = 0
            } else {
                this.remainingSec = this.totalTargetSec
            }
        },

        /** Kaydet'e basarken kaç saniye DB'ye yazılacak? */
        getEffectiveSeconds(): number {
            if (this.mode === 'up') {
                return this.elapsedSec
            } else {
                const used = this.totalTargetSec - this.remainingSec
                return used > 0 ? used : 0
            }
        },
    },

    /**
     * localStorage persist:
     * running, startedAt, snapshotlar dahil hepsini kaydediyoruz.
     * Böylece sayfa yenilese bile süre kaldığı yerden hesaplanabilir.
     */
    persist: {
        pick: [
            'mode',
            'targetMinutes',
            'elapsedSec',
            'remainingSec',
            'running',
            'startedAt',
            'elapsedStartSnapshot',
            'remainingStartSnapshot',
        ],
    },
})
