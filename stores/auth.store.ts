import { defineStore } from 'pinia'
import { AuthGateway } from '../api/authGateway'

export type Role = 'student' | 'coach' | 'admin'

export const useAuthStore = defineStore('auth', () => {
  const user = useSupabaseUser()
  const loading = ref(false)
  const needsEmailVerification = ref(false)
  const premiumEndsAt = ref<string | null>(null)
  const preferredCurriculumId = ref<string | null>(null)
  const initialized = ref(false)
  const nuxtApp = useNuxtApp()

  async function fetchSession(force = false) {
    if (initialized.value && !force) return
    try {
      const data = await nuxtApp.$fetch<{
        session: any
        user: any
        premiumEndsAt: string | null
        preferredCurriculumId: string | null
      }>('/api/auth', { credentials: 'include' })
      if (data?.user) {
         user.value = data.user
      } else if (!user.value) {
         user.value = null
      }

      premiumEndsAt.value = data?.premiumEndsAt ?? null
      preferredCurriculumId.value = data?.preferredCurriculumId ?? null
    } catch (err) {
      user.value = null
      premiumEndsAt.value = null
      preferredCurriculumId.value = null
      if (force) throw err
    } finally {
      initialized.value = true
    }
  }

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const result = await AuthGateway.login(email, password)
      user.value = result.user
      premiumEndsAt.value = result.premiumEndsAt ?? null
      preferredCurriculumId.value = result.preferredCurriculumId ?? null
    } finally {
      loading.value = false
    }
  }

  async function signup(email: string, password: string, fullName: string | null, role: Role) {
    loading.value = true
    needsEmailVerification.value = false
    try {
      const result = await AuthGateway.signup(email, password, {
        full_name: fullName,
        role
      })
      if (result.user && !result.session) {
        needsEmailVerification.value = true
      }
      user.value = result.user
      premiumEndsAt.value = result.premiumEndsAt ?? null
      preferredCurriculumId.value = result.preferredCurriculumId ?? null
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await AuthGateway.logout()
    user.value = null
    premiumEndsAt.value = null
    preferredCurriculumId.value = null
    const router = useRouter()
    router.push('/login')
  }

  async function resetPassword(email: string) {
    loading.value = true
    try {
      await AuthGateway.resetPassword(email)
    } finally {
      loading.value = false
    }
  }


  const isPremiumActive = computed(() => {
    if (!premiumEndsAt.value) return false
    const end = new Date(premiumEndsAt.value)
    return !isNaN(end.getTime()) && end.getTime() > Date.now()
  })

  // Helper to get ID regardless of whether user is a User object or JWT payload
  const userId = computed(() => {
     if (!user.value) return null
     return user.value.id || (user.value as any).sub || null
  })

  const isAdmin = computed(() => {
    const u = user.value as any
    return u?.user_metadata?.role === 'admin' || u?.app_metadata?.role === 'admin'
  })

  return {
    user,
    userId,
    isAdmin,
    loading,
    needsEmailVerification,
    premiumEndsAt,
    preferredCurriculumId,
    initialized,
    isPremiumActive,
    fetchSession,
    login,
    signup,
    logout,
    resetPassword
  }
})
