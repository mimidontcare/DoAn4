# Rà soát bảo mật (Phase 8)

Ngày rà soát: 2026-11-05. Đối chiếu từng mục của Master Plan v2 mục 15 với mã nguồn. Kiểm chứng tự động nằm trong `backend/test/security.e2e-spec.ts` (30 test) và các file e2e của từng module.

## 1. Đối chiếu mục 15

| Yêu cầu | Cách đáp ứng | Vị trí | Kiểm chứng |
| --- | --- | --- | --- |
| Mật khẩu hash bằng BCrypt | `bcrypt.hash` với `BCRYPT_ROUNDS`; email không tồn tại vẫn so với hash giả để thời gian phản hồi như nhau | `auth/auth.service.ts` | `auth.e2e-spec.ts` |
| JWT secret trong `.env`, không commit | `JWT_ACCESS_SECRET` bắt buộc, tối thiểu 32 ký tự, app không chạy nếu thiếu; `.env` nằm trong `.gitignore` | `config/env.validation.ts` | `env.validation.spec.ts` |
| Access token 30 phút, refresh token 7 ngày, lưu hash, thu hồi được | Refresh token lưu SHA-256, xoay vòng mỗi lần dùng, dùng lại token cũ → 401; khóa tài khoản thu hồi mọi token | `auth/auth.service.ts`, `users/users.service.ts` | `auth.e2e-spec.ts`, `staff.e2e-spec.ts` |
| RolesGuard + kiểm tra sở hữu trong service (chống IDOR) | Guard toàn cục; mọi service kiểm tra khách chủ đơn, nhân viên được giao, trưởng nhóm | `common/guards`, các `*.service.ts` | `security.e2e-spec.ts` (quét 24 endpoint có `:id`) |
| Khách đổi id xem đơn người khác | 403; địa chỉ của người khác coi như không tồn tại → 404 | `bookings.service.ts`, `addresses.service.ts` | `security.e2e-spec.ts` |
| Staff xem đơn không được giao | 403 trên cả 7 thao tác của nhân viên | `staff-bookings.service.ts` | `security.e2e-spec.ts` |
| Thành viên thường gọi API trưởng nhóm | 403 | `staff-bookings.service.ts` | `staff-bookings.e2e-spec.ts` |
| ValidationPipe whitelist + forbidNonWhitelisted | Toàn cục; trường lạ (vd `totalPrice`, `unitPrice`) → 400 | `app.setup.ts` | `bookings.e2e-spec.ts`, `staff-bookings.e2e-spec.ts` |
| Không trả `password_hash` | Mọi truy vấn dùng `select`; test quét 7 response | `*.select.ts` | `security.e2e-spec.ts` |
| helmet | Bật toàn cục | `app.setup.ts` | `security.e2e-spec.ts` (header `x-content-type-options`) |
| CORS chỉ mở cho domain frontend | `FRONTEND_ORIGIN` | `app.setup.ts` | `security.e2e-spec.ts` |
| Throttle login, register | `AUTH_THROTTLE_LIMIT` / `AUTH_THROTTLE_TTL_MS` (mặc định 5 lần / phút / IP); refresh dùng giới hạn chung | `auth/auth.controller.ts` | `auth.e2e-spec.ts` |
| Upload: kiểm tra MIME, ≤ 2MB, đổi tên file | Kiểm tra chữ ký đầu file (không tin MIME client khai), giới hạn ở MulterModule (413), tên file là UUID | `storage/` | `catalog.e2e-spec.ts`, `storage.service.spec.ts` |
| Staff chỉ thấy địa chỉ, SĐT khách của đơn được giao | Chỉ trả qua đơn có assignment của chính nhân viên; khách chỉ thấy tên nhân viên, không thấy SĐT | `booking.select.ts` | `security.e2e-spec.ts`, `assignments.e2e-spec.ts` |
| Không log token | Chỉ log lỗi hệ thống (message, stack) và số đơn job tự hủy; không log body request | `all-exceptions.filter.ts`, `scheduler.service.ts` | rà soát mã |

Kết quả: không tìm thấy lỗi cần sửa trong mã nghiệp vụ. Để chắc test quét IDOR có tác dụng, đã thử tạm bỏ điều kiện kiểm tra chủ đơn: 6 test thất bại đúng như mong đợi, sau đó khôi phục.

## 2. Phụ thuộc (`npm audit`)

| Gói | Mức | Chạy trong server? | Xử lý |
| --- | --- | --- | --- |
| `multer` 2.4.0 (qua `@nestjs/platform-express`) | high (DoS) | Có | Ép lên `^2.5.0` bằng `overrides` (cùng major); `@nestjs/platform-express` 11.x vẫn ghim 2.4.0 |
| `body-parser`, `qs` | high, moderate | Có | Nâng bản vá qua `npm audit fix` |
| `@nestjs/*` | — | Có | Nâng lên 11.2.8 (cùng major) |
| `handlebars` (critical), các gói công cụ dev | critical, moderate, low | Không | `npm audit fix`; phần còn lại thuộc eslint, jest, nest cli, chỉ dùng khi phát triển |
| `prisma` → `@prisma/config` → `deepmerge-ts` < 8 | high | Không (CLI) | Giữ nguyên: chỉ vá được bằng Prisma 7, trái với ghim 6.x (xem CLAUDE.md) |
| Frontend `follow-redirects`, `zod` | high | Có (trình duyệt) | Nâng bản vá; frontend còn 0 lỗ hổng |

Sau khi xử lý: backend 31 cảnh báo, 3 mức high đều là `deepmerge-ts` (đã chấp nhận), còn lại là công cụ dev; frontend 0.

## 3. Rủi ro đã biết, chấp nhận cho Đồ án 4

- **Refresh token trong `localStorage`**: nếu có lỗ hổng XSS thì token có thể bị đọc. Giảm thiểu: React tự escape nội dung, không dùng `dangerouslySetInnerHTML`, token xoay vòng mỗi lần dùng. Phương án tốt hơn (cookie `httpOnly`) để Đồ án tốt nghiệp.
- **Demo chạy HTTP trên máy local**: khi deploy thật phải dùng HTTPS (D11: không deploy).
- **Throttle theo IP**: nhiều người dùng chung một mạng có thể bị giới hạn chung.
