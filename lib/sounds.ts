// Simple shared sound helpers for timers
// Uses Web Audio API to synthesize a short "bong" tone

let _ctx: AudioContext | null = null

function getCtx(): AudioContext {
  const AC: any = (window as any).AudioContext || (window as any).webkitAudioContext
  if (!_ctx) _ctx = new AC()
  return _ctx!
}

// Prime/resume audio context on a user gesture so later autoplay works
export async function primeAudio(): Promise<void> {
  try {
    const ctx = getCtx()
    if (ctx.state === 'suspended') await ctx.resume()
  } catch {
    // ignore
  }
}

export function playBong(): void {
  try {
    const ctx = getCtx()
    // If suspended (e.g., not primed), try a best-effort resume
    if (ctx.state === 'suspended') ctx.resume().catch(() => {})

    const t = ctx.currentTime
    const duration = 1.2

    // Main low chime
    const o1 = ctx.createOscillator()
    o1.type = 'sine'
    o1.frequency.setValueAtTime(440, t)
    o1.frequency.exponentialRampToValueAtTime(220, t + duration)

    const g1 = ctx.createGain()
    g1.gain.setValueAtTime(0.0001, t)
    g1.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    g1.gain.exponentialRampToValueAtTime(0.0001, t + duration)

    // A quieter higher partial for bell-like "bong"
    const o2 = ctx.createOscillator()
    o2.type = 'sine'
    o2.frequency.setValueAtTime(660, t)
    o2.frequency.exponentialRampToValueAtTime(330, t + duration)

    const g2 = ctx.createGain()
    g2.gain.setValueAtTime(0.0001, t)
    g2.gain.exponentialRampToValueAtTime(0.15, t + 0.02)
    g2.gain.exponentialRampToValueAtTime(0.0001, t + duration * 0.9)

    o1.connect(g1)
    o2.connect(g2)
    g1.connect(ctx.destination)
    g2.connect(ctx.destination)

    o1.start(t)
    o2.start(t)
    o1.stop(t + duration)
    o2.stop(t + duration)
  } catch {
    // ignore if Web Audio is unavailable
  }
}

