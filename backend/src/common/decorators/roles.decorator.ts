import { SetMetadata } from '@nestjs/common';
import { UserRole } from '@prisma/client';

export const ROLES_KEY = 'roles';

/** Chỉ các role được liệt kê mới gọi được route; sai role → 403. */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
