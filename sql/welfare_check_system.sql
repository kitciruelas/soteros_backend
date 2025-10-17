-- Welfare Check System Tables
-- This migration adds welfare check functionality with admin controls

-- Table for welfare check settings (admin controlled)
CREATE TABLE `welfare_check_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `is_active` tinyint(1) NOT NULL DEFAULT 0,
  `title` varchar(255) NOT NULL DEFAULT 'Welfare Check System',
  `description` text DEFAULT NULL,
  `message_when_disabled` text DEFAULT 'Welfare check system is currently disabled. Please try again later.',
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `created_by` (`created_by`),
  CONSTRAINT `welfare_check_settings_ibfk_1` FOREIGN KEY (`created_by`) REFERENCES `admin` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Table for welfare check reports
CREATE TABLE `welfare_reports` (
  `report_id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `setting_id` int(11) NOT NULL,
  `status` enum('safe','needs_help') NOT NULL,
  `additional_info` text DEFAULT NULL,
  `submitted_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`report_id`),
  KEY `user_id` (`user_id`),
  KEY `setting_id` (`setting_id`),
  CONSTRAINT `welfare_reports_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `general_users` (`user_id`) ON DELETE CASCADE,
  CONSTRAINT `welfare_reports_ibfk_2` FOREIGN KEY (`setting_id`) REFERENCES `welfare_check_settings` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert default welfare check settings (disabled by default)
INSERT INTO `welfare_check_settings` (`is_active`, `title`, `description`, `message_when_disabled`, `created_by`) 
VALUES (0, 'Welfare Check System', 'Emergency welfare status reporting system for citizens', 'The welfare check system is currently disabled. Please try again later or contact emergency services directly.', NULL);





