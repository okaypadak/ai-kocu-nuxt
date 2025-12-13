import { useAuthStore } from '~/stores/auth.store'

export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()

  try {
    await auth.fetchSession()
  } catch {
    // Session fetch failures are non-blocking
  }

  if (import.meta.client) {
    const rehydrateAuth = () => {
      if (document.visibilityState === 'visible') {
        auth.fetchSession(true).catch(() => {
          // Ignore background refresh errors
        })
      }
    }

    document.addEventListener('visibilitychange', rehydrateAuth)
    window.addEventListener('focus', rehydrateAuth)
  }
})
