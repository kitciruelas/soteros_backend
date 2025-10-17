-- Migration: Add incident_team_assignments table for many-to-many relationship
-- This allows multiple teams to be assigned to a single incident

-- Create the incident_team_assignments table
CREATE TABLE `incident_team_assignments` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `incident_id` int(11) NOT NULL,
  `team_id` int(11) NOT NULL,
  `assigned_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `assigned_by` int(11) DEFAULT NULL,
  `status` enum('active','inactive') DEFAULT 'active',
  PRIMARY KEY (`id`),
  UNIQUE KEY `unique_incident_team` (`incident_id`, `team_id`),
  KEY `incident_id` (`incident_id`),
  KEY `team_id` (`team_id`),
  KEY `assigned_by` (`assigned_by`),
  CONSTRAINT `incident_team_assignments_ibfk_1` FOREIGN KEY (`incident_id`) REFERENCES `incident_reports` (`incident_id`) ON DELETE CASCADE,
  CONSTRAINT `incident_team_assignments_ibfk_2` FOREIGN KEY (`team_id`) REFERENCES `teams` (`id`) ON DELETE CASCADE,
  CONSTRAINT `incident_team_assignments_ibfk_3` FOREIGN KEY (`assigned_by`) REFERENCES `admin` (`admin_id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add new columns to incident_reports for backward compatibility
ALTER TABLE `incident_reports` 
ADD COLUMN `assigned_team_id` int(11) DEFAULT NULL AFTER `assigned_to`,
ADD COLUMN `assigned_staff_id` int(11) DEFAULT NULL AFTER `assigned_team_id`,
ADD KEY `assigned_team_id` (`assigned_team_id`),
ADD KEY `assigned_staff_id` (`assigned_staff_id`),
ADD CONSTRAINT `incident_reports_ibfk_3` FOREIGN KEY (`assigned_team_id`) REFERENCES `teams` (`id`) ON DELETE SET NULL,
ADD CONSTRAINT `incident_reports_ibfk_4` FOREIGN KEY (`assigned_staff_id`) REFERENCES `staff` (`id`) ON DELETE SET NULL;

-- Migrate existing team assignments to the new table (if any exist)
-- This will be empty initially since assigned_team_id doesn't exist yet
INSERT INTO `incident_team_assignments` (`incident_id`, `team_id`, `assigned_at`)
SELECT `incident_id`, `assigned_team_id`, `updated_at`
FROM `incident_reports`
WHERE `assigned_team_id` IS NOT NULL;
