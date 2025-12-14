// nuxt.config.ts

const env = (...keys: string[]) => keys.map((k) => process.env[k]).find(Boolean)

const SUPABASE_URL = env(
  'NUXT_PUBLIC_SUPABASE_URL',
  'SUPABASE_URL',
  'NUXT_SUPABASE_URL',
  'VITE_SUPABASE_URL'
)

const SUPABASE_ANON_KEY = env(
  'NUXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_ANON_KEY',
  'SUPABASE_KEY',
  'NUXT_SUPABASE_KEY',
  'VITE_SUPABASE_ANON_KEY'
)

export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',

  devtools: { enabled: true },

  modules: [
    '@nuxtjs/supabase',
    '@nuxt/fonts',
    '@nuxt/icon',
    '@nuxt/image',
    '@nuxt/scripts',
    '@nuxt/ui',
    '@unocss/nuxt',
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt'
  ],

  css: [
    '~/assets/main.css',
    '~/style.css',
    'vue-toastification/dist/index.css'
  ],

  runtimeConfig: {
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    iyzicoApiKey: process.env.IYZICO_API_KEY,
    iyzicoSecretKey: process.env.IYZICO_SECRET_KEY,
    iyzicoUri: process.env.IYZICO_URI,
    premiumCookieSecret: process.env.PREMIUM_COOKIE_SECRET,

    // PUBLIC (client + server)
    public: {
      supabaseUrl: SUPABASE_URL,
      supabaseAnonKey: SUPABASE_ANON_KEY,
      youtubeApiKey: process.env.NUXT_PUBLIC_YOUTUBE_API_KEY
    }
  },

  supabase: {
    redirect: false,
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY
  },

  vite: {
    server: {
      allowedHosts: true
    }
  }
})
