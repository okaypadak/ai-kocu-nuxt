// src/stores/pomodoro.store.ts
import { defineStore } from 'pinia'

export type PomodoroPhase = 'work' | 'break' | 'done'
export type PomodoroScheme = '25/5' | '40/10'

type PomodoroState = {
    // kullanıcı konfig
    scheme: PomodoroScheme          // "25/5" veya "40/10"
    setsPlanned: number             // toplam planlanan set (örn 4)

    // ilerleme durumu
    currentSet: number              // şu an hangi setteyiz (1-based)
    phase: PomodoroPhase            // 'work' | 'break' | 'done'

    // sayaç
    running: boolean                // şu an aktif akıyor mu?
    startedAt: number | null        // faz başlangıcının Date.now() ms değeri
    phaseElapsedSec: number         // bu fazda şu ana kadar geçen saniye
    phaseElapsedSnapshot: number | null // start anındaki phaseElapsedSec (resume için)

    // toplam çalışma süresi
    // biten work fazlarının toplam süresi (saniye)
    totalWorkAccum: number
}

export const usePomodoroStore = defineStore('pomodoro', {
    state: (): PomodoroState => ({
        scheme: '25/5',
        setsPlanned: 4,

        currentSet: 1,
        phase: 'work',

        running: false,
        startedAt: null,
        phaseElapsedSec: 0,
        phaseElapsedSnapshot: null,

        totalWorkAccum: 0,
    }),

    getters: {
        workMinutes(state): number {
            return state.scheme === '25/5' ? 25 : 40
        },
        breakMinutes(state): number {
            return state.scheme === '25/5' ? 5 : 10
        },
        /** Bu fazın toplam uzunluğu (saniye) */
        phaseTotalSec(): number {
            if (this.phase === 'work') {
                return this.workMinutes * 60
            }
            if (this.phase === 'break') {
                return this.breakMinutes * 60
            }
            return 0 // done
        },
        /** Kalan saniye (UI için geri sayım) */
        remainingSec(): number {
            const total = this.phaseTotalSec
            if (total <= 0) return 0
            const left = total - this.phaseElapsedSec
            return left > 0 ? left : 0
        },
        /** İlerleme yüzdesi (faz içinde) */
        progressPct(): number {
            const total = this.phaseTotalSec
            if (total <= 0) return 100
            return Math.min(
                100,
                Math.round((this.phaseElapsedSec / total) * 100)
            )
        },
        /** Faz label */
        phaseLabel(): string {
            if (this.phase === 'work') return 'Çalışma'
            if (this.phase === 'break') return 'Mola'
            return 'Bitti'
        },
        /** DB'ye kaydederken kullanılacak toplam çalışma saniyesi */
        effectiveStudySeconds(): number {
            // totalWorkAccum: bitmiş work fazlarının toplamı
            // eğer faz "work" ise yarım kalan current work fazını da ekle
            let sec = this.totalWorkAccum
            if (this.phase === 'work') {
                sec += this.phaseElapsedSec
            }
            return sec
        },
    },

    actions: {
        /** Şemayı değiştir (25/5 <-> 40/10) */
        setScheme(newScheme: PomodoroScheme) {
            if (this.running) {
                // koşarken şema değiştirmeye izin vermeyeceğiz
                return
            }
            this.scheme = newScheme
        },

        /** Planlanan set sayısını değiştir */
        setSetsPlanned(n: number) {
            if (this.running) return
            const safe = n > 0 ? n : 1
            this.setsPlanned = safe
        },

        /** Dahili sync: startAt + snapshot'tan bu fazda kaç saniye geçtiğini hesapla */
        syncNow(nowMs = Date.now()) {
            if (!this.running || this.startedAt === null) return
            const diffSec = Math.max(
                0,
                Math.floor((nowMs - this.startedAt) / 1000)
            )
            const base = this.phaseElapsedSnapshot ?? this.phaseElapsedSec
            this.phaseElapsedSec = base + diffSec

            // Fazın süresi doldu mu?
            const total = this.phaseTotalSec
            if (total > 0 && this.phaseElapsedSec >= total) {
                // Faz tamamlandı, sonraki faza geç
                this._advancePhaseAfterFinish()
            }
        },

        /** Pomodoro'yu başlat / devam ettir */
        start() {
            if (this.running) return

            // Eğer her şey bittiyse (phase === 'done'), tekrar başlatmak için resetle
            if (this.phase === 'done') {
                this.resetAll()
            }

            this.running = true
            this.startedAt = Date.now()
            this.phaseElapsedSnapshot = this.phaseElapsedSec
        },

        /** Duraklat */
        pause() {
            this.syncNow()
            this.running = false
            this.startedAt = null
            this.phaseElapsedSnapshot = null
        },

        /** Tüm pomodoro akışını başa sar */
        resetAll() {
            this.running = false
            this.startedAt = null
            this.phaseElapsedSnapshot = null

            // set sayısı / şema sabit kalsın (kullanıcı seçimi)
            this.currentSet = 1
            this.phase = 'work'
            this.phaseElapsedSec = 0
            this.totalWorkAccum = 0
        },

        /** Faz bittiyse burayı çağırıyoruz:
         * - work biterse: çalışma süresini totalWorkAccum'a ekle,
         *   eğer son set ise phase='done', yoksa mola'ya geç
         * - break biterse: sonraki set'e geç, work fazına dön
         */
        _advancePhaseAfterFinish() {
            // fazı kapatmadan önce çalışma süresi toplama
            if (this.phase === 'work') {
                this.totalWorkAccum += this.workMinutes * 60

                // son set miydi?
                if (this.currentSet >= this.setsPlanned) {
                    // tamamen bitti
                    this.phase = 'done'
                    this.phaseElapsedSec = 0
                    this.running = false
                    this.startedAt = null
                    this.phaseElapsedSnapshot = null
                    return
                }

                // mola sürecine geç
                this.phase = 'break'
                this.phaseElapsedSec = 0
                this.startedAt = Date.now()
                this.phaseElapsedSnapshot = 0
                this.running = true
                return
            }

            if (this.phase === 'break') {
                // yeni sete başla
                this.currentSet += 1

                if (this.currentSet > this.setsPlanned) {
                    // güvenlik: teoride work fazından sonra done'a girmiş olmalıydık
                    this.phase = 'done'
                    this.phaseElapsedSec = 0
                    this.running = false
                    this.startedAt = null
                    this.phaseElapsedSnapshot = null
                    return
                }

                this.phase = 'work'
                this.phaseElapsedSec = 0
                this.startedAt = Date.now()
                this.phaseElapsedSnapshot = 0
                this.running = true
                return
            }

            if (this.phase === 'done') {
                // zaten done, dokunma
                this.running = false
                this.startedAt = null
                this.phaseElapsedSnapshot = null
            }
        },
    },

    /**
     * localStorage persist:
     * Burada sadece kullanıcı konfig ve akış state'ini saklıyoruz.
     *
     * NOT: Bu şu an "çıktığın yerde" devam etmeni sağlar.
     * Tarayıcı yeniden açınca bile kaldığın set, faz, geçen süre vs duruyor.
     */
    persist: {
        pick: [
            'scheme',
            'setsPlanned',

            'currentSet',
            'phase',

            'running',
            'startedAt',
            'phaseElapsedSec',
            'phaseElapsedSnapshot',

            'totalWorkAccum',
        ],
    },
})
