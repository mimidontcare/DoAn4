import { apiClient, unwrap, type ApiResponse } from '@/api/client'
import type { Address, AddressInput } from './types'

export async function fetchAddresses(): Promise<Address[]> {
  const res = await apiClient.get<ApiResponse<Address[]>>('/me/addresses')
  return unwrap(res.data)
}

export async function createAddress(input: AddressInput): Promise<Address> {
  const res = await apiClient.post<ApiResponse<Address>>('/me/addresses', input)
  return unwrap(res.data)
}

export async function updateAddress(
  id: number,
  input: Omit<AddressInput, 'isDefault'>,
): Promise<Address> {
  const res = await apiClient.put<ApiResponse<Address>>(`/me/addresses/${id}`, input)
  return unwrap(res.data)
}

export async function setDefaultAddress(id: number): Promise<Address> {
  const res = await apiClient.patch<ApiResponse<Address>>(`/me/addresses/${id}/default`)
  return unwrap(res.data)
}

export async function deleteAddress(id: number): Promise<void> {
  await apiClient.delete(`/me/addresses/${id}`)
}
