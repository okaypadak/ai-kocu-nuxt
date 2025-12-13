export default defineNuxtPlugin(async () => {
  const auth = useAuthStore()
  if (!auth.initialized) {
    try {
      await auth.fetchSession()
    } catch {
      // Session fetch failures are non-blocking
    }
  }
})
