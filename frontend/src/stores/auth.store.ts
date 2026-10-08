import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import type { AuthResult, AuthUser } from '@/features/auth/types'

type AuthStatus = 'initializing' | 'authenticated' | 'anonymous'

interface AuthState {
  /** initializing: đang khôi phục phiên từ refresh token lúc mở trang. */
  status: AuthStatus
  accessToken: string | null
  refreshToken: string | null
  user: AuthUser | null
  setSession: (result: AuthResult) => void
  setUser: (user: AuthUser) => void
  markAnonymous: () => void
  clear: () => void
}

/**
 * Trạng thái đăng nhập (Zustand chỉ dùng cho auth).
 * Access token và user chỉ giữ trong bộ nhớ; riêng refresh token lưu localStorage
 * để F5 không mất phiên.
 */
export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      status: 'initializing',
      accessToken: null,
      refreshToken: null,
      user: null,
      setSession: ({ accessToken, refreshToken, user }) =>
        set({ status: 'authenticated', accessToken, refreshToken, user }),
      setUser: (user) => set({ user }),
      markAnonymous: () => set({ status: 'anonymous' }),
      clear: () =>
        set({
          status: 'anonymous',
          accessToken: null,
          refreshToken: null,
          user: null,
        }),
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ refreshToken: state.refreshToken }),
    },
  ),
)
