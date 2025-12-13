import { useThemeStore } from '~/stores/theme.store'

export default defineNuxtPlugin(() => {
  const theme = useThemeStore()
  theme.init()
})
