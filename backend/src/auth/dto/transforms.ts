import { Transform } from 'class-transformer';

/** Cắt khoảng trắng hai đầu; giữ nguyên giá trị không phải chuỗi để validator báo lỗi kiểu. */
export const Trim = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  );

/** Email so sánh không phân biệt hoa thường: lưu và tìm theo dạng chữ thường. */
export const NormalizeEmail = () =>
  Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  );

/** SĐT Việt Nam: 10 số, bắt đầu bằng 0. */
export const VN_PHONE_REGEX = /^0\d{9}$/;

// bcrypt chỉ dùng 72 byte đầu của mật khẩu.
export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 72;
