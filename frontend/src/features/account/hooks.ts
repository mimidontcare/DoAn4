import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { getApiErrorMessage } from '@/api/client'
import * as api from './api'
import type { AddressInput } from './types'

export const accountKeys = {
  addresses: ['me', 'addresses'] as const,
}

function useInvalidateAddresses() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: accountKeys.addresses })
}

export function useAddresses() {
  return useQuery({ queryKey: accountKeys.addresses, queryFn: api.fetchAddresses })
}

export function useSaveAddress() {
  const invalidate = useInvalidateAddresses()
  return useMutation({
    mutationFn: ({ id, input }: { id?: number; input: AddressInput }) => {
      if (id === undefined) return api.createAddress(input)
      const { isDefault: _ignored, ...rest } = input
      return api.updateAddress(id, rest)
    },
    onSuccess: invalidate,
  })
}

export function useSetDefaultAddress() {
  const invalidate = useInvalidateAddresses()
  return useMutation({
    mutationFn: api.setDefaultAddress,
    onSuccess: invalidate,
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}

export function useDeleteAddress() {
  const invalidate = useInvalidateAddresses()
  return useMutation({
    mutationFn: api.deleteAddress,
    onSuccess: invalidate,
    onError: (e) => toast.error(getApiErrorMessage(e)),
  })
}
