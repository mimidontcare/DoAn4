# CLAUDE.md — Nền tảng đặt lịch dịch vụ vệ sinh tại nhà (Đồ án 4)

File này được đọc ở đầu mỗi phiên làm việc. Mọi quy tắc dưới đây là bắt buộc.

## 1. Nguồn sự thật

- Toàn bộ nghiệp vụ, business rule, database, API, roadmap nằm trong `docs/MASTER_PLAN.md`.
- Trước mỗi task, đọc phần liên quan của master plan (business rules ở mục 4, database mục 7, API mục 12, roadmap mục 16).
- Nếu yêu cầu của task mâu thuẫn với master plan: **dừng lại và hỏi**, không tự chọn.
- Không sửa `docs/MASTER_PLAN.md` trừ khi được yêu cầu rõ ràng.

## 2. Ngôn ngữ

- Trao đổi với tôi, báo cáo, tài liệu trong `docs/`: tiếng Việt.
- Tên biến, hàm, class, file, bảng, cột, endpoint, commit message: tiếng Anh.
- Tên bảng và cột DB dùng snake_case (map sang camelCase trong Prisma bằng `@map`/`@@map`).

## 3. Stack đã khóa (không tự ý thay đổi, không thêm thư viện ngoài danh sách khi chưa được duyệt)

- **Backend**: NestJS + TypeScript, Prisma + Prisma Migrate, MySQL 8 (Docker Compose), class-validator + class-transformer, @nestjs/jwt + @nestjs/passport + bcrypt, @nestjs/config, @nestjs/swagger, @nestjs/throttler, @nestjs/schedule, helmet, multer, dayjs (utc + timezone), Jest + Supertest.
- **Frontend**: React + Vite + TypeScript, Tailwind + shadcn/ui, React Router, TanStack Query, Zustand (chỉ auth), React Hook Form + Zod, Axios, dayjs, sonner.
- **Không dùng**: Redis, message queue, WebSocket, Maps API, cổng thanh toán, email, Redux, microservices.

## 4. Quy trình mỗi task

1. Đọc phần liên quan của master plan và code hiện có.
2. Trình bày **spec** trước khi code: mục tiêu, phạm vi (BE/FE), file dự kiến tạo/sửa, business rule liên quan, cách test. **Chờ tôi duyệt.**
3. Chỉ làm đúng phạm vi đã duyệt.
4. Kiểm tra: build, lint, test liên quan; chạy thử nếu có thể.
5. Báo cáo theo mẫu ở mục 9.

## 5. 14 nguyên tắc code

1. Không code trước khi có plan.
2. Không tự ý thay đổi kiến trúc.
3. Không tự ý đổi công nghệ.
4. Không tự tạo chức năng ngoài scope.
5. Không sửa backend nếu task chỉ liên quan frontend.
6. Không sửa frontend nếu task chỉ liên quan backend.
7. Không xóa code cũ nếu chưa giải thích lý do.
8. Không viết lại module đang hoạt động nếu không cần.
9. Mỗi task chỉ thay đổi phạm vi cần thiết.
10. Sau mỗi task phải kiểm tra code có chạy hay không.
11. Phải báo rõ những file đã thay đổi.
12. Phải báo rõ những file không thay đổi.
13. Phải giải thích dependency giữa các thay đổi.
14. Nếu phát hiện vấn đề kiến trúc thì phải dừng và hỏi trước khi tự ý thay đổi lớn.

Bổ sung:

- Migration đã chạy thì không sửa; muốn đổi thì tạo migration mới.
- Không commit `.env`, secret, token. Mọi cấu hình đọc từ biến môi trường; cập nhật `.env.example` khi thêm biến.
- Không tự chạy lệnh phá hủy dữ liệu (`prisma migrate reset`, `DROP`, xóa volume Docker) khi chưa hỏi.
- Một nhánh git mỗi phase (`phase-0-setup`, `phase-1-auth`…); commit theo Conventional Commits (`feat(booking): ...`, `fix(auth): ...`).

## 6. Quy ước backend (NestJS)

