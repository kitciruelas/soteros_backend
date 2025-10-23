-- Add sample waypoints to existing evacuation routes
-- This will allow the routes to be displayed on the interactive map

-- Update Route A with waypoints from Barangay 1 to Safe Zone Alpha
UPDATE `evacuation_routes` 
SET `waypoints` = JSON_ARRAY(
  JSON_OBJECT('lat', 16.4567890, 'lng', 120.5678901), -- Barangay 1
  JSON_OBJECT('lat', 16.4580000, 'lng', 120.5685000), -- Waypoint 1
  JSON_OBJECT('lat', 16.4595000, 'lng', 120.5692000), -- Waypoint 2
  JSON_OBJECT('lat', 16.4610000, 'lng', 120.5700000)  -- Safe Zone Alpha
)
WHERE `name` LIKE '%Route A%' AND `id` = 1;

-- Update Route B with waypoints from Barangay 3 to Safe Zone Beta
UPDATE `evacuation_routes` 
SET `waypoints` = JSON_ARRAY(
  JSON_OBJECT('lat', 16.4550000, 'lng', 120.5650000), -- Barangay 3
  JSON_OBJECT('lat', 16.4565000, 'lng', 120.5660000), -- Waypoint 1
  JSON_OBJECT('lat', 16.4580000, 'lng', 120.5670000), -- Waypoint 2
  JSON_OBJECT('lat', 16.4595000, 'lng', 120.5680000)  -- Safe Zone Beta
)
WHERE `name` LIKE '%Route B%' AND `id` = 2;

-- Update Route C with waypoints from Barangay 5 to Safe Zone Gamma
UPDATE `evacuation_routes` 
SET `waypoints` = JSON_ARRAY(
  JSON_OBJECT('lat', 16.4530000, 'lng', 120.5630000), -- Barangay 5
  JSON_OBJECT('lat', 16.4545000, 'lng', 120.5640000), -- Waypoint 1
  JSON_OBJECT('lat', 16.4560000, 'lng', 120.5650000), -- Waypoint 2
  JSON_OBJECT('lat', 16.4575000, 'lng', 120.5660000), -- Waypoint 3
  JSON_OBJECT('lat', 16.4590000, 'lng', 120.5670000), -- Waypoint 4
  JSON_OBJECT('lat', 16.4605000, 'lng', 120.5680000)  -- Safe Zone Gamma
)
WHERE `name` LIKE '%Route C%' AND `id` = 3;

-- Add a new route with waypoints for demonstration
INSERT IGNORE INTO `evacuation_routes` (
  `name`, 
  `description`, 
  `start_location`, 
  `end_location`, 
  `distance`, 
  `estimated_time`, 
  `status`, 
  `priority`,
  `center_id`,
  `waypoints`
) VALUES (
  'Route D - Central Market to Municipal Hall',
  'Emergency evacuation route from central market area to municipal hall safe zone',
  'Central Market, San Juan',
  'Municipal Hall Safe Zone',
  1.5,
  10,
  'active',
  'emergency',
  1,
  JSON_ARRAY(
    JSON_OBJECT('lat', 16.4570000, 'lng', 120.5665000), -- Central Market
    JSON_OBJECT('lat', 16.4580000, 'lng', 120.5670000), -- Waypoint 1
    JSON_OBJECT('lat', 16.4590000, 'lng', 120.5675000), -- Waypoint 2
    JSON_OBJECT('lat', 16.4600000, 'lng', 120.5680000)  -- Municipal Hall
  )
);

-- Verify the updates
SELECT 
  id,
  name,
  JSON_LENGTH(waypoints) as waypoint_count,
  waypoints
FROM evacuation_routes 
WHERE waypoints IS NOT NULL;
