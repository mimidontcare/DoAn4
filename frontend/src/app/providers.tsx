import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useEffect, type ReactNode } from 'react'
import { Toaster } from 'sonner'
import { refreshSession } from '@/api/client'

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
})

/**
 * Khôi phục phiên khi mở hoặc F5 trang: đổi refresh token (localStorage) lấy access token.
 * refreshSession gộp các lần gọi trùng nhau nên StrictMode gọi effect 2 lần vẫn an toàn.
 */
function useRestoreSession() {
  useEffect(() => {
    void refreshSession()
  }, [])
}

export function Providers({ children }: { children: ReactNode }) {
  useRestoreSession()
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      <Toaster richColors />
    </QueryClientProvider>
  )
}
