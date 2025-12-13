<!-- src/views/VerifyEmailView.vue -->
<script setup lang="ts">
import { ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()

const sending = ref(false)
const msg = ref<string | null>(null)
const err = ref<string | null>(null)
const checking = ref(false)

async function resend() {
  sending.value = true; msg.value = null; err.value = null
  try {
    await auth.resendVerificationEmail()
    msg.value = 'Doğrulama e-postası tekrar gönderildi.'
  } catch (e:any) {
    err.value = e?.message ?? 'E-posta gönderilemedi.'
  } finally {
    sending.value = false
  }
}

async function checkAgain() {
  checking.value = true
  try {
    // Session’ı yenile
    await auth.init()
    if (auth.isEmailVerified) {
      const back = (route.query.redirect as string) || { name: 'profile' }
      router.replace(back)
    }
  } finally {
    checking.value = false
  }
}

async function logout() {
  await auth.logout()
  router.replace({ name: 'login' })
}
</script>

<template>
  <div class="min-h-screen bg-sky-100 flex items-center justify-center px-4 py-10">
    <div class="w-full max-w-lg bg-white rounded-3xl shadow-2xl p-8 space-y-4">
      <h1 class="text-2xl font-bold text-sky-700">E-posta adresini doğrula</h1>
      <p class="text-slate-700">
        Hesabını tam kullanabilmek için e-postana gönderdiğimiz doğrulama bağlantısına tıkla.
      </p>

      <div v-if="msg" class="text-green-700 bg-green-50 border border-green-200 rounded-lg p-2">
        {{ msg }}
      </div>
      <div v-if="err" class="text-red-700 bg-red-50 border border-red-200 rounded-lg p-2">
        {{ err }}
      </div>

      <div class="flex gap-2">
        <button
            class="flex-1 px-4 py-2 rounded-xl border border-sky-300 hover:bg-sky-50"
            :disabled="sending"
            @click="resend"
        >
          {{ sending ? 'Gönderiliyor…' : 'Doğrulama e-postasını tekrar gönder' }}
        </button>
        <button
            class="flex-1 px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white"
            :disabled="checking"
            @click="checkAgain"
        >
          {{ checking ? 'Kontrol ediliyor…' : 'Doğruladım, tekrar kontrol et' }}
        </button>
      </div>

      <div class="text-sm text-slate-600">
        Yanlış hesapla mı giriş yaptın?
        <button class="underline" @click="logout">Çıkış yap</button>
      </div>
    </div>
  </div>
</template>
