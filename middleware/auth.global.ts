export default defineNuxtRouteMiddleware(async (to) => {
  const auth = useAuthStore()

  // 1. Oturum kontrolü
  // SSR'da fetchSession çalıştırmak Pinia hydration hatasına (obj.hasOwnProperty) sebep oluyor.
  // Bu yüzden sadece client tarafında çalıştırıyoruz.
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
  
  // Hash fragment ile gelen bazı recovery linkleri path'i etkileyebilir, 
  // ancak to.path genelde temiz path döner. 
  
  const isPublic = publicRoutes.includes(to.path) || publicRoutes.some(p => to.path.startsWith(p + '/'))

  if (auth.user) {
    // Kullanıcı giriş yapmışsa
    // Login sayfasına gitmek isterse profile yönlendir
    if (to.path === '/login' || to.path === '/') {
        return navigateTo('/profil')
    }
    // Diğer sayfalara izin ver
  } else {
    // Kullanıcı giriş yapmamışsa
    if (!isPublic) {
        // Özel sayfaya erişmeye çalışıyorsa login'e at
        // Gittiği yeri hatırlamak için query ekleyebiliriz: ?redirect=...
        return navigateTo(`/login?redirect=${encodeURIComponent(to.fullPath)}`)
    }
    // Public sayfalara izin ver
  }
})
