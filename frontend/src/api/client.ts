import axios, { AxiosError, type InternalAxiosRequestConfig } from 'axios'
import type { AuthResult } from '@/features/auth/types'
import { useAuthStore } from '@/stores/auth.store'

/** Response thống nhất của backend: { success, data, message, errors }. */
export interface ApiResponse<T> {
  success: boolean
  data: T | null
  message: string
  errors: unknown[] | null
}

const baseURL = import.meta.env.VITE_API_BASE_URL
if (!baseURL) {
  throw new Error('Thiếu biến môi trường VITE_API_BASE_URL')
}

export const apiClient = axios.create({ baseURL })

// 401 ở các route này là kết quả nghiệp vụ (sai mật khẩu, token hỏng), không phải hết hạn access token.
const NO_REFRESH_URLS = ['/auth/login', '/auth/register', '/auth/refresh']

apiClient.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

apiClient.interceptors.response.use(undefined, async (error: unknown) => {
  if (!(error instanceof AxiosError) || error.response?.status !== 401) {
    throw error
  }
  const config = error.config as
    | (InternalAxiosRequestConfig & { _retried?: boolean })
    | undefined
  if (!config || config._retried || NO_REFRESH_URLS.includes(config.url ?? '')) {
    throw error
  }

  const token = await refreshSession()
  if (!token) {
    throw error
  }
  config._retried = true
  config.headers.Authorization = `Bearer ${token}`
  return apiClient(config)
})

let refreshing: Promise<string | null> | null = null

/**
 * Đổi refresh token lấy cặp token mới. Nhiều request cùng gặp 401 chỉ gọi refresh
 * một lần (refresh token bị thu hồi sau mỗi lần dùng nên không được gọi song song).
 * Trả access token mới, hoặc null khi phiên đã hết (store bị xóa → guard đưa về /login).
 */
export function refreshSession(): Promise<string | null> {
  refreshing ??= doRefresh().finally(() => {
    refreshing = null
  })
  return refreshing
}

async function doRefresh(): Promise<string | null> {
  const store = useAuthStore.getState()
  if (!store.refreshToken) {
    store.markAnonymous()
    return null
  }
  try {
    // Gọi axios gốc, không qua interceptor, để tránh vòng lặp refresh.
    const res = await axios.post<ApiResponse<AuthResult>>(
      `${baseURL}/auth/refresh`,
      { refreshToken: store.refreshToken },
    )
    const result = res.data.data!
    useAuthStore.getState().setSession(result)
    return result.accessToken
  } catch (error) {
    const status = error instanceof AxiosError ? error.response?.status : undefined
    if (status === 401 || status === 403) {
      // Refresh token hết hạn, bị thu hồi hoặc tài khoản bị khóa.
      useAuthStore.getState().clear()
    } else {
      // Mất kết nối, 429, lỗi server: giữ refresh token để thử lại lần sau.
      useAuthStore.getState().markAnonymous()
    }
    return null
  }
}

/** Thông báo lỗi đọc được từ response của backend. */
export function getApiErrorMessage(error: unknown): string {
  if (error instanceof AxiosError) {
    if (!error.response) {
      return 'Không kết nối được máy chủ, vui lòng thử lại'
    }
    const body = error.response.data as Partial<ApiResponse<null>> | undefined
    if (error.response.status === 429) {
      return 'Bạn thao tác quá nhanh, vui lòng thử lại sau ít phút'
    }
    if (body?.message) {
      return body.message
    }
  }
  return 'Đã có lỗi xảy ra, vui lòng thử lại'
}
