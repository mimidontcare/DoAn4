import { apiClient, type ApiResponse } from '@/api/client'

export interface HealthResult {
  status: 'ok' | 'error'
  db: 'up' | 'down'
  time: string
}

export async function fetchHealth(): Promise<HealthResult> {
  const res = await apiClient.get<ApiResponse<HealthResult>>('/health', {
    // Backend trả 503 kèm { db: 'down' }; vẫn cần đọc body để hiển thị.
    validateStatus: (status) => status === 200 || status === 503,
  })
  if (!res.data.data) {
    throw new Error('Phản hồi /health không hợp lệ')
  }
  return res.data.data
}
