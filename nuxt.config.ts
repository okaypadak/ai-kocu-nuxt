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

  css: ['~/assets/main.css', '~/style.css', 'vue-toastification/dist/index.css'],

  runtimeConfig: {
    // server-only
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY || '',
    iyzicoApiKey: process.env.IYZICO_API_KEY || '',
    iyzicoSecretKey: process.env.IYZICO_SECRET_KEY || '',
    iyzicoUri: process.env.IYZICO_URI || '',
    premiumCookieSecret: process.env.PREMIUM_COOKIE_SECRET || '',

    public: {
      // Supabase (public)
      supabaseUrl:
        process.env.NUXT_PUBLIC_SUPABASE_URL ||
        process.env.SUPABASE_URL ||
        '',
      supabaseAnonKey:
        process.env.NUXT_PUBLIC_SUPABASE_KEY ||
        process.env.SUPABASE_KEY ||
        process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ||
        '',

      youtubeApiKey: process.env.YOUTUBE_API_KEY || ''
    }
  },

  supabase: {
    redirect: false,
    url: process.env.NUXT_PUBLIC_SUPABASE_URL || 
    process.env.SUPABASE_URL,
    key:
      process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY
  }
})
