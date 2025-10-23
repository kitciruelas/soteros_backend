-- Add center_id column to evacuation_routes table if it doesn't exist
-- This script will update the existing table structure

-- Check if center_id column exists, if not add it
ALTER TABLE `evacuation_routes` 
ADD COLUMN IF NOT EXISTS `center_id` int(11) NOT NULL AFTER `id`;

-- Add foreign key constraint if it doesn't exist
-- Note: This will only work if the evacuation_centers table exists
-- If you get an error, make sure evacuation_centers table is created first

-- Add foreign key constraint (uncomment if you want to enforce referential integrity)
-- ALTER TABLE `evacuation_routes` 
-- ADD CONSTRAINT `fk_evacuation_routes_center` 
-- FOREIGN KEY (`center_id`) REFERENCES `evacuation_centers` (`center_id`) ON DELETE CASCADE;

-- Update existing routes to assign them to a default center (optional)
-- UPDATE `evacuation_routes` SET `center_id` = 1 WHERE `center_id` = 0 OR `center_id` IS NULL;

-- Verify the table structure
DESCRIBE `evacuation_routes`;
