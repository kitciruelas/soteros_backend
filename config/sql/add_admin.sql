-- Add initial admin user
INSERT INTO `admin` (`name`, `email`, `password`, `role`, `status`) VALUES 
(
    'Admin User',
    'admin1@gmail.com',
    -- Password: admin123
    '$2b$10$6HvkGTLmDsrWArW1v6hOYu5nEGvFHQc0ZY/RXsNMJQJS5n7Ey5Fau',
    'admin',
    'active'
);
