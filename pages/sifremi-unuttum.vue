<script setup lang="ts">
import { ref } from 'vue'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

const email = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

async function onSubmit() {
  loading.value = true
  error.value = null
  success.value = false
  try {
    await auth.resetPassword(email.value.trim())
    success.value = true
  } catch (e: any) {
    error.value = e?.message ?? 'Şifre sıfırlama talebi gönderilemedi.'
  } finally {
    loading.value = false
  }
}
</script>

<template>
  <div class="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-700 text-white flex items-center justify-center px-6">
    <div class="absolute inset-0 ai-pattern opacity-30"></div>
    
    <div class="relative z-10 w-full max-w-md backdrop-blur bg-white/90 text-slate-900 rounded-3xl shadow-2xl p-8 space-y-6 border border-white/30">
        <div class="text-center space-y-2">
            <h2 class="text-2xl font-bold text-slate-900">Şifremi Unuttum</h2>
            <p class="text-slate-600 text-sm">
                E-posta adresinizi girin, sıfırlama bağlantısını gönderelim.
            </p>
        </div>

        <div v-if="success" class="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-center">
            <p class="font-medium">E-posta gönderildi!</p>
            <p class="text-sm mt-1">Lütfen gelen kutunuzu kontrol edin.</p>
            <button @click="router.push({ name: 'login' })" class="mt-3 text-sky-600 hover:text-sky-800 text-sm font-semibold">
                Giriş ekranına dön
            </button>
        </div>

        <form v-else class="space-y-4" @submit.prevent="onSubmit">
            <div v-if="error" class="text-red-600 text-sm text-center">{{ error }}</div>

            <div>
              <label class="text-sm text-slate-700">E-posta</label>
              <input
                v-model="email"
                type="email"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="ornek@email.com"
              />
            </div>

            <button
              :disabled="loading"
              class="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {{ loading ? 'Gönderiliyor...' : 'Sıfırlama Bağlantısı Gönder' }}
            </button>

            <div class="text-center mt-4">
                <button type="button" @click="router.push({ name: 'login' })" class="text-sm text-slate-500 hover:text-sky-600 transition">
                    Giriş ekranına dön
                </button>
            </div>
        </form>
    </div>
  </div>
</template>

<style scoped>
.ai-pattern {
  background-image:
    radial-gradient(circle at 20% 20%, rgba(255, 255, 255, 0.12) 0, rgba(255, 255, 255, 0.08) 18px, transparent 28px),
    radial-gradient(circle at 80% 30%, rgba(255, 255, 255, 0.12) 0, rgba(255, 255, 255, 0.08) 18px, transparent 28px),
    linear-gradient(120deg, rgba(255, 255, 255, 0.05) 0%, rgba(255, 255, 255, 0) 22%, rgba(255, 255, 255, 0.05) 45%, rgba(255, 255, 255, 0) 65%);
  background-size: 240px 240px, 220px 220px, 320px 320px;
}
</style>
