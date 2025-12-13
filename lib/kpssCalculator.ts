type EducationLevel = 'lisans' | 'onlisans' | 'ortaogretim'

type AlanName = 'Hukuk' | 'İktisat' | 'Maliye' | 'İşletme' | 'Muhasebe' | 'Kamu Yönetimi'

interface KpssInput {
    educationLevel: EducationLevel
    gyCorrect: number
    gyWrong: number
    gkCorrect: number
    gkWrong: number
    ebCorrect?: number
    ebWrong?: number
    alanCorrect?: number
    alanWrong?: number
    alanName?: AlanName
}

interface KpssNets {
    netGY: number
    netGK: number
    netEB?: number
    netAlan?: number
}

interface KpssScores {
    P1?: number
    P2?: number
    P3?: number
    P10?: number
    P93?: number
    P94?: number
    alanPuan?: number
}

interface KpssOutput {
    nets: KpssNets
    scores: KpssScores
}

const MAX_GY = 60
const MAX_GK = 60
const MAX_EB = 80
const MAX_ALAN = 60

const round2 = (n: number) => Number(n.toFixed(2))

const normalizeCounts = (
    correct: number | undefined,
    wrong: number | undefined,
    maxQ: number
) => {
    const c = Number(correct ?? 0)
    const w = Number(wrong ?? 0)
    if (!Number.isFinite(c) || !Number.isFinite(w)) {
        throw new Error('Geçersiz sayı girdisi.')
    }
    if (c < 0 || w < 0) {
        throw new Error('Doğru/yanlış negatif olamaz.')
    }
    if (c + w > maxQ) {
        throw new Error(`Toplam doğru+yanlış ${maxQ} soruyu aşamaz.`)
    }
    return { c, w }
}

const calcNet = (correct: number, wrong: number, maxQ: number) => {
    const c = Math.min(Math.max(correct, 0), maxQ)
    const w = Math.min(Math.max(wrong, 0), maxQ)
    const raw = c - w / 4
    return round2(Math.max(0, raw))
}

export function calculateKpss(input: KpssInput): KpssOutput {
    const gy = normalizeCounts(input.gyCorrect, input.gyWrong, MAX_GY)
    const gk = normalizeCounts(input.gkCorrect, input.gkWrong, MAX_GK)

    const netGY = calcNet(gy.c, gy.w, MAX_GY)
    const netGK = calcNet(gk.c, gk.w, MAX_GK)

    const nets: KpssNets = { netGY, netGK }
    const scores: KpssScores = {}

    const p1p3 = round2(50 + netGY * 0.3 + netGK * 0.3)

    if (input.educationLevel === 'lisans') {
        scores.P1 = p1p3
        scores.P3 = p1p3

        if (input.ebCorrect !== undefined || input.ebWrong !== undefined) {
            const eb = normalizeCounts(input.ebCorrect ?? 0, input.ebWrong ?? 0, MAX_EB)
            const netEB = calcNet(eb.c, eb.w, MAX_EB)
            nets.netEB = netEB
            scores.P2 = round2(50 + netGY * 0.15 + netGK * 0.15 + netEB * 0.7)
            scores.P10 = round2(50 + netEB * 1.0)
        }

        if (
            (input.alanCorrect !== undefined || input.alanWrong !== undefined) &&
            input.alanName
        ) {
            const alan = normalizeCounts(
                input.alanCorrect ?? 0,
                input.alanWrong ?? 0,
                MAX_ALAN
            )
            const netAlan = calcNet(alan.c, alan.w, MAX_ALAN)
            nets.netAlan = netAlan
            scores.alanPuan = round2(
                50 + netGY * 0.15 + netGK * 0.15 + netAlan * 0.7
            )
        }
    }

    if (input.educationLevel === 'onlisans') {
        scores.P93 = p1p3
    }

    if (input.educationLevel === 'ortaogretim') {
        scores.P94 = p1p3
    }

    return { nets, scores }
}

// Basit örnek testler (manual)
export const __examples = [
    calculateKpss({
        educationLevel: 'lisans',
        gyCorrect: 45,
        gyWrong: 10,
        gkCorrect: 40,
        gkWrong: 12,
        ebCorrect: 60,
        ebWrong: 15,
    }),
    calculateKpss({
        educationLevel: 'onlisans',
        gyCorrect: 50,
        gyWrong: 5,
        gkCorrect: 48,
        gkWrong: 6,
    }),
    calculateKpss({
        educationLevel: 'lisans',
        gyCorrect: 50,
        gyWrong: 5,
        gkCorrect: 50,
        gkWrong: 5,
        alanName: 'Hukuk',
        alanCorrect: 55,
        alanWrong: 10,
    }),
]

export type { EducationLevel, KpssInput, KpssOutput, KpssNets, KpssScores, AlanName }
