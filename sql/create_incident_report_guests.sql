-- Create incident_report_guests table for guest incident reporting
CREATE TABLE incident_report_guests (
  guest_id int(11) NOT NULL AUTO_INCREMENT,
  incident_id int(11) NOT NULL,
  guest_name varchar(100) DEFAULT NULL,
  guest_contact varchar(100) DEFAULT NULL,
  PRIMARY KEY (guest_id),
  FOREIGN KEY (incident_id) REFERENCES incident_reports(incident_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
