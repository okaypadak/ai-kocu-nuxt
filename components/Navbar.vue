<!-- src/components/Navbar.vue -->
<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuthStore } from '../stores/auth.store'
import { useThemeStore } from '../stores/theme.store'

// 🔔 Notifications (unread sayacı + realtime)
import { useUnreadCount, useNotificationsRealtime } from '../queries/useNotifications'
import { storeToRefs } from 'pinia'

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()
const { user } = storeToRefs(auth) // reaktif user
const theme = useThemeStore()
const { isDark } = storeToRefs(theme)
const themeToggleLabel = computed(() => (isDark.value ? 'Açık temaya geç' : 'Koyu temaya geç'))

// Drawer (mobil)
const drawerOpen = ref(false)

// Admin görünürlüğü
const isAdmin = computed(() => auth.isAdmin)

// Aktif link sınıfları
const DESKTOP_LINK_BASE = 'inline-flex items-center gap-2 font-semibold transition'
const MOBILE_LINK_BASE = 'w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg transition font-semibold'

function linkClass(path: string): string {
  const active = route.path === path
  return active
    ? `${DESKTOP_LINK_BASE} text-blue-800`
    : `${DESKTOP_LINK_BASE} text-blue-600 hover:text-blue-700`
}
function linkClassMobile(path: string): string {
  const active = route.path === path
  return active
    ? `${MOBILE_LINK_BASE} bg-sky-100 text-sky-800`
    : `${MOBILE_LINK_BASE} text-slate-700 hover:bg-slate-100`
}

// Navigasyon
function goTo(path: string) { router.push(path) }
function goToAdmin(path: string) { closeAdminMenus(); goTo(path) }
function goToAndClose(path: string) {
  goTo(path)
  drawerOpen.value = false
  closeAdminMenus()
}

// Logout
async function logout() {
  try { await auth.logout() } catch (e) { console.error('Çıkış hatası:', e) }
  drawerOpen.value = false
  closeAdminMenus()
  router.push('/login')
}

// Tek kaynaklı NAV listesi
type NavIconKey =
  | 'profile'
  | 'schedule'
  | 'timer'
  | 'exam'
  | 'stats'
  | 'curriculum'
  | 'youtube'
  | 'bell'
  | 'award'
  | 'chat'
  | 'help'

type NavItem = { label: string; path: string; icon: NavIconKey; adminOnly?: boolean }

const iconMap = Object.freeze({
  profile: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="9.5" r="3.5"></circle><path d="M6.25 19.25c.63-3.22 3.3-5.3 5.75-5.3s5.12 2.08 5.75 5.3"></path></svg>`,
  schedule: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4.75" y="5.5" width="14.5" height="14" rx="2"></rect><line x1="7.5" y1="3.5" x2="7.5" y2="6.5"></line><line x1="16.5" y1="3.5" x2="16.5" y2="6.5"></line><line x1="4.75" y1="9.5" x2="19.25" y2="9.5"></line></svg>`,
  timer: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="13" r="7.25"></circle><line x1="12" y1="5.75" x2="12" y2="4"></line><line x1="9" y1="4" x2="15" y2="4"></line><path d="M12 9.5v4l3 1.5"></path></svg>`,
  exam: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="7.25" y="4.75" width="9.5" height="14.5" rx="2"></rect><line x1="10" y1="3.75" x2="14" y2="3.75"></line><path d="M10 12.75l2.1 2.1 3.4-3.4"></path></svg>`,
  stats: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="5" y1="18.25" x2="19" y2="18.25"></line><path d="M8 18.25v-4.75a.75.75 0 0 1 .75-.75H10v5.5"></path><path d="M12.5 18.25V9.5a.75.75 0 0 1 .75-.75H15v9.5"></path><path d="M17 18.25v-3.5a.75.75 0 0 1 .75-.75H19v4.25"></path></svg>`,
  curriculum: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.75 9 7.25-4.5 7.25 4.5-7.25 4.5z"></path><path d="m4.75 13.5 7.25 4.5 7.25-4.5"></path><path d="m4.75 17.75 7.25 4.5 7.25-4.5"></path></svg>`,
  youtube: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3.75" y="6.75" width="16.5" height="10.5" rx="3"></rect><polygon points="11 10.5 15 12.5 11 14.5" fill="currentColor"></polygon></svg>`,
  bell: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6.5 8.5a5.5 5.5 0 0 1 11 0c0 5 2 6 2 6H4.5s2-1 2-6"></path><path d="M9.5 18.5a2.5 2.5 0 0 0 5 0"></path></svg>`,
  award: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="4"></circle><path d="M8 13l-2 7 6-3 6 3-2-7"></path></svg>`,
  chat: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 6.5h14a2 2 0 0 1 2 2v6.5a2 2 0 0 1-2 2H8.5L4 22v-3.5H3a2 2 0 0 1-2-2V8.5a2 2 0 0 1 2-2Z"></path><path d="M8 11h8"></path><path d="M8 14h5"></path></svg>`,
  help: `<svg class="w-4 h-4 md:w-5 md:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-2.5 2.5-2.5 4" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>`
} satisfies Record<NavIconKey, string>)

