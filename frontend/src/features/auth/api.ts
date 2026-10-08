import { apiClient, type ApiResponse } from '@/api/client'
import type { AuthResult } from './types'

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  fullName: string
  email: string
  phone: string
  password: string
}

export interface ChangePasswordInput {
  currentPassword: string
  newPassword: string
}

function unwrap<T>(body: ApiResponse<T>): T {
  if (body.data === null) {
    throw new Error('Phản hồi từ máy chủ không hợp lệ')
  }
  return body.data
}

export async function login(input: LoginInput): Promise<AuthResult> {
  const res = await apiClient.post<ApiResponse<AuthResult>>('/auth/login', input)
  return unwrap(res.data)
}

export async function register(input: RegisterInput): Promise<AuthResult> {
  const res = await apiClient.post<ApiResponse<AuthResult>>(
    '/auth/register',
    input,
  )
  return unwrap(res.data)
}

export async function logout(refreshToken: string): Promise<void> {
  await apiClient.post('/auth/logout', { refreshToken })
}

export async function changePassword(
  input: ChangePasswordInput,
): Promise<AuthResult> {
  const res = await apiClient.put<ApiResponse<AuthResult>>(
    '/me/password',
    input,
  )
  return unwrap(res.data)
}
