<!-- src/views/ProfileView.vue -->
<script setup lang="ts">
import { ref, reactive, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import Navbar from '../components/Navbar.vue'
import { useAuthStore } from '../stores/auth.store'
import { useProfile } from '../queries/useProfile'
import { useCurricula } from '../queries/useCurricula'   // ⬅ useSections kaldırıldı
import { createPremiumPayment, PACKAGES, type PackageKey, type CardData } from '../api/premium'
import CreditCardForm from '../components/CreditCardForm.vue'
import { normalizePreferredCurriculumId, type AiMode, type AiCreativity, type AiInspiration, type AiReward } from '../api/profile'

/* Helpers */
const fmtDate = (s?: string) => {
  if (!s) return ''
  const d = new Date(s)
  return isNaN(d.getTime()) ? '' : d.toLocaleString('tr-TR', { dateStyle: 'long', timeStyle: 'short' })
}
const norm = (v?: string | null) => (typeof v === 'string' ? v.trim() : v ?? '')

/* Auth & Queries */
const auth = useAuthStore()
const uid = auth.user?.id ?? null

// Profil (isLoading çıkarıldı)
const {
  data: profile,
  error: profErr,
  updateBasics,
  updateCustomerInfo,

  updatePreferred,
  updateAi,
  isLoading: profileLoading,
  refetch: refetchProfile
} = useProfile(uid)

// Müfredatlar
const { data: curricula, isLoading: curLoading, error: curErr } = useCurricula()

// Yapay zeka seçenekleri (Türkçe etiketlerle)
const aiModeOptions: { value: AiMode; label: string }[] = [
  { value: 'professional_coach', label: 'Profesyonel koç' },
  { value: 'soft_mentor', label: 'Yumuşak mentor' },
  { value: 'discipline_commando', label: 'Disiplinli komando' },
  { value: 'funny_comic', label: 'Komik rehber' },
  { value: 'anime_senpai', label: 'Anime senpai' },
  { value: 'elon_style', label: 'Elon tarzı' },
  { value: 'rick_and_morty', label: 'Rick ve Morty' },
  { value: 'game_character', label: 'Oyun karakteri' }
]

const aiCreativityOptions: { value: AiCreativity; label: string }[] = [
  { value: 'normal', label: 'Standart' },
  { value: 'creative', label: 'Yaratıcı dokunuş' },
  { value: 'very_creative', label: 'Çok yaratıcı' },
  { value: 'storytelling', label: 'Hikaye anlatıcı' }
]

const aiInspirationOptions: { value: AiInspiration; label: string }[] = [
  { value: 'balanced', label: 'Dengeli destek' },
  { value: 'soft', label: 'Sakin motivasyon' },
  { value: 'hardcore', label: 'Sert itici güç' },
  { value: 'humorous', label: 'Esprili motivasyon' }
]

const aiRewardOptions: { value: AiReward; label: string }[] = [
  { value: 'basic', label: 'Basit motivasyon' },
  { value: 'gamified', label: 'Oyunlaştırılmış rozetler' },
  { value: 'legendary_cards', label: 'Efsane kartlar' },
  { value: 'none', label: 'Ödül istemiyorum' }
]

// const premiumPlanList removed

const aiDefaults = {
  ai_mode: 'professional_coach' as AiMode,
  ai_creativity: 'normal' as AiCreativity,
  ai_inspiration: 'balanced' as AiInspiration,
  ai_reward_mode: 'basic' as AiReward,
  ai_daily_plan_enabled: true,
  ai_weekly_report_enabled: true,
  ai_belgesel_mode: false,
  ai_prediction_enabled: true
}

/* Form State */
const selected = ref('')
const prefError = ref<string | null>(null)
const aiForm = reactive({ ...aiDefaults })

const selectedPlan = ref<PackageKey>('monthly')
const premiumError = ref<string | null>(null)
const premiumLoading = ref(false)

// New Payment Flow State
const showCreditCardForm = ref(false)
const showThreeDSModal = ref(false)
const threeDSHtml = ref('')
const paymentSuccess = ref(false)

// Restoring Billing State
const billingSectionRef = ref<HTMLElement | null>(null)
const billingNameInput = ref('')
const customerForm = reactive({
  tax_number: ''
})
const nameError = ref<string | null>(null)

const currentPackage = computed(() => PACKAGES[selectedPlan.value])

const closePaymentModals = () => {
showCreditCardForm.value = false
showThreeDSModal.value = false
threeDSHtml.value = ''
premiumError.value = null
}

const onCardSubmit = async (cardData: CardData) => {
if (!uid) return
premiumLoading.value = true
premiumError.value = null

try {
  const pkg = currentPackage.value
  const res = await createPremiumPayment({ userId: uid, packageUuid: pkg.uuid, cardData })
  
  if (res.html) {
      threeDSHtml.value = res.html
      showCreditCardForm.value = false
      showThreeDSModal.value = true
  } else {
      throw new Error('3D Secure başlatılamadı.')
  }
} catch (err: any) {
  premiumError.value = err.message || 'Ödeme hatası'
} finally {
  premiumLoading.value = false
}
}

// Listen for payment success from iframe
// Listen for payment success/failure from iframe
const onMessage = async (event: MessageEvent) => {
  // Debug Log
  if (event.data?.type?.startsWith('payment_')) {
      console.log('[ProfileView] Payment Event Received:', event.data)
  }

  if (!event.data) return

  // Ödeme Başarısız
  if (event.data.type === 'payment_failure') {
      closePaymentModals()
      premiumError.value = event.data.message || 'Ödeme gerçekleştirilemedi.'
      // Hata mesajını biraz gösterip sonra belki null yapabiliriz, şu an kalıcı.
      return
  }

  // Ödeme Başarılı
  if (event.data.type === 'payment_success') {
    closePaymentModals()
    paymentSuccess.value = true
    
    // 1. Optimistic Update (Hızlı Tepki)
    // Server bize yeni tarihi gönderdiyse hemen store'a yazalım.
    if (event.data.premiumEndsAt) {
        auth.$patch({ premiumEndsAt: event.data.premiumEndsAt })
    }

    // 2. Güvence: Yine de profili tazeleyelim (belki başka fieldlar değişmiştir)
    await refetchProfile()

    // 5 saniye sonra başarı mesajını kaldır
    setTimeout(() => {
        paymentSuccess.value = false
    }, 5000)
 }
}

 onMounted(async () => {
 window.addEventListener('message', onMessage)
 // Custom param check if callback redirects top frame
 if (new URLSearchParams(window.location.search).get('payment_success')) {
     paymentSuccess.value = true
     window.history.replaceState({}, '', window.location.pathname)
     await refetchProfile()
 }
})

onBeforeUnmount(() => {
 window.removeEventListener('message', onMessage)
})

// profile geldiğinde formu doldur
watch(
  () => profile.value,
  (p) => {
    if (!p) return
    selected.value = normalizePreferredCurriculumId(p.preferred_curriculum_id) ?? ''
    billingNameInput.value = norm(p.fullname)
    prefError.value = null
    aiForm.ai_mode = p.ai_mode ?? aiDefaults.ai_mode
    aiForm.ai_creativity = p.ai_creativity ?? aiDefaults.ai_creativity
    aiForm.ai_inspiration = p.ai_inspiration ?? aiDefaults.ai_inspiration
    aiForm.ai_reward_mode = p.ai_reward_mode ?? aiDefaults.ai_reward_mode
    aiForm.ai_daily_plan_enabled =
      typeof p.ai_daily_plan_enabled === 'boolean' ? p.ai_daily_plan_enabled : aiDefaults.ai_daily_plan_enabled
    aiForm.ai_weekly_report_enabled =
      typeof p.ai_weekly_report_enabled === 'boolean'
        ? p.ai_weekly_report_enabled
        : aiDefaults.ai_weekly_report_enabled
    aiForm.ai_belgesel_mode =
      typeof p.ai_belgesel_mode === 'boolean' ? p.ai_belgesel_mode : aiDefaults.ai_belgesel_mode
    aiForm.ai_prediction_enabled =
      typeof p.ai_prediction_enabled === 'boolean'
        ? p.ai_prediction_enabled
        : aiDefaults.ai_prediction_enabled
    customerForm.tax_number = p.customer_tax_number ?? ''

    // Sync premium status to store if fetched fresh data
    if (p.premium_ends_at && p.premium_ends_at !== auth.premiumEndsAt) {
        auth.$patch({ premiumEndsAt: p.premium_ends_at })
    }
  },
  { immediate: true }
)

/* Derived / UI */
const premiumEndsAtDate = computed<Date | null>(() => {
  const raw = auth.premiumEndsAt
  if (!raw) return null
  const d = new Date(raw)
  return isNaN(d.getTime()) ? null : d
})

const isPremiumActive = computed<boolean>(() => {
  const end = premiumEndsAtDate.value
  return !!end && end.getTime() > Date.now()
})

const premiumEndsLabel = computed(() => (auth.premiumEndsAt ? fmtDate(auth.premiumEndsAt) : ''))

const premiumRemainingDays = computed(() => {
  const end = premiumEndsAtDate.value
  if (!end) return 0
  const diff = end.getTime() - Date.now()
  return diff > 0 ? Math.ceil(diff / (1000 * 60 * 60 * 24)) : 0
})

const preferredLabel = computed(() => {
  const id = norm(profile.value?.preferred_curriculum_id)
  if (!id) return ''
  const found = (curricula.value ?? []).find((c) => c.id === id)
  return found ? [found.exam, found.version].filter(Boolean).join(' - ') || found.id : id
})

const roleLabel = computed(() => {
  const role = profile.value?.role
  if (role === 'teacher') return 'Öğretmen'
  if (role === 'student') return 'Öğrenci'
  if (role === 'admin') return 'Yönetici'
  return '—'
})

const hasChangesPref = computed(() => {
  if (!profile.value) return false
  const chosen = norm(selected.value)
  if (!chosen) return false
  return chosen !== norm(profile.value.preferred_curriculum_id)
})

const prefPending = computed<boolean>(() => {
  const raw = (updatePreferred as any)?.isPending
  return typeof raw?.value === 'boolean' ? raw.value : !!raw
})



const namePending = computed<boolean>(() => {
  const raw = (updateBasics as any)?.isPending
  return typeof raw?.value === 'boolean' ? raw.value : !!raw
})

const tcknPending = computed<boolean>(() => {
  const raw = (updateCustomerInfo as any)?.isPending
  return typeof raw?.value === 'boolean' ? raw.value : !!raw
})

const billingName = computed(() => norm(billingNameInput.value))
const billingNameMissing = computed(() => !billingName.value)

const hasNameChanges = computed(() => {
  if (!profile.value) return false
  return billingName.value !== norm(profile.value.fullname)
})

const hasTcknChanges = computed(() => {
  if (!profile.value) return false
  return norm(customerForm.tax_number) !== norm(profile.value.customer_tax_number)
})

const aiPending = computed<boolean>(() => {
  const raw = (updateAi as any)?.isPending
  return typeof raw?.value === 'boolean' ? raw.value : !!raw
})

const hasAiChanges = computed(() => {
  if (!profile.value) return false
  const p = profile.value
  const strChanged = <T extends string>(val: T, profVal: T | null | undefined, fallback: T) =>
    (profVal ?? fallback) !== val
  const boolChanged = (val: boolean, profVal: boolean | null | undefined, fallback: boolean) =>
    (typeof profVal === 'boolean' ? profVal : fallback) !== val

  return (
    strChanged(aiForm.ai_mode, p.ai_mode as AiMode | null, aiDefaults.ai_mode) ||
    strChanged(aiForm.ai_creativity, p.ai_creativity as AiCreativity | null, aiDefaults.ai_creativity) ||
    strChanged(aiForm.ai_inspiration, p.ai_inspiration as AiInspiration | null, aiDefaults.ai_inspiration) ||
    strChanged(aiForm.ai_reward_mode, p.ai_reward_mode as AiReward | null, aiDefaults.ai_reward_mode) ||
    boolChanged(aiForm.ai_daily_plan_enabled, p.ai_daily_plan_enabled, aiDefaults.ai_daily_plan_enabled) ||
    boolChanged(aiForm.ai_weekly_report_enabled, p.ai_weekly_report_enabled, aiDefaults.ai_weekly_report_enabled) ||
    boolChanged(aiForm.ai_belgesel_mode, p.ai_belgesel_mode, aiDefaults.ai_belgesel_mode) ||
    boolChanged(aiForm.ai_prediction_enabled, p.ai_prediction_enabled, aiDefaults.ai_prediction_enabled)
  )
})

async function onSaveName() {
  if (!uid || namePending.value || tcknPending.value) return
  if (billingNameMissing.value) {
    nameError.value = 'Ad soyad boş olamaz.'
  }
  nameError.value = null
  try {
    if (hasNameChanges.value) {
      await updateBasics.mutateAsync({ fullname: billingName.value })
    }
    if (hasTcknChanges.value) {
      await updateCustomerInfo.mutateAsync({ customer_tax_number: norm(customerForm.tax_number) })
    }
  } catch (err: any) {
    nameError.value = err?.message ?? 'Bilgiler kaydedilemedi.'
  }
}

/* Actions */
async function onStartPremium(key: string) {
  selectedPlan.value = key as PackageKey
  if (!uid) {
    premiumError.value = 'Giriş yapman gerekiyor.'
    return
  }
  premiumError.value = null

  if (billingNameMissing.value) {
      premiumError.value = 'Profilindeki ad / soyad bilgisi eksik.'
      billingSectionRef.value?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
  }

  // Auto-save name if changed
  if (hasNameChanges.value) {
      try {
        await updateBasics.mutateAsync({ fullname: billingName.value })
      } catch (err: any) {
        premiumError.value = err?.message ?? 'Isim kaydedilemedi.'
        return
      }
  }

  if (hasTcknChanges.value) {
      try {
        await updateCustomerInfo.mutateAsync({ customer_tax_number: norm(customerForm.tax_number) })
      } catch (err: any) {
        premiumError.value = err?.message ?? 'TCKN kaydedilemedi.'
        return
      }
  }
  
  // Open The Modal
  showCreditCardForm.value = true
}

// iyzico'nun döndürdüğü script'in çalışması için HTML'i manuel yerleştirip <script> etiketlerini yeniden çalıştır.


watch(selected, (val) => {
  if (prefError.value && normalizePreferredCurriculumId(val)) {
    prefError.value = null
  }
})

watch(billingNameInput, () => {
  if (premiumError.value && !billingNameMissing.value) {
    premiumError.value = null
  }
})

async function onSavePreferred() {
  if (!uid || !hasChangesPref.value || prefPending.value) return
  const normalized = normalizePreferredCurriculumId(selected.value)
  if (!normalized) {
    prefError.value = 'Lutfen gecerli bir mufredat sec.'
    return
  }
  prefError.value = null
  await updatePreferred.mutateAsync(normalized)
}

async function onSaveAi() {
  if (!uid || !hasAiChanges.value || aiPending.value) return
  await updateAi.mutateAsync({ ...aiForm })
}
</script>

<template>
  <div class="min-h-screen bg-white xl:bg-sky-100 flex flex-col">
    <!-- Header -->
    <header class="px-4">
      <Navbar />
    </header>

    <!-- Main -->
    <main class="flex-grow flex justify-center items-start px-0 py-6 xl:px-4 xl:py-8">
      <div
        class="w-full max-w-6xl bg-white p-4 xl:p-8 space-y-8 rounded-none shadow-none border-0 xl:rounded-[24px] xl:shadow-2xl xl:border xl:border-slate-100"
      >
        <!-- Başlık -->
        <div class="text-center space-y-1">
          <h1 class="text-3xl font-bold text-sky-700">Profilim</h1>
          <p class="text-slate-600">Bilgilerini görüntüle ve müfredat tercihlerini gözden geçir.</p>
        </div>

        <div v-if="profileLoading" class="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in duration-500">
          <div class="relative">
            <div class="w-16 h-16 border-4 border-slate-100 rounded-full"></div>
            <div class="absolute top-0 left-0 w-16 h-16 border-4 border-sky-500 rounded-full border-t-transparent animate-spin"></div>
            <div class="absolute inset-0 flex items-center justify-center">
              <span class="text-2xl">👤</span>
            </div>
          </div>
          <div class="text-center space-y-1">
            <h3 class="text-lg font-medium text-slate-800">Profil Yükleniyor</h3>
            <p class="text-slate-500 text-sm">Bilgilerini getiriyoruz, lütfen bekle...</p>
          </div>
        </div>

        <div v-else-if="profErr" class="text-center text-red-600">
          {{ (profErr as any)?.message ?? profErr }}
        </div>
        <div v-else-if="!profile" class="text-center text-slate-500">
          Profil bulunamadı.
        </div>

        <template v-else>
          <!-- Uyarı bandı -->
          <div
            v-if="!preferredLabel"
            class="rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 text-amber-800"
          >
            <div class="font-semibold">Müfredat seçmediniz</div>
            <div class="text-sm">Lütfen aşağıdan çalışmak istediğiniz müfredatı seçin.</div>
          </div>

          <!-- Hesap Bilgileri -->
          <section class="rounded-2xl border border-slate-200 xl:border-sky-100 bg-white xl:bg-sky-50 p-6 space-y-6">
            <h2 class="text-2xl font-semibold text-slate-900 xl:text-sky-700">Hesap Bilgileri</h2>

            <div class="grid gap-6 sm:grid-cols-2">
              <div>
                <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">E-posta</p>
                <p class="text-lg font-semibold text-slate-800">{{ profile.email ?? 'Belirtilmemiş' }}</p>
              </div>

              <div>
                <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Rol</p>
                <p class="text-lg font-semibold text-slate-800 mt-1">{{ roleLabel }}</p>
              </div>

              <div>
                <p class="text-xs font-semibold tracking-wider text-slate-500 uppercase">Oluşturulma</p>
                <p class="text-lg font-semibold text-slate-800">{{ fmtDate(profile.created_at) || '—' }}</p>
              </div>
            </div>
          </section>

          <!-- Kişisel Bilgiler -->
          <section
            ref="billingSectionRef"
            class="rounded-2xl border border-slate-200 xl:border-amber-200 bg-white xl:bg-amber-50 p-6 space-y-5"
          >
            <div class="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <h2 class="text-2xl font-semibold text-slate-900 xl:text-amber-800">Kişisel Bilgiler ve TCKN</h2>
                <p class="text-slate-700">Profil adınızı ve TCKN bilginizi düzenleyin.</p>
              </div>
            </div>

            <div class="space-y-1">
              <label class="text-sm font-semibold text-slate-800">Vergi No / TCKN</label>
              <input
                v-model="customerForm.tax_number"
                type="text"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="TCKN giriniz"
              />
            </div>

            <div class="space-y-1">
              <label class="text-sm font-semibold text-slate-800">Ad Soyad</label>
              <input
                v-model="billingNameInput"
                type="text"
                class="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-amber-500"
                placeholder="Adınız Soyadınız"
              />
            </div>

            <div
              v-if="nameError"
              class="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3"
            >
              {{ nameError }}
            </div>

            <div class="flex flex-wrap gap-3 pt-1">
              <button
                class="rounded-lg bg-amber-600 px-5 py-2 text-white font-semibold shadow hover:bg-amber-700 disabled:opacity-60"
                :disabled="namePending || tcknPending || billingNameMissing || (!hasNameChanges && !hasTcknChanges)"
                @click="onSaveName"
              >
                {{ (namePending || tcknPending) ? 'Kaydediliyor...' : ((hasNameChanges || hasTcknChanges) ? 'Değişiklikleri Kaydet' : 'Güncel') }}
              </button>
            </div>
          </section>

          <!-- Premium Üyelik -->
          <section class="rounded-2xl border border-slate-200 xl:border-emerald-200 bg-white xl:bg-emerald-50 p-6 space-y-5">
            <div class="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
              <div class="space-y-1">
                <h2 class="text-2xl font-semibold text-slate-900 xl:text-emerald-700">Premium Üyelik</h2>
                <p class="text-slate-700">Premium paketlerle koçluğu kesintisiz kullan.</p>
                <p v-if="isPremiumActive" class="text-sm font-semibold text-emerald-800">
                  Premium aktif · Bitiş: {{ premiumEndsLabel }} ({{ premiumRemainingDays }} gün)
                </p>
                <p v-else class="text-sm text-slate-700">
                  Premium aktif değil. Paketlerden birini seçerek başlatabilirsin.
                </p>
              </div>
              <div class="rounded-xl bg-white/80 border border-slate-200 xl:border-emerald-200 px-4 py-3 text-center shadow-sm">
                <p class="text-xs font-semibold uppercase tracking-wide text-emerald-600">Durum</p>
                <p class="text-lg font-bold text-emerald-800">{{ isPremiumActive ? 'Aktif' : 'Pasif' }}</p>
                <p class="text-xs text-slate-600" v-if="premiumEndsLabel">Bitiş: {{ premiumEndsLabel }}</p>
              </div>
            </div>

            <Transition name="fade">
              <div
                v-if="paymentSuccess"
                class="rounded-xl bg-emerald-100 border border-emerald-300 text-emerald-900 px-5 py-4 flex items-center gap-3"
              >
                 <span class="text-3xl">🎉</span>
                 <div>
                   <p class="font-bold text-lg">Ödeme Başarılı!</p>
                   <p class="text-sm">Premium hesabınız aktif edildi. İyi çalışmalar!</p>
                 </div>
              </div>
            </Transition>
            <div
              v-if="!paymentSuccess && premiumError"
              class="rounded-xl bg-red-50 border border-red-200 text-red-700 px-4 py-3"
            >
              {{ premiumError }}
            </div>

            <div class="grid gap-4 md:grid-cols-2">
              <article
                v-for="(pkg, key) in PACKAGES"
                :key="key"
                class="rounded-2xl border bg-white shadow-sm p-5 space-y-3 transition border-slate-200 hover:border-emerald-400"
                :class="selectedPlan === key ? 'ring-1 ring-emerald-400' : ''"
              >
                <div class="flex items-center justify-between gap-3">
                  <div>
                    <p class="text-sm font-semibold text-slate-600">{{ pkg.label }}</p>
                    <p class="text-2xl font-bold text-emerald-700">{{ pkg.gross.toFixed(2) }} TL</p>
                  </div>
                  <span
                    class="rounded-full bg-emerald-50 text-emerald-700 px-3 py-1 text-xs font-semibold"
                  >
                    {{ pkg.months }} Ay
                  </span>
                </div>
                <div class="text-sm text-slate-600 space-y-1">
                   <p>{{ pkg.description }}</p>
                   <p class="text-xs text-slate-400">({{ pkg.net }} TL + %18 KDV)</p>
                </div>
                <button
                  class="w-full rounded-lg bg-emerald-600 px-4 py-2 text-white font-semibold hover:bg-emerald-700 disabled:opacity-70"
                  :disabled="premiumLoading"
                  @click="onStartPremium(key)"
                >
                  {{
                    premiumLoading && selectedPlan === key
                      ? 'Ödeme hazırlanıyor…'
                      : isPremiumActive
                      ? 'Süreyi uzat'
                      : 'Satın Al'
                  }}
                </button>
              </article>
            </div>
          </section>

          <!-- Yapay Zeka Asistanım -->
          <section
            class="rounded-2xl border border-slate-200 xl:border-indigo-100 bg-white xl:bg-gradient-to-r xl:from-sky-50 xl:via-indigo-50 xl:to-purple-50 p-6 xl:p-7 space-y-6"
          >
            <div class="flex flex-col gap-4 lg:flex-row lg:items-center">
              <div class="flex-1 space-y-2">
                <h2 class="text-2xl font-semibold text-slate-900 xl:text-sky-700">Yapay Zeka Asistanım</h2>
                <p class="text-slate-600">
                  Tarzını, yaratıcılık seviyesini ve motivasyon şeklini Türkçe etiketlerle seç.
                </p>
              </div>
              <div class="flex justify-center lg:justify-end">
                <img
                  src="/ai-mascot.svg"
                  alt="Tatlı yapay zeka karakteri"
                  class="h-32 w-32 md:h-36 md:w-36 drop-shadow-lg"
                  loading="lazy"
                />
              </div>
            </div>

            <div class="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div class="space-y-1">
                <label class="text-sm font-semibold text-slate-700">Asistan modu</label>
                <select
                  v-model="aiForm.ai_mode"
                  class="w-full rounded-xl border border-slate-300 bg-white/90 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option v-for="opt in aiModeOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-sm font-semibold text-slate-700">Yaratıcılık</label>
                <select
                  v-model="aiForm.ai_creativity"
                  class="w-full rounded-xl border border-slate-300 bg-white/90 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option v-for="opt in aiCreativityOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-sm font-semibold text-slate-700">İlham tarzı</label>
                <select
                  v-model="aiForm.ai_inspiration"
                  class="w-full rounded-xl border border-slate-300 bg-white/90 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option v-for="opt in aiInspirationOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>

              <div class="space-y-1">
                <label class="text-sm font-semibold text-slate-700">Ödül modu</label>
                <select
                  v-model="aiForm.ai_reward_mode"
                  class="w-full rounded-xl border border-slate-300 bg-white/90 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-sky-500"
                >
                  <option v-for="opt in aiRewardOptions" :key="opt.value" :value="opt.value">
                    {{ opt.label }}
                  </option>
                </select>
              </div>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <label
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm"
              >
                <input
                  v-model="aiForm.ai_daily_plan_enabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <p class="font-medium text-slate-800">Günlük plan önerileri</p>
                  <p class="text-sm text-slate-600">Her güne küçük bir odak listesi gelsin.</p>
                </div>
              </label>

              <label
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm"
              >
                <input
                  v-model="aiForm.ai_weekly_report_enabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <p class="font-medium text-slate-800">Haftalık rapor</p>
                  <p class="text-sm text-slate-600">İlerleme ve öneriler haftalık gelsin.</p>
                </div>
              </label>

              <label
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm"
              >
                <input
                  v-model="aiForm.ai_prediction_enabled"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <p class="font-medium text-slate-800">Tahminler açık</p>
                  <p class="text-sm text-slate-600">
                    Performans tahminleri ve ipuçları gösterilsin.
                  </p>
                </div>
              </label>

              <label
                class="flex items-center gap-3 rounded-xl border border-slate-200 bg-white/70 px-4 py-3 shadow-sm"
              >
                <input
                  v-model="aiForm.ai_belgesel_mode"
                  type="checkbox"
                  class="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <div>
                  <p class="font-medium text-slate-800">Belgesel modu</p>
                  <p class="text-sm text-slate-600">Daha yavaş, sakin ve anlatımlı içerik.</p>
                </div>
              </label>
            </div>

            <div class="flex flex-wrap gap-3 pt-2">
              <button
                class="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-60"
                :disabled="aiPending || !hasAiChanges"
                @click="onSaveAi"
              >
                {{ aiPending ? 'Kaydediliyor…' : (hasAiChanges ? 'Yapay zekayı kaydet' : 'Güncel') }}
              </button>
              <p class="text-sm text-slate-600">
                Seçeneklerin tamamı Türkçe etiketlidir; dilediğin zaman değiştirebilirsin.
              </p>
            </div>
          </section>

          <!-- Müfredat Tercihi -->
          <section class="rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 class="text-2xl font-semibold text-sky-700">Müfredat Tercihi</h2>

            <div class="space-y-2">
              <label class="text-sm font-medium text-slate-700">Müfredat seçimi</label>
              <select
                v-model="selected"
                class="app-control w-full"
                :disabled="curLoading || prefPending"
              >
                <option value="" disabled>Mufredat sec</option>
                <option v-for="c in (curricula ?? [])" :key="c.id" :value="c.id">
                  {{ [c.exam, c.version].filter(Boolean).join(' - ') || c.id }}
                </option>
              </select>

              <p v-if="curLoading" class="text-sm text-slate-500">Müfredatlar yükleniyor…</p>
              <p v-else-if="curErr" class="text-sm text-red-600">
                {{ (curErr as any)?.message ?? curErr }}
              </p>
              <p v-else-if="prefError" class="text-sm text-red-600">{{ prefError }}</p>
            </div>

            <div class="flex gap-3">
              <button
                class="bg-sky-600 hover:bg-sky-700 text-white font-semibold px-6 py-2 rounded-lg disabled:opacity-60"
                :disabled="prefPending || curLoading || !hasChangesPref"
                @click="onSavePreferred"
              >
                {{ prefPending ? 'Kaydediliyor…' : (hasChangesPref ? 'Tercihi Kaydet' : 'Güncel') }}
              </button>

              <button
                class="text-sky-600 hover:text-sky-700 text-sm font-medium"
                :disabled="prefPending || curLoading"
                @click="selected = profile?.preferred_curriculum_id ?? ''"
              >
                Seçimi sıfırla
              </button>
            </div>
          </section>
        </template>
      </div>
    </main>
    <!-- Credit Card Modal -->
    <div
      v-if="showCreditCardForm"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      role="dialog"
    >
       <div class="w-full max-w-lg">
          <CreditCardForm
             :loading="premiumLoading"
             :price="currentPackage.gross"
             :plan-label="currentPackage.label"
             @submit="onCardSubmit"
             @cancel="closePaymentModals"
          />
          <div v-if="premiumError" class="mt-4 p-3 bg-red-100 text-red-700 rounded-lg text-sm text-center font-semibold">
             {{ premiumError }}
          </div>
       </div>
    </div>

    <!-- 3D Secure Iframe Modal -->
    <div
      v-if="showThreeDSModal"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
    >
       <div class="relative w-full max-w-3xl bg-white rounded-2xl overflow-hidden h-[80vh] flex flex-col">
          <div class="flex justify-between items-center p-3 border-b bg-slate-50">
             <h3 class="font-bold text-slate-700">3D Secure Doğrulama</h3>
             <button @click="closePaymentModals" class="text-slate-400 hover:text-slate-600">
                Kapat
             </button>
          </div>
          <div class="flex-grow bg-white">
             <!-- Render HTML directly into iframe -->
             <iframe
               :srcdoc="threeDSHtml"
               class="w-full h-full"
               frameborder="0"
             ></iframe>
          </div>
       </div>
    </div>
  </div>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.5s ease;
}

.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
