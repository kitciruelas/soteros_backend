-- Add sample teams
INSERT INTO teams (member_no, name, description, created_at, updated_at) VALUES
('TEAM001', 'Alpha Response Team', 'Primary emergency response team for immediate deployment', NOW(), NOW()),
('TEAM002', 'Medical Emergency Team', 'Specialized team for medical emergencies and first aid', NOW(), NOW()),
('TEAM003', 'Search and Rescue Team', 'Team specialized in search and rescue operations', NOW(), NOW()),
('TEAM004', 'Communications Team', 'Team responsible for emergency communications and coordination', NOW(), NOW()),
('TEAM005', 'Logistics Support Team', 'Team handling logistics, supplies, and equipment management', NOW(), NOW());

-- Add sample staff (password is 'staff123' hashed with bcrypt)
INSERT INTO staff (name, email, password, phone, position, department, status, created_at, updated_at) VALUES
('John Smith', 'john.smith@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 912 345 6789', 'Emergency Response Coordinator', 'Emergency Response', 1, NOW(), NOW()),
('Maria Santos', 'maria.santos@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 923 456 7890', 'Risk Assessment Specialist', 'Risk Assessment', 1, NOW(), NOW()),
('Dr. Carlos Reyes', 'carlos.reyes@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 934 567 8901', 'Medical Team Lead', 'Medical Team', 1, NOW(), NOW()),
('Ana Cruz', 'ana.cruz@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 945 678 9012', 'Communications Officer', 'Communications', 1, NOW(), NOW()),
('Roberto Garcia', 'roberto.garcia@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 956 789 0123', 'Logistics Coordinator', 'Logistics', 1, NOW(), NOW()),
('Luzviminda Torres', 'luzviminda.torres@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 967 890 1234', 'Emergency Response Officer', 'Emergency Response', 1, NOW(), NOW()),
('Fernando Lopez', 'fernando.lopez@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 978 901 2345', 'Safety Protocol Manager', 'Risk Assessment', 1, NOW(), NOW()),
('Carmen Mendoza', 'carmen.mendoza@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 989 012 3456', 'Medical Assistant', 'Medical Team', 1, NOW(), NOW());

-- Assign staff to teams
UPDATE staff SET assigned_team_id = 1 WHERE id = 1; -- John Smith -> Alpha Response Team
UPDATE staff SET assigned_team_id = 1 WHERE id = 2; -- Maria Santos -> Alpha Response Team
UPDATE staff SET assigned_team_id = 2 WHERE id = 3; -- Dr. Carlos Reyes -> Medical Emergency Team
UPDATE staff SET assigned_team_id = 4 WHERE id = 4; -- Ana Cruz -> Communications Team
UPDATE staff SET assigned_team_id = 5 WHERE id = 5; -- Roberto Garcia -> Logistics Support Team
UPDATE staff SET assigned_team_id = 1 WHERE id = 6; -- Luzviminda Torres -> Alpha Response Team
UPDATE staff SET assigned_team_id = 3 WHERE id = 7; -- Fernando Lopez -> Search and Rescue Team
UPDATE staff SET assigned_team_id = 2 WHERE id = 8; -- Carmen Mendoza -> Medical Emergency Team

-- Note: The password for all staff members is 'staff123'
