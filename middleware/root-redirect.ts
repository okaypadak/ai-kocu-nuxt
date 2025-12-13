export default defineNuxtRouteMiddleware(async (to) => {
  if (to.path !== '/') return
  const auth = useAuthStore()
  if (!auth.initialized) {
    try {
      await auth.fetchSession()
    } catch {
      // ignore session fetch failures and continue with default redirect
    }
  }

  if (auth.user) {
    return navigateTo('/profile')
  }

  return navigateTo('/login')
})
