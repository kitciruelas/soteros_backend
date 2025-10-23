-- Evacuation resources table
CREATE TABLE IF NOT EXISTS `evacuation_resources` (
  `resource_id` int(11) NOT NULL AUTO_INCREMENT,
  `center_id` int(11) NOT NULL,
  `type` enum('facility','feature','water','supply') NOT NULL,
  `name` varchar(100) NOT NULL,
  `quantity` int(11) DEFAULT 0,
  `picture` varchar(255) DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`resource_id`),
  KEY `center_id` (`center_id`),
  CONSTRAINT `fk_evacuation_resources_center` FOREIGN KEY (`center_id`) REFERENCES `evacuation_centers`(`center_id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;


