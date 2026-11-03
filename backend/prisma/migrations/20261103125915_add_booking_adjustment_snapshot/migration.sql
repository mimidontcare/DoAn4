-- A04, P02: snapshot phút công lúc đặt và mức tối thiểu của dịch vụ.
-- Thêm cột với giá trị tạm để chạy được trên bảng đã có dữ liệu, backfill, rồi bỏ default.

-- AlterTable
ALTER TABLE `bookings` ADD COLUMN `min_charge` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `original_man_minutes` INTEGER NOT NULL DEFAULT 0;

-- Đơn cũ: phút công lúc đặt bằng phút công hiện tại (chưa có điều chỉnh nào),
-- mức tối thiểu lấy theo dịch vụ hiện tại.
UPDATE `bookings` SET `original_man_minutes` = `man_minutes`;
UPDATE `bookings` b JOIN `services` s ON s.`id` = b.`service_id` SET b.`min_charge` = s.`min_charge`;

ALTER TABLE `bookings` ALTER COLUMN `min_charge` DROP DEFAULT,
    ALTER COLUMN `original_man_minutes` DROP DEFAULT;
