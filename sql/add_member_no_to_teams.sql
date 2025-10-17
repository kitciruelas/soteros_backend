-- Add member_no column to teams table if it doesn't exist
ALTER TABLE teams ADD COLUMN IF NOT EXISTS member_no VARCHAR(20) DEFAULT NULL;

-- Update existing teams with member numbers
UPDATE teams SET member_no = 'TEAM001' WHERE id = 1 AND name = 'Alpha Response Team';
UPDATE teams SET member_no = 'TEAM002' WHERE id = 2 AND name = 'Medical Emergency Team';
UPDATE teams SET member_no = 'TEAM003' WHERE id = 3 AND name = 'Search and Rescue Team';
UPDATE teams SET member_no = 'TEAM004' WHERE id = 4 AND name = 'Communications Team';
UPDATE teams SET member_no = 'TEAM005' WHERE id = 5 AND name = 'Logistics Support Team';

-- Add index for better performance
CREATE INDEX IF NOT EXISTS idx_teams_member_no ON teams(member_no);