const NAV_ITEMS: Readonly<NavItem[]> = Object.freeze([
  { label: 'Profil', path: '/profile', icon: 'profile' },
  { label: 'Ders Programı', path: '/ders-programi', icon: 'schedule' },
  { label: 'Zamanlayıcı', path: '/zamanlayici', icon: 'timer' },
  { label: 'Zaman/Net', path: '/sinav-net', icon: 'exam' },
  { label: 'İlerleme', path: '/ilerleme', icon: 'stats' },
  { label: 'Rozetler', path: '/rozetler', icon: 'award' },
  { label: 'Koşu', path: '/kosu', icon: 'award' },
  { label: 'Destek', path: '/destek-mesajlari', icon: 'chat' },
  // Admin-only
  { label: 'Müfredat Yönetimi', path: '/mufredat-yonetimi', icon: 'curriculum', adminOnly: true },
  { label: 'Müfredat İçeriği', path: '/mufredat-iceri', icon: 'curriculum', adminOnly: true },
  { label: 'YouTube', path: '/youtube-iceri', icon: 'youtube', adminOnly: true },
  { label: 'Destek Admin', path: '/destek-admin', icon: 'chat', adminOnly: true },
])

const regularNavItems = computed(() => NAV_ITEMS.filter((item) => !item.adminOnly))
const adminNavItems = computed(() => NAV_ITEMS.filter((item) => item.adminOnly))
const hasAdminItems = computed(() => adminNavItems.value.length > 0)
const adminActive = computed(() =>
  adminNavItems.value.some((item) => route.path === item.path),
)
const adminTriggerClass = computed(() => {
  const base = DESKTOP_LINK_BASE
  return adminActive.value ? `${base} text-blue-800` : `${base} text-blue-600 hover:text-blue-700`
})
const adminTriggerClassMobile = computed(() => {
  const base = MOBILE_LINK_BASE
  return adminActive.value ? `${base} bg-sky-100 text-sky-800` : `${base} text-slate-700 hover:bg-slate-100`
})

const adminMenuOpen = ref(false)
const adminDrawerOpen = ref(false)
const adminDropdownRef = ref<HTMLElement | null>(null)

// Menü daima hazır
const menuReady = computed(() => true)

// 🔔 Unread count + realtime
const uid = computed(() => user.value?.id ?? auth.user?.id ?? undefined)
const { data: unreadCount } = useUnreadCount(uid)
useNotificationsRealtime(uid) // realtime invalidate

function goNotifications() {
  router.push('/bildirimler')
  drawerOpen.value = false
  closeAdminMenus()
}

function toggleTheme() {
  theme.toggle()
}

