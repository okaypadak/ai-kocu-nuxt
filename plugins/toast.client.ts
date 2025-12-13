import Toast, { type PluginOptions } from 'vue-toastification'

export default defineNuxtPlugin((nuxtApp) => {
  const options: PluginOptions = {
    position: 'bottom-right'
  }

  nuxtApp.vueApp.use(Toast, options)
})
