-- Add member_count column to teams table if it doesn't exist
ALTER TABLE teams ADD COLUMN IF NOT EXISTS member_count INT(11) DEFAULT 0;

-- Update existing teams with their current member counts
UPDATE teams t 
SET member_count = (
  SELECT COUNT(s.id) 
  FROM staff s 
  WHERE s.assigned_team_id = t.id AND s.status = 1
);

-- Set default values for teams with no members
UPDATE teams SET member_count = 0 WHERE member_count IS NULL;
