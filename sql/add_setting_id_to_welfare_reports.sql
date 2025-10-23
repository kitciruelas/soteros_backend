-- Migration: Add setting_id foreign key to welfare_reports table
-- This migration adds a foreign key relationship between welfare_reports and welfare_check_settings

-- Add setting_id column to welfare_reports table
ALTER TABLE `welfare_reports` 
ADD COLUMN `setting_id` int(11) NOT NULL AFTER `user_id`;

-- Add foreign key constraint
ALTER TABLE `welfare_reports` 
ADD CONSTRAINT `welfare_reports_ibfk_2` 
FOREIGN KEY (`setting_id`) REFERENCES `welfare_check_settings` (`id`) ON DELETE CASCADE;

-- Add index for better performance
ALTER TABLE `welfare_reports` 
ADD INDEX `setting_id` (`setting_id`);

-- Update existing records to reference the default setting (ID 1)
-- This assumes there's at least one welfare_check_settings record
UPDATE `welfare_reports` 
SET `setting_id` = 1 
WHERE `setting_id` IS NULL OR `setting_id` = 0;
