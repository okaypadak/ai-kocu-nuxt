// nuxt.config.ts
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
    'pinia-plugin-persistedstate/nuxt',
    '@pinia/nuxt'
  ],

  css: [
    '~/assets/main.css',
    '~/style.css',
    'vue-toastification/dist/index.css'
  ],

  runtimeConfig: {
    // SERVER ONLY
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    iyzicoApiKey: process.env.IYZICO_API_KEY,
    iyzicoSecretKey: process.env.IYZICO_SECRET_KEY,
    iyzicoUri: process.env.IYZICO_URI,
    premiumCookieSecret: process.env.PREMIUM_COOKIE_SECRET,

    // PUBLIC
    public: {
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL,
      supabaseAnonKey: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY,
      youtubeApiKey: process.env.NUXT_PUBLIC_YOUTUBE_API_KEY
    }
  },

  supabase: {
    redirect: false,
    url: process.env.NUXT_PUBLIC_SUPABASE_URL,
    key: process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY
  },

  vite: {
    server: {
      allowedHosts: true
    }
  }
})
