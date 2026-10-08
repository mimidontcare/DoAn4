import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'isPublic';

/** Route không cần đăng nhập (mặc định mọi route đều cần JWT). */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
