<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'

const router = useRouter()
const auth = useAuthStore()

const password = ref('')
const passwordConfirm = ref('')
const loading = ref(false)
const error = ref<string | null>(null)
const success = ref(false)
const initializing = ref(true)

onMounted(async () => {
    // 1) PKCE Flow (code in query)
    const code = new URLSearchParams(window.location.search).get('code')
    if (code) {
        try {
            await auth.exchangeCode(code)
            // Code exchange başarılıysa session kuruldu demektir.
            // Kullanıcı bu noktada formu doldurup yeni şifresini set edecek.
        } catch (e: any) {
            error.value = 'Geçersiz veya süresi dolmuş bağlantı.'
        } finally {
            initializing.value = false
        }
        return
    }

    // 2) Implicit Flow (hash fragments) - Legacy support
    // Supabase redirect url'e parametreleri hash olarak ekler: #access_token=...&refresh_token=...&type=recovery
    const hash = window.location.hash.substring(1)
    const params = new URLSearchParams(hash)
    const accessToken = params.get('access_token')
    const refreshToken = params.get('refresh_token')
    const type = params.get('type')

    if (!accessToken || !refreshToken || type !== 'recovery') {
        error.value = 'Geçersiz veya süresi dolmuş bağlantı.'
        initializing.value = false
        return
    }

    try {
        await auth.recoverSession(accessToken, refreshToken)
    } catch (e: any) {
        error.value = 'Oturum kurtarılamadı. Lütfen tekrar deneyin.'
    } finally {
        initializing.value = false
    }
})

async function onSubmit() {
  if (password.value !== passwordConfirm.value) {
    error.value = 'Şifreler eşleşmiyor.'
    return
  }

  loading.value = true
  error.value = null
  try {
    await auth.updateUser({ password: password.value })
    success.value = true
    setTimeout(() => {
        router.push({ name: 'login' })
    }, 3000)
  } catch (e: any) {
    error.value = e?.message ?? 'Şifre güncellenemedi.'
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
            <h2 class="text-2xl font-bold text-slate-900">Yeni Şifre Belirle</h2>
            <p class="text-slate-600 text-sm">
                Lütfen hesabınız için yeni bir şifre girin.
            </p>
        </div>

        <div v-if="initializing" class="text-center py-8">
            <div class="animate-spin w-8 h-8 border-4 border-sky-600 border-t-transparent rounded-full mx-auto mb-2"></div>
            <p class="text-slate-500">Bağlantı kontrol ediliyor...</p>
        </div>

        <div v-else-if="success" class="bg-green-50 text-green-700 p-4 rounded-xl border border-green-200 text-center">
            <p class="font-bold text-lg">Başarılı!</p>
            <p class="mt-1">Şifreniz güncellendi. Giriş ekranına yönlendiriliyorsunuz...</p>
        </div>

        <div v-else-if="error && !auth.isAuthenticated" class="bg-red-50 text-red-700 p-4 rounded-xl border border-red-200 text-center">
             <p class="font-medium">Hata</p>
             <p class="text-sm mt-1">{{ error }}</p>
             <button @click="router.push({ name: 'login' })" class="mt-3 text-red-600 hover:text-red-800 text-sm font-semibold underline">
                Giriş ekranına dön
            </button>
        </div>

        <form v-else class="space-y-4" @submit.prevent="onSubmit">
            <div v-if="error" class="text-red-600 text-sm text-center">{{ error }}</div>

            <div>
              <label class="text-sm text-slate-700">Yeni Şifre</label>
              <input
                v-model="password"
                type="password"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="******"
              />
            </div>

            <div>
              <label class="text-sm text-slate-700">Yeni Şifre (Tekrar)</label>
              <input
                v-model="passwordConfirm"
                type="password"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
                placeholder="******"
              />
            </div>

            <button
              :disabled="loading"
              class="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {{ loading ? 'Güncelleniyor...' : 'Şifreyi Güncelle' }}
            </button>
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
