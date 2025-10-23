-- Add rating column to feedback table
ALTER TABLE feedback ADD COLUMN rating TINYINT(1) DEFAULT NULL COMMENT 'Rating from 1 to 5 stars' AFTER message;
