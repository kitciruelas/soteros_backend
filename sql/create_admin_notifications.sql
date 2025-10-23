-- Admin Notifications Table
-- This table stores notifications specifically for admin users

CREATE TABLE IF NOT EXISTS `admin_notifications` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `admin_id` int(11) DEFAULT NULL COMMENT 'NULL means notification for all admins',
  `type` enum('incident','welfare','alert','safety_protocol','system','team','staff') NOT NULL DEFAULT 'system',
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `severity` enum('info','warning','high','critical') NOT NULL DEFAULT 'info',
  `priority_level` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `is_read` tinyint(1) NOT NULL DEFAULT 0,
  `related_type` enum('incident','welfare','alert','protocol','team','staff','user') DEFAULT NULL COMMENT 'Type of related entity',
  `related_id` int(11) DEFAULT NULL COMMENT 'ID of the related entity (incident_id, report_id, etc)',
  `action_url` varchar(500) DEFAULT NULL COMMENT 'URL to navigate when notification is clicked',
  `metadata` json DEFAULT NULL COMMENT 'Additional data like location, user info, etc',
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `admin_id` (`admin_id`),
  KEY `type` (`type`),
  KEY `severity` (`severity`),
  KEY `is_read` (`is_read`),
  KEY `created_at` (`created_at`),
  KEY `priority_level` (`priority_level`),
  CONSTRAINT `fk_admin_notifications_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin` (`admin_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create index for faster queries
CREATE INDEX idx_admin_notifications_lookup ON admin_notifications(admin_id, is_read, created_at DESC);
CREATE INDEX idx_admin_notifications_type_priority ON admin_notifications(type, priority_level, created_at DESC);