function toggleAdminMenu() {
  adminMenuOpen.value = !adminMenuOpen.value
}

function toggleAdminDrawer() {
  adminDrawerOpen.value = !adminDrawerOpen.value
}

function closeAdminMenus() {
  adminMenuOpen.value = false
  adminDrawerOpen.value = false
}

function handleClickOutside(event: MouseEvent) {
  if (!adminMenuOpen.value) return
  const target = event.target as Node
  if (adminDropdownRef.value?.contains(target)) return
  adminMenuOpen.value = false
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Escape') {
    drawerOpen.value = false
    closeAdminMenus()
  }
}
onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  document.addEventListener('click', handleClickOutside)
})
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  document.removeEventListener('click', handleClickOutside)
})
</script>

<template>
  <nav
    v-cloak
    class="bg-white shadow-md px-4 sm:px-6 py-3 sm:py-4 flex items-center justify-between mb-6 rounded-b-2xl"
  >
    <div class="flex items-center gap-3">
      <button
        class="xl:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 w-10 h-10 hover:bg-slate-50 active:scale-95 transition"
        type="button"
        aria-label="Menüyü aç"
        @click="drawerOpen = true"
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-5 w-5"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            stroke-width="2"
            d="M4 6h16M4 12h16M4 18h16"
          />
        </svg>
      </button>
      <div class="flex items-center gap-2">
        <img
          src="/ai-favicon.svg"
          alt="AI Koçu simgesi"
          class="h-10 w-10 sm:h-12 sm:w-12 rounded-xl border border-sky-100 shadow-sm"
        />
        <span class="text-sky-700 font-bold text-xl sm:text-2xl">AIkocu</span>
      </div>
      <button
        type="button"
        class="relative inline-flex h-8 w-16 items-center rounded-full border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-sky-500"
        :class="
          isDark ? 'bg-slate-700 border-slate-500' : 'bg-slate-200 border-slate-300'
        "
        :aria-label="themeToggleLabel"
        :aria-pressed="isDark"
        @click="toggleTheme"
      >
        <span class="sr-only">{{ themeToggleLabel }}</span>
        <span
          class="absolute left-3 text-xs text-amber-500 transition-opacity"
          :class="isDark ? 'opacity-0' : 'opacity-100'"
          aria-hidden="true"
        >
          ☀️
        </span>
        <span
          class="absolute right-3 text-xs text-sky-100 transition-opacity"
          :class="isDark ? 'opacity-100' : 'opacity-0'"
          aria-hidden="true"
        >
          🌙
        </span>
        <span
          class="inline-flex h-6 w-6 transform items-center justify-center rounded-full bg-white text-slate-700 shadow transition"
          :class="isDark ? 'translate-x-8 text-slate-900' : 'translate-x-1'"
          aria-hidden="true"
        >
          <svg
            v-if="isDark"
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <path d="M21 12.79A9 9 0 0 1 11.21 3 7 7 0 0 0 12 17a7 7 0 0 0 9-4.21Z" />
          </svg>
          <svg
            v-else
            class="h-4 w-4"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="1.8"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <circle cx="12" cy="12" r="4" />
            <path
              d="M12 2v2m0 16v2m10-10h-2M6 12H4m14.142-6.142-1.414 1.414M7.272 16.728l-1.414 1.414m12.728 0-1.414-1.414M7.272 7.272 5.858 5.858"
            />
          </svg>
        </span>
      </button>
    </div>

    <!-- Desktop menü -->
    <div class="hidden xl:flex xl:items-center xl:space-x-4" v-show="menuReady">
      <template v-for="item in regularNavItems" :key="item.path">
        <button @click="goTo(item.path)" :class="linkClass(item.path)">
          <span
            class="inline-flex items-center justify-center text-inherit"
            v-html="iconMap[item.icon]"
            aria-hidden="true"
          >
          </span>
          <span>{{ item.label }}</span>
        </button>
      </template>

      <div
        v-if="isAdmin && hasAdminItems"
        class="relative"
        ref="adminDropdownRef"
      >
        <button type="button" @click="toggleAdminMenu" :class="adminTriggerClass">
          <span
            class="inline-flex items-center justify-center text-inherit"
            v-html="iconMap.curriculum"
            aria-hidden="true"
          >
          </span>
          <span>Admin Menüsü</span>
          <svg
            class="h-4 w-4 transition-transform"
            :class="adminMenuOpen ? 'rotate-180' : ''"
            viewBox="0 0 20 20"
            fill="currentColor"
            aria-hidden="true"
          >
            <path
              fill-rule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.939l3.71-3.71a.75.75 0 0 1 1.133.976l-.073.084-4.24 4.24a.75.75 0 0 1-.977.073l-.084-.073-4.24-4.24a.75.75 0 0 1 .02-1.06Z"
              clip-rule="evenodd"
            />
          </svg>
        </button>
        <div
          v-show="adminMenuOpen"
          class="absolute right-0 z-20 mt-2 w-60 rounded-lg border border-slate-200 bg-white p-2 shadow-lg"
        >
          <button
            v-for="item in adminNavItems"
            :key="item.path"
            type="button"
            @click="goToAdmin(item.path)"
            :class="linkClassMobile(item.path)"
          >
            <span
              class="inline-flex items-center justify-center text-inherit"
              v-html="iconMap[item.icon]"
              aria-hidden="true"
            >
            </span>
            <span>{{ item.label }}</span>
          </button>
        </div>
      </div>

      <a
        href="https://info.aikocu.com/"
        target="_blank"
        rel="noopener"
        class="inline-flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700 transition"
      >
        <span v-html="iconMap.help" aria-hidden="true"></span>
        <span>Yardım</span>
      </a>

      <!-- 🔔 Bildirimler (desktop) -->
      <button
        class="relative inline-flex items-center gap-2 font-semibold text-blue-600 hover:text-blue-700 transition"
        type="button"
        @click="goNotifications"
      >
        <span v-html="iconMap.bell" aria-hidden="true"></span>
        <span>Bildirimler</span>
        <span
          v-if="(unreadCount ?? 0) > 0"
          class="absolute -top-2 -right-3 min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
        >
          {{ unreadCount }}
        </span>
      </button>
    </div>

    <div class="flex items-center gap-2">
      <a
        href="https://info.aikocu.com/"
        target="_blank"
        rel="noopener"
        class="md:hidden inline-flex items-center justify-center rounded-lg border border-slate-200 px-3 h-10 text-blue-600 hover:bg-slate-50 transition"
      >
        <span v-html="iconMap.help" aria-hidden="true"></span>
        <span class="sr-only">Yardım</span>
      </a>

      <!-- 🔔 Bildirimler (mobile kısayol) -->
      <button
        class="md:hidden relative inline-flex items-center justify-center rounded-lg border border-slate-200 w-10 h-10 hover:bg-slate-50 transition"
        type="button"
        aria-label="Bildirimler"
        @click="goNotifications"
      >
        <span v-html="iconMap.bell" aria-hidden="true"></span>
        <span
          v-if="(unreadCount ?? 0) > 0"
          class="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-red-500 text-white text-[10px] flex items-center justify-center"
        >
          {{ unreadCount }}
        </span>
      </button>

      <button
        @click="logout"
        class="bg-red-500 hover:bg-red-600 text-white font-semibold px-3 sm:px-4 py-2 rounded-md"
      >
        Çıkış
      </button>
    </div>

    <!-- Overlay -->
    <div
      v-if="drawerOpen"
      class="fixed inset-0 z-40 bg-slate-900/50 xl:hidden"
      @click="drawerOpen = false"
    ></div>

    <!-- Mobil çekmece -->
    <aside
      class="fixed inset-y-0 left-0 z-50 w-72 max-w-[85%] bg-white shadow-2xl xl:hidden transition-transform duration-200 ease-out"
      :class="drawerOpen ? 'translate-x-0' : '-translate-x-full'"
    >
      <div class="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
        <span class="font-semibold text-slate-800">Menü</span>
        <button
          class="rounded-md p-2 text-slate-500 hover:bg-slate-100"
          @click="drawerOpen = false"
        >
          ✖
        </button>
      </div>

      <div class="p-3">
        <div class="flex flex-col gap-1" v-show="menuReady">
          <template v-for="item in regularNavItems" :key="item.path">
            <button @click="goToAndClose(item.path)" :class="linkClassMobile(item.path)">
              <span
                class="inline-flex items-center justify-center text-inherit"
                v-html="iconMap[item.icon]"
                aria-hidden="true"
              >
              </span>
              <span>{{ item.label }}</span>
            </button>
          </template>

          <div v-if="isAdmin && hasAdminItems" class="mt-1">
            <button
              type="button"
              @click="toggleAdminDrawer"
              :class="[adminTriggerClassMobile, 'justify-between']"
            >
              <span class="flex items-center gap-3">
                <span
                  class="inline-flex items-center justify-center text-inherit"
                  v-html="iconMap.curriculum"
                  aria-hidden="true"
                >
                </span>
                <span>Admin Menüsü</span>
              </span>
              <svg
                class="h-4 w-4 transition-transform"
                :class="adminDrawerOpen ? 'rotate-180' : ''"
                viewBox="0 0 20 20"
                fill="currentColor"
                aria-hidden="true"
              >
                <path
                  fill-rule="evenodd"
                  d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 10.939l3.71-3.71a.75.75 0 0 1 1.133.976l-.073.084-4.24 4.24a.75.75 0 0 1-.977.073l-.084-.073-4.24-4.24a.75.75 0 0 1 .02-1.06Z"
                  clip-rule="evenodd"
                />
              </svg>
            </button>
            <div
              v-show="adminDrawerOpen"
              class="mt-1 flex flex-col gap-1 border-l border-slate-100 pl-3"
            >
              <button
                v-for="item in adminNavItems"
                :key="item.path"
                @click="goToAndClose(item.path)"
                :class="linkClassMobile(item.path)"
              >
                <span
                  class="inline-flex items-center justify-center text-inherit"
                  v-html="iconMap[item.icon]"
                  aria-hidden="true"
                >
                </span>
                <span>{{ item.label }}</span>
              </button>
            </div>
          </div>

          <a
            href="https://info.aikocu.com/"
            target="_blank"
            rel="noopener"
            class="w-full flex items-center gap-3 text-left px-3 py-2 rounded-lg transition font-semibold text-slate-700 hover:bg-slate-100"
          >
            <span
              class="inline-flex items-center justify-center text-inherit"
              v-html="iconMap.help"
              aria-hidden="true"
            >
            </span>
            <span>Yardım</span>
          </a>

          <!-- 🔔 Bildirimler (drawer) -->
          <button
            @click="goToAndClose('/bildirimler')"
            :class="linkClassMobile('/bildirimler')"
          >
            <span v-html="iconMap.bell" aria-hidden="true"></span>
            <span>Bildirimler</span>
            <span
              v-if="(unreadCount ?? 0) > 0"
              class="ml-auto inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full bg-red-500 text-white text-[10px]"
            >
              {{ unreadCount }}
            </span>
          </button>
        </div>

        <div class="mt-4 border-t border-slate-200 pt-3">
          <button
            @click="logout"
            class="w-full bg-red-500 hover:bg-red-600 text-white font-semibold px-4 py-2 rounded-md"
          >
            Çıkış
          </button>
        </div>
      </div>
    </aside>
  </nav>
</template>

<style scoped>
[v-cloak] {
  display: none;
}
</style>
