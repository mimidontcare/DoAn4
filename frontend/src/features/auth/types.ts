export type UserRole = 'CUSTOMER' | 'STAFF' | 'ADMIN'

/** User do backend trả về (không bao giờ có password_hash). */
export interface AuthUser {
  id: number
  email: string
  phone: string
  fullName: string
  role: UserRole
  status: 'ACTIVE' | 'LOCKED'
  mustChangePassword: boolean
  createdAt: string
}

export interface AuthResult {
  accessToken: string
  refreshToken: string
  user: AuthUser
}
