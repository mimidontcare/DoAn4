-- CreateTable
CREATE TABLE `booking_assignments` (
    `booking_id` INTEGER NOT NULL,
    `staff_id` INTEGER NOT NULL,
    `is_leader` BOOLEAN NOT NULL DEFAULT false,
    `assigned_by` INTEGER NOT NULL,
    `assigned_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `booking_assignments_staff_id_idx`(`staff_id`),
    PRIMARY KEY (`booking_id`, `staff_id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `booking_assignments` ADD CONSTRAINT `booking_assignments_booking_id_fkey` FOREIGN KEY (`booking_id`) REFERENCES `bookings`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_assignments` ADD CONSTRAINT `booking_assignments_staff_id_fkey` FOREIGN KEY (`staff_id`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `booking_assignments` ADD CONSTRAINT `booking_assignments_assigned_by_fkey` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
