-- Migration to add attachment column to incident_reports table
-- Run this SQL command to add the attachment field to existing databases

ALTER TABLE `incident_reports` ADD COLUMN `attachment` VARCHAR(255) DEFAULT NULL AFTER `reporter_safe_status`;
