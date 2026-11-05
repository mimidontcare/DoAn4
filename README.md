# Nền tảng đặt lịch dịch vụ vệ sinh tại nhà (Đồ án 4)

Nghiệp vụ, database, API và roadmap: xem `docs/MASTER_PLAN.md`. Quy tắc làm việc: `CLAUDE.md`.

## Yêu cầu

- Node.js 22+ (đang dùng 24) và npm
- MySQL 8.0 cài sẵn trên máy, chạy ở `localhost:3306`

## Thiết lập MySQL local (một lần)

1. Sao chép `backend/prisma/setup-local-db.sql` ra một file tạm ngoài repo, thay `CHANGE_ME` (một chỗ, trong lệnh `CREATE USER`) bằng mật khẩu bạn chọn.
2. Chạy bằng tài khoản root: `mysql -u root -p < <file-tạm>.sql`
   Script tạo database `cleaning_booking`, `cleaning_booking_test` và user `cleaning_app` chỉ có quyền trên các database đó.
3. Không điền mật khẩu thật vào file trong repo.

## Backend

```bash
cd backend
cp .env.example .env            # điền mật khẩu DATABASE_URL, JWT_ACCESS_SECRET, SEED_*_PASSWORD
cp .env.test.example .env.test  # cùng mật khẩu, dùng cho e2e
npm install
npx prisma migrate dev          # tạo bảng trong database cleaning_booking
npx prisma db seed              # tạo tài khoản admin và nhân viên mẫu (thông tin trong SEED_* của .env)
npm run start:dev
```

Tài khoản seed bị bắt đổi mật khẩu ở lần đăng nhập đầu. Chạy seed lại nhiều lần an toàn: tài khoản đã có thì bỏ qua.

Seed tạo đủ 126 phường/xã của Hà Nội với mã chính thức (nguồn ghi trong `backend/prisma/data/areas/ha-noi.json`); 48 phường/xã nội thành được chia vào 4 khu vực và bật sẵn, còn lại để ngoài vùng phục vụ, admin bật khi cần.

### Dữ liệu demo

```bash
# trong backend/.env đặt SEED_DEMO_PASSWORD (≥ 8 ký tự)
npm run seed:demo
```

Tạo 5 nhân viên, 2 khách (`@demo.local`, chung mật khẩu `SEED_DEMO_PASSWORD`), 7 đơn ở đủ trạng thái, 1 đánh giá, 1 ngày không phục vụ. Thời gian tính theo lúc chạy, nên chạy trong ngày demo. Kịch bản: `docs/DEMO_SCRIPT.md`.

Seed demo chỉ chạy khi database chưa có đơn đặt lịch. Muốn làm lại từ đầu thì xóa sạch database dev (**mất toàn bộ dữ liệu trong `cleaning_booking`**):

```bash
npx prisma migrate reset        # xóa và tạo lại bảng, tự chạy seed nền
npm run seed:demo
```

Database dev tạo trước Phase 8 còn phường/xã mã tạm `DMxxx`; cần reset như trên để dùng danh sách chính thức.

### Cấu hình hay chỉnh khi demo

| Biến (`backend/.env`) | Mặc định | Ghi chú |
| --- | --- | --- |
| `AUTH_THROTTLE_LIMIT` | 5 | Số lần đăng nhập mỗi phút mỗi IP; tăng lên (vd 50) khi demo nhiều tài khoản |
| `SCHEDULER_ENABLED` | true | Job tự hủy đơn chờ phân công khi còn dưới `AUTO_CANCEL_BEFORE_HOURS` giờ |
| `WEEKEND_SURCHARGE_PERCENT` | 10 | Phụ phí thứ Bảy, Chủ nhật |

Các ngưỡng nghiệp vụ khác (giờ phục vụ, buffer, báo trước, số nhân viên tối đa…) có mô tả trong `backend/.env.example`.

- Health check: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/api/v1/docs

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Mở http://localhost:5173: trang chủ là danh sách dịch vụ. Sau khi đăng nhập, mỗi vai vào khu vực riêng: khách `/account`, nhân viên `/staff`, quản trị `/admin`.

## Tài liệu

| File | Nội dung |
| --- | --- |
| `docs/MASTER_PLAN.md` | Nghiệp vụ, business rule, database, API, roadmap |
| `docs/DESIGN_SYSTEM.md` | Quy ước giao diện |
| `docs/DEMO_SCRIPT.md` | Kịch bản demo |
| `docs/SECURITY_REVIEW.md` | Rà soát bảo mật, `npm audit` |
| `docs/uml/*.puml` | Use case, ERD, activity, state, sequence (đặt lịch, phân công, check-in, đăng nhập), component, deployment |

## Kiểm tra

| Việc | Lệnh (trong `backend/`) |
| --- | --- |
| Build | `npm run build` |
| Lint | `npx eslint "{src,test}/**/*.ts"` |
| Unit test | `npm test` |
| e2e (cần MySQL + `.env.test`) | `npm run test:e2e` |

| Việc | Lệnh (trong `frontend/`) |
| --- | --- |
| Build | `npm run build` |
| Lint | `npm run lint` |
