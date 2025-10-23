-- Create feedback table
CREATE TABLE IF NOT EXISTS `feedback` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `general_user_id` int(11) DEFAULT NULL,
  `staff_id` int(11) DEFAULT NULL,
  `message` text NOT NULL,
  `rating` tinyint(1) DEFAULT NULL COMMENT 'Rating from 1 to 5 stars',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `general_user_id` (`general_user_id`),
  KEY `staff_id` (`staff_id`),
  CONSTRAINT `fk_feedback_general_user` FOREIGN KEY (`general_user_id`) REFERENCES `general_users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `fk_feedback_staff` FOREIGN KEY (`staff_id`) REFERENCES `staff` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
