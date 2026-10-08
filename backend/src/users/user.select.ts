import { Prisma } from '@prisma/client';

/** Các field của user được phép trả ra ngoài; không bao giờ có password_hash. */
export const PUBLIC_USER_SELECT = {
  id: true,
  email: true,
  phone: true,
  fullName: true,
  role: true,
  status: true,
  mustChangePassword: true,
  createdAt: true,
} satisfies Prisma.UserSelect;

export type PublicUser = Prisma.UserGetPayload<{
  select: typeof PUBLIC_USER_SELECT;
}>;
