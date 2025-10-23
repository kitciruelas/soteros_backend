-- Manual SQL for adding admin tables to proteq_db
-- Copy and paste this into phpMyAdmin SQL tab

-- Alerts table for email notifications
CREATE TABLE IF NOT EXISTS `alerts` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `message` text NOT NULL,
  `type` enum('emergency','warning','info') NOT NULL DEFAULT 'info',
  `recipients` json DEFAULT NULL,
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` enum('draft','sent','scheduled') NOT NULL DEFAULT 'draft',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `sent_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Alert logs for tracking email sending
CREATE TABLE IF NOT EXISTS `alert_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `alert_id` int(11) NOT NULL,
  `action` varchar(50) NOT NULL,
  `recipients_count` int(11) DEFAULT 0,
  `details` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `alert_id` (`alert_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Activity logs for admin actions
CREATE TABLE IF NOT EXISTS `activity_logs` (
  `id` INT(11) NOT NULL AUTO_INCREMENT,
  `admin_id` INT(11) DEFAULT NULL,
  `staff_id` INT(11) DEFAULT NULL,
  `general_user_id` INT(11) DEFAULT NULL,
  `action` VARCHAR(100) NOT NULL,
  `details` TEXT DEFAULT NULL,
  `ip_address` VARCHAR(45) DEFAULT NULL,
  `user_agent` TEXT DEFAULT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),

  -- Foreign Keys
  CONSTRAINT `fk_activity_logs_admin` FOREIGN KEY (`admin_id`) REFERENCES `admin`(`admin_id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_activity_logs_staff` FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_activity_logs_general` FOREIGN KEY (`general_user_id`) REFERENCES `general_users`(`user_id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Evacuation routes table
CREATE TABLE IF NOT EXISTS `evacuation_routes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `start_location` varchar(255) NOT NULL,
  `end_location` varchar(255) NOT NULL,
  `waypoints` json DEFAULT NULL,
  `distance` decimal(10,2) DEFAULT NULL,
  `estimated_time` int(11) DEFAULT NULL COMMENT 'in minutes',
  `status` enum('active','inactive','under_review') NOT NULL DEFAULT 'active',
  `priority` enum('primary','secondary','emergency') NOT NULL DEFAULT 'primary',
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Enhanced safety protocols table
CREATE TABLE IF NOT EXISTS `safety_protocols_enhanced` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `description` text NOT NULL,
  `category` varchar(100) NOT NULL,
  `priority` enum('low','medium','high','critical') NOT NULL DEFAULT 'medium',
  `status` enum('active','draft','archived') NOT NULL DEFAULT 'active',
  `steps` json NOT NULL,
  `resources_needed` json DEFAULT NULL,
  `target_audience` varchar(255) DEFAULT NULL,
  `created_by` int(11) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `category` (`category`),
  KEY `priority` (`priority`),
  KEY `status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Reports table for generated reports
CREATE TABLE IF NOT EXISTS `reports` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `type` enum('incident','user','staff','evacuation','safety','custom') NOT NULL,
  `description` text DEFAULT NULL,
  `parameters` json DEFAULT NULL,
  `file_path` varchar(500) DEFAULT NULL,
  `file_size` int(11) DEFAULT NULL,
  `status` enum('generating','completed','failed') NOT NULL DEFAULT 'generating',
  `generated_by` int(11) NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `type` (`type`),
  KEY `status` (`status`),
  KEY `generated_by` (`generated_by`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- System settings table
CREATE TABLE IF NOT EXISTS `system_settings` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `setting_key` varchar(100) NOT NULL UNIQUE,
  `setting_value` text DEFAULT NULL,
  `setting_type` enum('string','number','boolean','json') NOT NULL DEFAULT 'string',
  `description` text DEFAULT NULL,
  `category` varchar(50) DEFAULT 'general',
  `is_public` boolean DEFAULT FALSE,
  `updated_by` int(11) DEFAULT NULL,
  `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `setting_key` (`setting_key`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Add columns to existing users table if they don't exist
ALTER TABLE `users` 
ADD COLUMN IF NOT EXISTS `barangay` varchar(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `status` enum('active','inactive','suspended','deleted') NOT NULL DEFAULT 'active',
ADD COLUMN IF NOT EXISTS `last_login` timestamp NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Add columns to existing staff table if they don't exist
ALTER TABLE `staff` 
ADD COLUMN IF NOT EXISTS `position` varchar(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `department` varchar(100) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `hired_date` date DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `last_login` timestamp NULL DEFAULT NULL,
ADD COLUMN IF NOT EXISTS `created_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN IF NOT EXISTS `updated_at` timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP;

-- Insert default system settings
INSERT IGNORE INTO `system_settings` (`setting_key`, `setting_value`, `setting_type`, `description`, `category`) VALUES
('site_name', 'ProteQ Emergency Management', 'string', 'Name of the emergency management system', 'general'),
('site_description', 'Emergency Management System for San Juan, Batangas', 'string', 'Description of the system', 'general'),
('emergency_contact', '+63 912 345 6789', 'string', 'Primary emergency contact number', 'emergency'),
('email_notifications_enabled', 'true', 'boolean', 'Enable/disable email notifications', 'notifications'),
('max_incident_priority_auto_alert', 'high', 'string', 'Minimum priority level for automatic alerts', 'alerts'),
('evacuation_alert_radius', '5', 'number', 'Default radius in kilometers for evacuation alerts', 'evacuation');

-- Insert sample evacuation routes
INSERT IGNORE INTO `evacuation_routes` (`name`, `description`, `start_location`, `end_location`, `distance`, `estimated_time`, `status`, `priority`) VALUES
('Route A - Barangay 1 to Safe Zone Alpha', 'Primary evacuation route from Barangay 1 residential area to designated safe zone', 'Barangay 1, San Juan', 'Safe Zone Alpha', 2.5, 15, 'active', 'primary'),
('Route B - Barangay 3 to Safe Zone Beta', 'Secondary evacuation route from Barangay 3 to safe zone near municipal hall', 'Barangay 3, San Juan', 'Safe Zone Beta', 1.8, 12, 'active', 'secondary'),
('Route C - Barangay 5 to Safe Zone Gamma', 'Emergency evacuation route from flood-prone Barangay 5', 'Barangay 5, San Juan', 'Safe Zone Gamma', 3.2, 20, 'active', 'emergency');

-- Insert sample enhanced safety protocols
INSERT IGNORE INTO `safety_protocols_enhanced` (`title`, `description`, `category`, `priority`, `steps`, `target_audience`) VALUES
('Fire Emergency Response', 'Standard operating procedures for fire emergencies in residential and commercial areas', 'Fire Safety', 'critical', 
'["Immediately call emergency services (911)", "Evacuate the building using nearest exit", "Do not use elevators during evacuation", "Proceed to designated assembly point", "Report to safety officer for headcount", "Stay at assembly point until all-clear is given"]', 
'All residents and workers'),
('Flood Response Protocol', 'Emergency procedures for flood situations and water-related emergencies', 'Natural Disasters', 'high',
'["Monitor weather alerts and warnings", "Move to higher ground immediately", "Avoid walking or driving through flood water", "Stay away from electrical equipment if wet", "Prepare emergency supplies", "Wait for official all-clear before returning"]',
'Residents in flood-prone areas'),
('Medical Emergency Response', 'First aid and medical emergency procedures for immediate response', 'Medical', 'high',
'["Assess the situation for safety", "Check victim for responsiveness", "Call for medical assistance immediately", "Provide appropriate first aid if trained", "Monitor vital signs until help arrives", "Clear area for emergency responders"]',
'First responders and trained personnel');
