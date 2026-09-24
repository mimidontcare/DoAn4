-- Chạy MỘT lần bằng tài khoản root của MySQL local (MySQL 8.0):
--   mysql -u root -p < prisma/setup-local-db.sql
-- Trước khi chạy: thay CHANGE_ME bằng mật khẩu của bạn (cùng mật khẩu trong backend/.env).
-- Script chỉ tạo database và user của dự án, không đụng database khác.

CREATE DATABASE IF NOT EXISTS cleaning_booking
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE DATABASE IF NOT EXISTS cleaning_booking_test
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'cleaning_app'@'localhost' IDENTIFIED BY 'CHANGE_ME';

-- Prisma Migrate cần tạo shadow database (tên dạng prisma_migrate_shadow_db_*) từ Phase 1.
GRANT ALL PRIVILEGES ON cleaning_booking.* TO 'cleaning_app'@'localhost';
GRANT ALL PRIVILEGES ON cleaning_booking_test.* TO 'cleaning_app'@'localhost';
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE
  ON `prisma\_migrate\_shadow\_db\_%`.* TO 'cleaning_app'@'localhost';
FLUSH PRIVILEGES;
