<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuthStore, type Role } from '../stores/auth.store'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const tab = ref<'login' | 'signup'>('login')

onMounted(() => {
  if (route.hash === '#uyeol') {
    tab.value = 'signup'
  }
})

watch(() => route.hash, (newHash) => {
  if (newHash === '#uyeol') {
    tab.value = 'signup'
  } else if (!newHash) {
    // Opsiyonel: hash silinirse login'e dönmek istenir mi? 
    // Genelde kullanıcı manuel tıkladıysa değiştirmemek daha iyi olabilir ama
    // talep sadece "uyeol linki girildiğinde açacak" yönünde.
    // Şimdilik sadece #uyeol varsa signup yapalım.
  }
})

// Login formu
const email = ref('')
const password = ref('')

// Signup formu (tek alan: Ad Soyad - opsiyonel)
const suEmail = ref('')
const suPassword = ref('')
const suPasswordConfirm = ref('')
const suFullName = ref('')
const suRole = ref<Role>('student') // Öğrenci varsayılan

const loading = ref(false)
const error = ref<string | null>(null)

  async function onLogin() {
    loading.value = true
    error.value = null
    try {
      await auth.login(email.value.trim(), password.value)
      router.push({ path: '/profil' })
    } catch (e: any) {
      if (e?.code === 'auth/needs-email-verification') {
        router.push({ path: '/eposta-dogrula', query: { redirect: '/profil' } })
        return
      }
      error.value = e?.message ?? 'Giriş başarısız.'
    } finally {
      loading.value = false
    }
  }
  
  async function onSignup() {
    loading.value = true
    error.value = null
    try {
      if (suPassword.value !== suPasswordConfirm.value) {
        error.value = 'Sifreler eslesmiyor.'
        return
      }
      await auth.signup(
        suEmail.value.trim(),
        suPassword.value,
        (suFullName.value || '').trim() || null,
        suRole.value
      )
      if (auth.needsEmailVerification) {
        router.push({ path: '/eposta-dogrula', query: { redirect: '/profil' } })
      } else {
        router.push({ path: '/profil' })
      }
    } catch (e: any) {
      error.value = e?.message ?? 'Kayıt başarısız.'
    } finally {
      loading.value = false
    }
  }
</script>

