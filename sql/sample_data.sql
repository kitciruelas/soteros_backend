-- Sample Teams Data
INSERT INTO teams (name, description, created_at, updated_at) VALUES
('Alpha Response Team', 'Primary emergency response team for immediate deployment', NOW(), NOW()),
('Medical Emergency Team', 'Specialized team for medical emergencies and first aid', NOW(), NOW()),
('Search and Rescue Team', 'Team specialized in search and rescue operations', NOW(), NOW()),
('Communications Team', 'Team responsible for emergency communications and coordination', NOW(), NOW()),
('Logistics Support Team', 'Team handling logistics, supplies, and equipment management', NOW(), NOW());

-- Sample Staff Data (password is 'staff123' hashed with bcrypt)
INSERT INTO staff (name, email, password, phone, position, department, assigned_team_id, status, created_at, updated_at) VALUES
('John Smith', 'john.smith@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 912 345 6789', 'Emergency Response Coordinator', 'Emergency Response', 1, 1, NOW(), NOW()),
('Maria Santos', 'maria.santos@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 923 456 7890', 'Risk Assessment Specialist', 'Risk Assessment', 1, 1, NOW(), NOW()),
('Dr. Carlos Reyes', 'carlos.reyes@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 934 567 8901', 'Medical Team Lead', 'Medical Team', 2, 1, NOW(), NOW()),
('Ana Cruz', 'ana.cruz@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 945 678 9012', 'Communications Officer', 'Communications', 4, 1, NOW(), NOW()),
('Roberto Garcia', 'roberto.garcia@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 956 789 0123', 'Logistics Coordinator', 'Logistics', 5, 1, NOW(), NOW()),
('Luzviminda Torres', 'luzviminda.torres@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 967 890 1234', 'Emergency Response Officer', 'Emergency Response', 1, 1, NOW(), NOW()),
('Fernando Lopez', 'fernando.lopez@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 978 901 2345', 'Safety Protocol Manager', 'Risk Assessment', 3, 1, NOW(), NOW()),
('Carmen Mendoza', 'carmen.mendoza@mdrrmo.gov.ph', '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', '+63 989 012 3456', 'Medical Assistant', 'Medical Team', 2, 0, NOW(), NOW());

-- Note: The password for all staff members is 'staff123'
