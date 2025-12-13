<script setup lang="ts">
import { ref, computed, watch } from 'vue'

const props = defineProps<{
  loading: boolean
  price: number
  planLabel: string
}>()

const emit = defineEmits<{
  (e: 'submit', payload: any): void
  (e: 'cancel'): void
}>()

const cardName = ref('')
const cardNumber = ref('')
const expireMonth = ref('')
const expireYear = ref('')
const cvc = ref('')

// Formatters
const formatCardNumber = (val: string) => {
  const v = val.replace(/\s+/g, '').replace(/[^0-9]/gi, '')
  const matches = v.match(/\d{4,16}/g)
  const match = (matches && matches[0]) || ''
  const parts = []
  for (let i = 0, len = match.length; i < len; i += 4) {
    parts.push(match.substring(i, i + 4))
  }
  if (parts.length) {
    return parts.join(' ')
  } else {
    return v
  }
}

watch(cardNumber, (val) => {
  cardNumber.value = formatCardNumber(val)
})

watch(expireMonth, (val) => {
  if (val.length > 2) expireMonth.value = val.slice(0, 2)
})
watch(expireYear, (val) => {
  if (val.length > 2) expireYear.value = val.slice(0, 2)
})
watch(cvc, (val) => {
  if (val.length > 4) cvc.value = val.slice(0, 4)
})

const isFormValid = computed(() => {
  const cn = cardNumber.value.replace(/\s+/g, '')
  return (
    cardName.value.length > 3 &&
    cn.length >= 13 &&
    cn.length <= 19 &&
    expireMonth.value.length === 2 &&
    expireYear.value.length === 2 &&
    cvc.value.length >= 3
  )
})

const onSubmit = () => {
  if (!isFormValid.value || props.loading) return
  emit('submit', {
    cardHolderName: cardName.value,
    cardNumber: cardNumber.value.replace(/\s+/g, ''),
    expireMonth: expireMonth.value,
    expireYear: '20' + expireYear.value,
    cvc: cvc.value
  })
}
</script>

<template>
  <div class="relative w-full max-w-md mx-auto perspective-1000">
    <!-- Card Preview (Visual) -->
    <div
      class="relative h-56 w-full rounded-2xl bg-gradient-to-br from-slate-900 to-slate-800 text-white shadow-2xl transition-transform duration-500 mb-8 overflow-hidden group hover:scale-105"
    >
      <!-- Background Patterns -->
      <div class="absolute inset-0 opacity-10">
         <svg class="h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
             <path d="M0 100 C 20 0 50 0 100 100 Z" fill="white" />
         </svg>
      </div>
      <div class="absolute top-0 right-0 p-6 opacity-20">
         <div class="w-32 h-32 rounded-full bg-white blur-3xl"></div>
      </div>

      <div class="relative z-10 flex h-full flex-col justify-between p-6">
        <div class="flex justify-between items-start">
          <div class="w-12 h-8 rounded bg-gradient-to-r from-amber-200 to-yellow-400 opacity-80"></div>
          <div class="text-right">
             <p class="text-xs font-semibold uppercase tracking-widest opacity-60">Pay with</p>
             <p class="font-bold tracking-widest">IYZICO</p>
          </div>
        </div>

        <div class="space-y-4">
          <p class="font-mono text-2xl tracking-[0.15em] drop-shadow-md">
            {{ cardNumber || '•••• •••• •••• ••••' }}
          </p>

          <div class="flex justify-between items-end">
            <div>
              <p class="text-[10px] uppercase tracking-wider opacity-60">Kart Sahibi</p>
              <p class="font-medium uppercase tracking-wide truncate max-w-[200px]">
                {{ cardName || 'AD SOYAD' }}
              </p>
            </div>
            <div class="text-right">
              <p class="text-[10px] uppercase tracking-wider opacity-60">Son Kul.</p>
              <p class="font-mono font-medium">
                {{ expireMonth || 'MM' }}/{{ expireYear || 'YY' }}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Form -->
    <div class="animate-in slide-in-from-bottom-4 duration-500 fade-in bg-white rounded-3xl shadow-xl p-8 border border-slate-100 relative">
       
      <button 
        @click="$emit('cancel')" 
        class="absolute top-4 right-4 text-slate-400 hover:text-slate-600 p-1"
        v-if="!loading"
      >
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>
      </button>

      <div class="mb-6 text-center">
        <p class="text-sm font-semibold text-slate-500 uppercase tracking-wide">Ödeme Tutarı</p>
        <div class="text-3xl font-bold text-slate-900 mt-1">{{ price.toFixed(2) }} ₺</div>
        <p class="text-emerald-600 text-sm font-medium mt-1 bg-emerald-50 inline-block px-3 py-1 rounded-full">{{ planLabel }} Paket</p>
      </div>

      <div class="space-y-5">
        <!-- Card Holder -->
        <div class="space-y-1">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Kart Üzerindeki İsim</label>
          <input
            v-model="cardName"
            type="text"
            class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-medium placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
            placeholder="Ad Soyad"
            maxlength="50"
          />
        </div>

        <!-- Card Number -->
        <div class="space-y-1">
          <label class="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Kart Numarası</label>
          <div class="relative">
             <input
              v-model="cardNumber"
              type="text"
              class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono font-medium placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
              placeholder="0000 0000 0000 0000"
              maxlength="19"
            />
            <div class="absolute right-3 top-3 text-slate-400 pointer-events-none">
               <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="5" rx="2"/><line x1="2" x2="22" y1="10" y2="10"/></svg>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-2 gap-4">
          <!-- Expiry -->
          <div class="space-y-1">
            <label class="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">Son Kul. Tarihi</label>
            <div class="flex gap-2">
              <input
                v-model="expireMonth"
                type="text"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-center font-medium placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
                placeholder="01"
                maxlength="2"
              />
              <span class="py-3 text-slate-400">/</span>
              <input
                v-model="expireYear"
                type="text"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 font-mono text-center font-medium placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
                placeholder="25"
                maxlength="2"
              />
            </div>
          </div>

          <!-- CVC -->
          <div class="space-y-1">
             <label class="text-xs font-bold text-slate-500 uppercase tracking-wide ml-1">CVC / CVV</label>
             <input
                v-model="cvc"
                type="text"
                class="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 font-mono text-center font-medium placeholder:text-slate-400 focus:border-sky-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-sky-500/10 transition-all"
                placeholder="123"
                maxlength="4"
              />
          </div>
        </div>
      </div>

      <div class="mt-8">
        <button
          @click="onSubmit"
          :disabled="!isFormValid || loading"
          class="group relative w-full overflow-hidden rounded-xl bg-slate-900 px-6 py-4 font-bold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-slate-500/30 disabled:opacity-70 disabled:hover:scale-100"
        >
          <div
            class="absolute inset-0 bg-gradient-to-tr from-sky-500 via-purple-500 to-amber-500 opacity-0 transition-opacity duration-1000 group-hover:opacity-20"
          ></div>
          <span class="relative flex items-center justify-center gap-2">
            <span v-if="loading" class="h-5 w-5 animate-spin rounded-full border-2 border-white/30 border-t-white"></span>
            <span v-else>Güvenli Ödeme Yap ({{ price.toFixed(2) }}₺)</span>
          </span>
        </button>
        <p class="mt-4 text-center text-xs text-slate-400">
          <span class="mr-1">🔒</span> 
          256-bit SSL ile korunmaktadır. Ödemeniz Iyzico altyapısı ile güvendedir.
        </p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.perspective-1000 {
  perspective: 1000px;
}
</style>
