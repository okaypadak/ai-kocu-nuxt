<!-- src/views/PaymentFailureView.vue -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const seconds = ref(5)

let tick: ReturnType<typeof setInterval> | null = null
let redirectTimer: ReturnType<typeof setTimeout> | null = null

const log = (...args: any[]) => console.log('[PaymentFailure]', ...args)

const goProfile = () => router.replace({ name: 'profile' })
const notifyOpener = () => {
  try {
    if (window.opener && !window.opener.closed) {
      log('Sending postMessage to opener', { href: window.location.href, origin: window.location.origin })
      const errorMsg = new URLSearchParams(window.location.search).get('msg')
      window.opener.postMessage({ type: 'payment_failure', message: errorMsg }, '*')
      log('postMessage sent; attempting to close window')
      window.close()
    } else {
      log('No opener found or opener closed', { openerExists: !!window.opener })
    }
  } catch (err) {
    log('postMessage/close failed', err)
  }
}

onMounted(() => {
  log('Mounted', {
    href: window.location.href,
    origin: window.location.origin,
    openerExists: !!window.opener,
    openerClosed: window.opener?.closed
  })
  notifyOpener()
  tick = setInterval(() => {
    log('Tick', { seconds: seconds.value })
    seconds.value = Math.max(1, seconds.value - 1)
  }, 1000)
  log('Setting redirect timeout to profile in 5000ms')
  redirectTimer = setTimeout(goProfile, 5000)
})

onBeforeUnmount(() => {
  log('Before unmount; clearing timers')
  if (tick) clearInterval(tick)
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-rose-50 via-white to-slate-50 flex flex-col justify-center">
    <main class="flex items-center justify-center px-4 py-12">
      <div class="max-w-xl w-full bg-white rounded-3xl shadow-2xl border border-rose-100 p-8 space-y-6 text-center">
        <div class="mx-auto h-16 w-16 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M18 6L6 18" stroke-linecap="round" stroke-linejoin="round" />
            <path d="M6 6l12 12" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="space-y-2">
          <h1 class="text-3xl font-bold text-rose-600">Ödeme başarısız</h1>
          <p class="text-slate-600">
            Kart işleminde bir sorun oluştu. Sorun devam ederse bankanın destek hattı ya da bizimle iletişime geçebilirsin.
          </p>
        </div>

        <div class="rounded-2xl bg-rose-50 border border-rose-100 px-4 py-3 text-rose-800 font-semibold">
          {{ seconds }} saniye sonra profiline dönülüyor.
        </div>

        <button
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 px-5 py-2.5 text-white font-semibold shadow hover:bg-rose-700 transition"
            @click="goProfile"
        >
          Profilime geri dön
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </main>
  </div>
</template>