- Chia module theo nghiệp vụ: `auth`, `users`, `catalog`, `areas`, `staff`, `bookings`, `reviews`, `dashboard`, `scheduler`, `storage`. Không đặt tên module là `service`.
- Mỗi module: `*.module.ts`, `*.controller.ts`, `*.service.ts`, thư mục `dto/`. Không thêm tầng repository — `PrismaService` là tầng truy cập dữ liệu.
- **Controller mỏng**: chỉ nhận request, gọi service, trả kết quả. **Business rule chỉ nằm trong service.**
- Kiểm tra quyền sở hữu (chống IDOR) trong service, không dựa vào frontend.
- Không trả object Prisma trực tiếp; dùng `select` hoặc hàm map. Không bao giờ trả `password_hash`.
- Tiền tố API `/api/v1`. Response thống nhất `{ success, data, message, errors }` qua interceptor; lỗi qua exception filter toàn cục.
- Mã lỗi: 400 validate · 401 · 403 (sai role / không phải chủ sở hữu) · 404 · 409 (xung đột lịch / version) · 422 (vi phạm business rule).
- `ValidationPipe` toàn cục với `whitelist: true`, `forbidNonWhitelisted: true`, `transform: true`.
- Booking tách controller theo role (khách, staff, admin); logic lõi nằm ở `pricing.service.ts`, `availability.service.ts`, `assignment.service.ts`, `booking-state.ts`.

## 7. Quy ước frontend (React)

- Chia theo `features/` (auth, catalog, booking, staff, admin, review); mỗi feature tự chứa pages, components, api, hooks, schema.
- Dữ liệu từ server dùng TanStack Query; Zustand chỉ lưu trạng thái đăng nhập.
- Form dùng React Hook Form + Zod. Frontend kiểm tra chỉ để trải nghiệm tốt hơn; backend mới quyết định.
- Không hardcode URL API; đọc từ biến môi trường của Vite.
- Không dùng localStorage cho dữ liệu nghiệp vụ.

## 8. Bất biến nghiệp vụ (không bao giờ được phá)

- Giá luôn do server tính; giá client gửi lên bị bỏ qua. Tiền là số nguyên VND, không dùng số thực.
- Giá, tên hạng mục, địa chỉ được **snapshot** vào booking khi tạo.
- Chuyển trạng thái booking chỉ qua một hàm duy nhất theo bảng chuyển trạng thái (master plan mục 4, phần B); mọi thay đổi trạng thái hoặc nhóm đều ghi `booking_status_histories`.
- Phân công chạy trong transaction: khóa dòng nhân viên **theo id tăng dần** (`SELECT ... FOR UPDATE`), kiểm tra trùng lịch lại, cập nhật booking kèm điều kiện `version`.
- Thời gian lưu UTC; rule giờ phục vụ và cuối tuần quy đổi sang `Asia/Ho_Chi_Minh` trước khi kiểm tra.
- Các ngưỡng (giờ phục vụ, buffer, báo trước, MAX_STAFF_PER_BOOKING, % điều chỉnh tối đa…) nằm trong cấu hình, không hardcode.
- Không hardcode tên tỉnh/thành trong source (trừ file seed).
- Không xóa cứng user, dịch vụ, hạng mục; chỉ khóa hoặc tắt.

## 9. Mẫu báo cáo sau mỗi task

```
## Kết quả: <tên task>
**Đã làm:** ...
**File tạo mới:** ...
**File đã sửa:** ... (lý do từng file)
**File không thay đổi (liên quan):** ...
**Dependency giữa các thay đổi:** ...
**Kiểm tra đã chạy:** <lệnh> → <kết quả>
**Vấn đề / câu hỏi còn mở:** ...
```

## 10. Lệnh thường dùng

_Điền sau khi hoàn thành Phase 0._

## 11. Trạng thái hiện tại

- Master plan v2: đã duyệt.
- Phase hiện tại: **Phase 0 — Setup** (chưa bắt đầu).
- Cập nhật mục này khi hoàn thành mỗi phase.
