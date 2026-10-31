-- CreateTable
CREATE TABLE `bookings` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `code` VARCHAR(20) NOT NULL,
    `customer_id` INTEGER NOT NULL,
    `service_id` INTEGER NOT NULL,
    `ward_id` INTEGER NOT NULL,
    `zone_id` INTEGER NOT NULL,
    `service_name` VARCHAR(150) NOT NULL,
    `address_text` VARCHAR(500) NOT NULL,
    `contact_name` VARCHAR(100) NOT NULL,
    `contact_phone` VARCHAR(20) NOT NULL,
    `start_at` DATETIME(3) NOT NULL,
    `end_at` DATETIME(3) NOT NULL,
    `man_minutes` INTEGER NOT NULL,
    `staff_count` INTEGER NOT NULL,
    `duration_minutes` INTEGER NOT NULL,
    `items_total` INTEGER NOT NULL,
    `subtotal` INTEGER NOT NULL,
    `surcharge` INTEGER NOT NULL DEFAULT 0,
    `total_price` INTEGER NOT NULL,
    `status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'PENDING',
    `payment_status` ENUM('UNPAID', 'PAID') NOT NULL DEFAULT 'UNPAID',
    `payment_method` ENUM('CASH', 'BANK_TRANSFER') NULL,
    `paid_at` DATETIME(3) NULL,
    `paid_confirmed_by` INTEGER NULL,
    `adjustment_status` ENUM('NONE', 'PENDING', 'ACCEPTED', 'REJECTED') NOT NULL DEFAULT 'NONE',
    `note` VARCHAR(500) NULL,
    `cancel_reason` ENUM('CUSTOMER_REQUEST', 'CUSTOMER_NO_SHOW', 'NO_STAFF_AVAILABLE', 'ADMIN_DECISION', 'OTHER') NULL,
    `cancel_note` VARCHAR(500) NULL,
    `cancelled_by` INTEGER NULL,
    `cancelled_at` DATETIME(3) NULL,
    `reschedule_count` INTEGER NOT NULL DEFAULT 0,
    `version` INTEGER NOT NULL DEFAULT 0,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updated_at` DATETIME(3) NOT NULL,

    UNIQUE INDEX `bookings_code_key`(`code`),
    INDEX `bookings_status_start_at_idx`(`status`, `start_at`),
    INDEX `bookings_zone_id_start_at_idx`(`zone_id`, `start_at`),
    INDEX `bookings_customer_id_status_idx`(`customer_id`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_items` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_id` INTEGER NOT NULL,
    `service_item_id` INTEGER NOT NULL,
    `name_snapshot` VARCHAR(150) NOT NULL,
    `unit` ENUM('UNIT', 'M2') NOT NULL,
    `unit_price` INTEGER NOT NULL,
    `minutes_per_unit` INTEGER NOT NULL,
    `quantity` INTEGER NOT NULL,
    `proposed_quantity` INTEGER NULL,
    `amount` INTEGER NOT NULL,

    INDEX `booking_items_booking_id_idx`(`booking_id`),
    INDEX `booking_items_service_item_id_idx`(`service_item_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `booking_status_histories` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `booking_id` INTEGER NOT NULL,
    `from_status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NULL,
    `to_status` ENUM('PENDING', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED') NOT NULL,
    `action` ENUM('CREATE', 'ASSIGN', 'DECLINE', 'CHECK_IN', 'ADJUST', 'COMPLETE', 'PAYMENT', 'CANCEL', 'RESCHEDULE') NOT NULL,
    `changed_by` INTEGER NULL,
    `note` VARCHAR(500) NULL,
    `created_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_status_histories_booking_id_idx`(`booking_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_customer_id_fkey` FOREIGN KEY (`customer_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_service_id_fkey` FOREIGN KEY (`service_id`) REFERENCES `services`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_ward_id_fkey` FOREIGN KEY (`ward_id`) REFERENCES `wards`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_zone_id_fkey` FOREIGN KEY (`zone_id`) REFERENCES `service_zones`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_paid_confirmed_by_fkey` FOREIGN KEY (`paid_confirmed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `bookings` ADD CONSTRAINT `bookings_cancelled_by_fkey` FOREIGN KEY (`cancelled_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_items` ADD CONSTRAINT `booking_items_service_item_id_fkey` FOREIGN KEY (`service_item_id`) REFERENCES `service_items`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_status_histories` ADD CONSTRAINT `booking_status_histories_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_status_histories` ADD CONSTRAINT `booking_status_histories_changed_by_fkey` FOREIGN KEY (`changed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;
