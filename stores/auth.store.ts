import { defineStore } from 'pinia'

export type Role = 'student' | 'coach' | 'admin'

export const useAuthStore = defineStore('auth', () => {
  const supabase = useSupabaseClient()
  const user = useSupabaseUser()
  const loading = ref(false)
  const needsEmailVerification = ref(false)

  async function login(email: string, password: string) {
    loading.value = true
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (error) throw error
      user.value = data.user
    } finally {
      loading.value = false
    }
  }

  async function signup(email: string, password: string, fullName: string | null, role: Role) {
    loading.value = true
    needsEmailVerification.value = false
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
            role: role
          }
        }
      })
      
      if (error) throw error
      
      if (data.user && data.session === null) {
        needsEmailVerification.value = true
      }
      
      user.value = data.user
    } finally {
      loading.value = false
    }
  }

  async function logout() {
    await supabase.auth.signOut()
    user.value = null
    const router = useRouter()
    router.push('/login')
  }

  return {
    user,
    loading,
    needsEmailVerification,
    login,
    signup,
    logout
  }
})
