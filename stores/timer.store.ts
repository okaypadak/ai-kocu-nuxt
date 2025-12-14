import { defineStore } from 'pinia'

export type TimerMode = 'up' | 'down'

type TimerState = {
    mode: TimerMode
    targetMinutes: number

    elapsedSec: number
    remainingSec: number
    running: boolean
    startedAt: number | null

    elapsedStartSnapshot: number | null
    remainingStartSnapshot: number | null
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
        totalTargetSec(state): number {
            const mins = state.targetMinutes
            const minSafe = typeof mins === 'number' && mins > 0 ? mins : 1
            return minSafe * 60
        },

        displaySec(state): number {
            return state.mode === 'up'
                ? state.elapsedSec
                : state.remainingSec
        },

        progressPct(state): number {
            if (state.mode === 'up') {
                const visualMax = 60 * 60
                if (visualMax <= 0) return 0
                return Math.min(
                    100,
                    Math.round((state.elapsedSec / visualMax) * 100)
                )
            } else {
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
        _syncNow(nowMs = Date.now()) {
            if (!this.running || this.startedAt === null) return

            const diffSec = Math.max(
                0,
                Math.floor((nowMs - this.startedAt) / 1000)
            )

            if (this.mode === 'up') {
                const base = this.elapsedStartSnapshot ?? this.elapsedSec
                this.elapsedSec = base + diffSec

            } else {
                const base = this.remainingStartSnapshot ?? this.remainingSec
                const left = base - diffSec
                this.remainingSec = left > 0 ? left : 0

                if (left <= 0) {
                    this.running = false
                    this.startedAt = null
                    this.remainingSec = 0
                    this.elapsedStartSnapshot = null
                    this.remainingStartSnapshot = null
                }
            }
        },

        setMode(m: TimerMode) {
            if (this.running) {
                this.pauseSync()
            }
            this.mode = m

            if (m === 'down') {
                const tgt = this.totalTargetSec
                if (this.remainingSec <= 0 || this.remainingSec > tgt) {
                    this.remainingSec = tgt
                }
            }
        },

        setTargetMinutes(mins: number) {
            const safe = mins > 0 ? mins : 1
            this.targetMinutes = safe
            const tgt = safe * 60

            if (!this.running && this.mode === 'down') {
                this.remainingSec = tgt
            }
        },

        start() {
            if (this.running) return

            if (this.mode === 'down') {
                const tgt = this.totalTargetSec
                if (this.remainingSec <= 0 || this.remainingSec > tgt) {
                    this.remainingSec = tgt
                }
            }

            this.running = true
            this.startedAt = Date.now()

            if (this.mode === 'up') {
                this.elapsedStartSnapshot = this.elapsedSec
                this.remainingStartSnapshot = null
            } else {
                this.remainingStartSnapshot = this.remainingSec
                this.elapsedStartSnapshot = null
            }
        },

        pauseSync() {
            this._syncNow()

            this.running = false
            this.startedAt = null

            this.elapsedStartSnapshot = null
            this.remainingStartSnapshot = null
        },

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

        getEffectiveSeconds(): number {
            if (this.mode === 'up') {
                return this.elapsedSec
            } else {
                const used = this.totalTargetSec - this.remainingSec
                return used > 0 ? used : 0
            }
        },
    },

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