<template>
  <div class="min-h-screen relative overflow-hidden bg-gradient-to-br from-sky-950 via-sky-900 to-cyan-700 text-white">
    <div class="absolute inset-0 ai-pattern opacity-30"></div>
    <div class="absolute -left-32 -top-20 w-96 h-96 bg-gradient-to-br from-cyan-400/50 via-sky-300/20 to-white/0 blur-3xl rounded-full"></div>
    <div class="absolute right-[-120px] bottom-[-120px] w-[520px] h-[520px] bg-gradient-to-tl from-sky-500/40 via-cyan-300/10 to-white/0 blur-3xl rounded-full"></div>

    <main class="relative z-10 flex items-center justify-center px-6 py-14">
      <div class="w-full max-w-6xl grid lg:grid-cols-[1.1fr_0.9fr] gap-10 items-center">
        <div class="space-y-6">
          <p class="inline-flex items-center gap-2 text-sm font-semibold px-3 py-1 rounded-full bg-white/10 ring-1 ring-white/15 backdrop-blur">
            <span class="w-2.5 h-2.5 rounded-full bg-emerald-300 animate-pulse"></span>
            Yapay zeka destekli sınav koçluğu
          </p>
          <h1 class="text-4xl sm:text-5xl font-black leading-tight tracking-tight drop-shadow-lg">
            AI Koçu yanınızda
          </h1>
          <p class="text-lg text-sky-100/80 max-w-2xl">
            Deneme sonuçlarınızı analiz eden, zayıf konularınızı hatırlatan ve her oturumda sizi motive eden kişisel sınav koçunuzla tanışın.
          </p>
          <div class="flex flex-wrap gap-3 text-sm text-sky-100/80">
            <span class="px-3 py-1 bg-white/10 rounded-full ring-1 ring-white/15">Deneme analizi</span>
            <span class="px-3 py-1 bg-white/10 rounded-full ring-1 ring-white/15">Akıllı çalışma planı</span>
            <span class="px-3 py-1 bg-white/10 rounded-full ring-1 ring-white/15">Gerçek zamanlı geribildirim</span>
          </div>
        </div>

        <div class="backdrop-blur bg-white/90 text-slate-900 rounded-3xl shadow-2xl p-8 space-y-6 border border-white/30">
          <div class="text-center space-y-1">
            <h2 class="text-2xl font-bold text-slate-900">Hoş geldin</h2>
            <p class="text-slate-600 text-sm">Giriş yap veya bir hesap oluştur</p>
          </div>

          <div class="flex gap-2">
            <button
              class="flex-1 py-2 rounded-xl border transition"
              :class="tab==='login' ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-sm' : 'bg-white border-slate-300'"
              @click="tab='login'"
            >
              Giriş Yap
            </button>
            <button
              class="flex-1 py-2 rounded-xl border transition"
              :class="tab==='signup' ? 'bg-sky-50 border-sky-300 text-sky-700 shadow-sm' : 'bg-white border-slate-300'"
              @click="tab='signup'"
            >
              Kayıt Ol
            </button>
          </div>

          <div v-if="error" class="text-red-600 text-sm">{{ error }}</div>

          <!-- LOGIN -->
          <form v-if="tab==='login'" class="space-y-4" @submit.prevent="onLogin">
            <div>
              <label class="text-sm text-slate-700">E-posta</label>
              <input
                v-model="email"
                type="email"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <div class="flex justify-between items-center">
                <label class="text-sm text-slate-700">Şifre</label>
                <router-link :to="{ name: 'sifremi-unuttum' }" class="text-xs text-sky-600 hover:text-sky-800 font-medium">
                  Şifremi unuttum?
                </router-link>
              </div>
              <input
                v-model="password"
                type="password"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <button
              :disabled="loading"
              class="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {{ loading ? 'Giriş yapılıyor...' : 'Giriş Yap' }}
            </button>
          </form>

          <!-- SIGNUP -->
          <form v-else class="space-y-4" @submit.prevent="onSignup">
            <div>
              <label class="text-sm text-slate-700">Ad Soyad (opsiyonel)</label>
              <input
                v-model="suFullName"
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>



            <div>
              <label class="text-sm text-slate-700">E-posta</label>
              <input
                v-model="suEmail"
                type="email"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label class="text-sm text-slate-700">Şifre</label>
              <input
                v-model="suPassword"
                type="password"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>
            <div>
              <label class="text-sm text-slate-700">Sifre Tekrar</label>
              <input
                v-model="suPasswordConfirm"
                type="password"
                required
                class="mt-1 w-full rounded-xl border px-3 py-2 focus:outline-none focus:ring-2 focus:ring-sky-400"
              />
            </div>

            <button
              :disabled="loading"
              class="w-full bg-sky-600 hover:bg-sky-700 text-white font-semibold px-4 py-2 rounded-xl transition disabled:opacity-70 disabled:cursor-not-allowed"
            >
              {{ loading ? 'Kayıt oluşturuluyor...' : 'Kayıt Ol' }}
            </button>
          </form>

          <a href="https://info.aikocu.com" target="_blank" class="block mt-6 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-blue-50 border border-sky-100 hover:border-sky-300 transition-all group text-center no-underline">
            <div class="flex items-center justify-center gap-2 text-sky-700 font-semibold mb-1">
              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="w-5 h-5"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>
              Yardım ve Bilgilendirme
            </div>
            <p class="text-xs text-sky-600/80">AI Koçu hakkında daha fazla bilgi ve destek için tıklayın</p>
          </a>
        </div>
      </div>
    </main>
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
