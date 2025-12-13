<!-- src/views/PaymentSuccessView.vue -->
<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'

const router = useRouter()
const seconds = ref(5)

let tick: ReturnType<typeof setInterval> | null = null
let redirectTimer: ReturnType<typeof setTimeout> | null = null

const log = (...args: any[]) => console.log('[PaymentSuccess]', ...args)

const goProfile = () => router.replace({ name: 'profile' })
const closeOrRedirect = () => {
  log('Attempting to close popup after countdown', {
    hasOpener: !!window.opener,
    openerClosed: window.opener?.closed
  })
  try {
    if (window.opener && !window.opener.closed) {
      window.opener.postMessage({ type: 'iyzico-redirect', href: window.location.href }, '*')
      window.close()
      return
    }
  } catch (err) {
    log('closeOrRedirect opener flow failed', err)
  }

  try {
    window.close()
    log('window.close() called without opener')
  } catch (err) {
    log('window.close() without opener failed', err)
  }
  goProfile()
}

const notifyOpener = () => {
  try {
    if (window.opener && !window.opener.closed) {
      log('Sending postMessage to opener', { href: window.location.href, origin: window.location.origin })
      log('Sending postMessage to opener', { href: window.location.href, origin: window.location.origin })
      window.opener.postMessage({ type: 'payment_success' }, '*')
      log('postMessage sent; waiting for countdown to close')
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
  redirectTimer = setTimeout(closeOrRedirect, 5000)
})

onBeforeUnmount(() => {
  log('Before unmount; clearing timers')
  if (tick) clearInterval(tick)
  if (redirectTimer) clearTimeout(redirectTimer)
})
</script>

<template>
  <div class="min-h-screen bg-gradient-to-b from-emerald-50 via-white to-sky-50 flex flex-col justify-center">
    <main class="flex items-center justify-center px-4 py-12">
      <div class="max-w-xl w-full bg-white rounded-3xl shadow-2xl border border-emerald-100 p-8 space-y-6 text-center">
        <div class="mx-auto h-16 w-16 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shadow-inner">
          <svg xmlns="http://www.w3.org/2000/svg" class="h-9 w-9" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M5 13l4 4L19 7" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </div>
        <div class="space-y-2">
          <h1 class="text-3xl font-bold text-emerald-700">Ödeme başarılı!</h1>
          <p class="text-slate-600">
            Premium üyeliğin aktifleştirildi. Birkaç saniye içinde profil sayfasına dönüyorsun.
          </p>
        </div>

        <div class="rounded-2xl bg-emerald-50 border border-emerald-100 px-4 py-3 text-emerald-800 font-semibold">
          {{ seconds }} saniye içinde yönlendiriliyorsun…
        </div>

        <button
            class="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-white font-semibold shadow hover:bg-emerald-700 transition"
            @click="goProfile"
        >
          Hemen profiline dön
          <svg xmlns="http://www.w3.org/2000/svg" class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M9 18l6-6-6-6" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </button>
      </div>
    </main>
  </div>
</template>
