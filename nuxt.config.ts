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
    '@pinia/nuxt',
    'pinia-plugin-persistedstate/nuxt'
  ],

  css: ['~/assets/main.css', '~/style.css', 'vue-toastification/dist/index.css'],

  runtimeConfig: {
    // SERVER ONLY
    supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    iyzicoApiKey: process.env.IYZICO_API_KEY,
    iyzicoSecretKey: process.env.IYZICO_SECRET_KEY,
    iyzicoUri: process.env.IYZICO_URI,
    premiumCookieSecret: process.env.PREMIUM_COOKIE_SECRET,

    // PUBLIC (client + server)
    public: {
      // Öncelik: NUXT_PUBLIC_*  -> fallback: SUPABASE_*
      supabaseUrl: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || '',
      supabaseAnonKey:
        process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ||
        process.env.SUPABASE_ANON_KEY ||
        '',

      // Proxy url public’da kalsın ki client da okuyabilsin
      supabaseProxyUrl:
        process.env.NUXT_PUBLIC_SUPABASE_PROXY_URL ||
        process.env.VITE_SUPABASE_PROXY_URL ||
        '/api/supabase-proxy',

      youtubeApiKey: process.env.YOUTUBE_API_KEY || ''
    }
  },

  supabase: {
    redirect: false,
    url: process.env.NUXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL,
    key:
      process.env.NUXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.SUPABASE_ANON_KEY ||
      process.env.SUPABASE_KEY
  },

  vite: {
    server: {
      allowedHosts: true
    }
  }
})
