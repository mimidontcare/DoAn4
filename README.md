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
cp .env.example .env            # điền mật khẩu vào DATABASE_URL
cp .env.test.example .env.test  # cùng mật khẩu, dùng cho e2e
npm install
npx prisma generate
npm run start:dev
```

- Health check: http://localhost:3000/api/v1/health
- Swagger: http://localhost:3000/api/v1/docs

## Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Mở http://localhost:5173, trang chủ hiển thị kết quả `/health`.

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
