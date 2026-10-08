import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange';

/**
 * Route vẫn gọi được khi tài khoản đang bị bắt đổi mật khẩu (must_change_password).
 * Mọi route đăng nhập khác trả 403 cho tới khi đổi mật khẩu xong (rule U01).
 */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
