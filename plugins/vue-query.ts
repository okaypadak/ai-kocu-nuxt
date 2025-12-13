import { QueryClient, VueQueryPlugin, type VueQueryPluginOptions } from '@tanstack/vue-query'

export default defineNuxtPlugin((nuxtApp) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false
      }
    }
  })
  const options: VueQueryPluginOptions = {
    queryClient
  }

  nuxtApp.vueApp.use(VueQueryPlugin, options)
})
