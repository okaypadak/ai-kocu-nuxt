export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  if (import.meta.client && !auth.initialized) {
    try {
      await auth.fetchSession()
    } catch {
      // Session yok veya hata
    }
  }

  const publicRoutes = [
    '/', 
    '/login', 
    '/sifremi-unuttum', 
    '/eposta-dogrula', 
    '/sifre-guncelle', 
    '/odeme-basarili', 
    '/odeme-basarisiz'
  ]
  
  
  const isPublic = publicRoutes.includes(to.path) || publicRoutes.some(p => to.path.startsWith(p + '/'))

  if (auth.user) {
    if (to.path === '/login' || to.path === '/') {
        return navigateTo('/profil')
    }
  } else {
    if (!isPublic) {
        return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
  }
})
