import axios from 'axios'

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

// Interceptor gắn token và refresh token sẽ thêm ở Phase 1.
export const apiClient = axios.create({ baseURL })
