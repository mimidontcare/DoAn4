import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useAuthStore } from '@/stores/auth.store'
import { changePassword, login, logout, register } from './api'

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({ mutationFn: login, onSuccess: setSession })
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({ mutationFn: register, onSuccess: setSession })
}

export function useChangePassword() {
  const setSession = useAuthStore((s) => s.setSession)
  return useMutation({ mutationFn: changePassword, onSuccess: setSession })
}

/** Thu hồi refresh token ở server rồi xóa phiên; lỗi mạng vẫn đăng xuất ở client. */
export function useLogout() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { refreshToken } = useAuthStore.getState()
      if (refreshToken) {
        await logout(refreshToken).catch(() => undefined)
      }
    },
    onSettled: () => {
      useAuthStore.getState().clear()
      queryClient.clear()
    },
  })
}
