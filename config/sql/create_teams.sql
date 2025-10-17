-- Create teams table
CREATE TABLE IF NOT EXISTS teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Create staff_teams junction table for many-to-many relationship
CREATE TABLE IF NOT EXISTS staff_teams (
  id INT AUTO_INCREMENT PRIMARY KEY,
  staff_id INT NOT NULL,
  team_id INT NOT NULL,
  role VARCHAR(50) DEFAULT 'member',
  joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (staff_id) REFERENCES staff(id) ON DELETE CASCADE,
  FOREIGN KEY (team_id) REFERENCES teams(id) ON DELETE CASCADE,
  UNIQUE KEY unique_staff_team (staff_id, team_id)
);

-- Insert default teams
INSERT INTO teams (name, description) VALUES
('Emergency Response Team', 'First responders for emergency situations'),
('Medical Team', 'Medical professionals and support staff'),
('Communications Team', 'Handles all emergency communications'),
('Logistics Team', 'Manages resources and supplies'),
('Risk Assessment Team', 'Evaluates and manages risks');
