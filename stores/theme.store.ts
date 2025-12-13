import { defineStore } from 'pinia'

const prefersDark = (): boolean => {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  return window.matchMedia('(prefers-color-scheme: dark)').matches
}

const applyThemeToDocument = (isDark: boolean) => {
  if (typeof document === 'undefined') return

  const root = document.documentElement
  root.classList.toggle('dark', isDark)
  root.setAttribute('data-theme', isDark ? 'dark' : 'light')
  root.style.colorScheme = isDark ? 'dark' : 'light'
}

export const useThemeStore = defineStore('theme', {
  state: () => ({
    isDark: prefersDark(),
  }),

  actions: {
    init() {
      applyThemeToDocument(this.isDark)
    },

    setDark(next: boolean) {
      this.isDark = next
      applyThemeToDocument(this.isDark)
    },

    toggle() {
      this.setDark(!this.isDark)
    },
  },

  persist: {
    pick: ['isDark'],
  },
})
