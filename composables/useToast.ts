// Mock implementation to avoid SSR issues with vue-toastification
export const useToast = () => {
    return {
       success: (msg: string) => console.log('[Toast Success]', msg),
       error: (msg: string) => console.log('[Toast Error]', msg),
       warning: (msg: string) => console.log('[Toast Warning]', msg),
       info: (msg: string) => console.log('[Toast Info]', msg),
       clear: () => {}
    }
}
