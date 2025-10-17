const express = require('express');
const router = express.Router();
const pool = require('../config/conn');

// GET - Get all evacuation routes with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      search = '', 
      status = 'all',
      priority = 'all',
      center_id = null
    } = req.query;
    
    console.log('Fetching evacuation routes with filters:', { page, limit, search, status, priority, center_id });
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    // Add center filter
    if (center_id) {
      whereClause += ' AND center_id = ?';
      queryParams.push(parseInt(center_id));
    }
    
    // Add search filter
    if (search) {
      whereClause += ' AND (name LIKE ? OR description LIKE ? OR start_location LIKE ? OR end_location LIKE ?)';
      queryParams.push(`%${search}%`, `%${search}%`, `%${search}%`, `%${search}%`);
    }
    
    // Add status filter
    if (status !== 'all') {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }
    
    // Add priority filter
    if (priority !== 'all') {
      whereClause += ' AND priority = ?';
      queryParams.push(priority);
    }
    
    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM evacuation_routes ${whereClause}`,
      queryParams
    );
    
    const totalRoutes = countResult[0].total;
    const totalPages = Math.ceil(totalRoutes / limit);
    const offset = (page - 1) * limit;
    
    // Get paginated routes
    const [routes] = await pool.execute(`
      SELECT * FROM evacuation_routes 
      ${whereClause}
      ORDER BY priority DESC, created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);
    
    // Parse JSON fields with error handling
    const processedRoutes = routes.map(route => {
      let waypoints = [];
      try {
        if (route.waypoints) {
          waypoints = JSON.parse(route.waypoints);
          // Validate waypoints structure
          if (!Array.isArray(waypoints)) {
            console.warn(`Route ${route.id} has invalid waypoints structure:`, route.waypoints);
            waypoints = [];
          } else {
            // Convert string waypoints to object format
            waypoints = waypoints.map(wp => {
              if (typeof wp === 'string') {
                // Parse string format like "lat,lng"
                const parts = wp.split(',');
                if (parts.length === 2) {
                  const lat = parseFloat(parts[0]);
                  const lng = parseFloat(parts[1]);
                  if (!isNaN(lat) && !isNaN(lng)) {
                    return { lat, lng };
                  }
                }
                return null;
              } else if (wp && typeof wp === 'object' && typeof wp.lat === 'number' && typeof wp.lng === 'number') {
                return wp;
              }
              return null;
            }).filter(wp => wp !== null);
          }
        }
      } catch (error) {
        console.error(`Error parsing waypoints for route ${route.id}:`, error);
        waypoints = [];
      }
      
      return {
        ...route,
        waypoints
      };
    });
    
    res.json({
      success: true,
      routes: processedRoutes,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalRoutes,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching evacuation routes:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evacuation routes',
      error: error.message
    });
  }
});

// GET - Get evacuation route by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching evacuation route with ID:', id);
    
    const [routes] = await pool.execute(
      'SELECT * FROM evacuation_routes WHERE id = ?',
      [id]
    );
    
    if (routes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Evacuation route not found'
      });
    }
    
    const route = routes[0];
    let waypoints = [];
    try {
      if (route.waypoints) {
        waypoints = JSON.parse(route.waypoints);
        if (!Array.isArray(waypoints)) {
          console.warn(`Route ${route.id} has invalid waypoints structure:`, route.waypoints);
          waypoints = [];
        } else {
          // Convert string waypoints to object format
          waypoints = waypoints.map(wp => {
            if (typeof wp === 'string') {
              // Parse string format like "lat,lng"
              const parts = wp.split(',');
              if (parts.length === 2) {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                  return { lat, lng };
                }
              }
              return null;
            } else if (wp && typeof wp === 'object' && typeof wp.lat === 'number' && typeof wp.lng === 'number') {
              return wp;
            }
            return null;
          }).filter(wp => wp !== null);
        }
      }
    } catch (error) {
      console.error(`Error parsing waypoints for route ${route.id}:`, error);
      waypoints = [];
    }
    route.waypoints = waypoints;
    
    res.json({
      success: true,
      route
    });
    
  } catch (error) {
    console.error('Error fetching evacuation route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch evacuation route',
      error: error.message
    });
  }
});

// POST - Create new evacuation route
router.post('/', async (req, res) => {
  try {
    const {
      name,
      description,
      start_location,
      end_location,
      waypoints = [],
      distance,
      estimated_time,
      priority = 'primary',
      center_id
    } = req.body;
    
    console.log('Creating new evacuation route:', { name, start_location, end_location, center_id });
    
    if (!name || !start_location || !end_location || !center_id) {
      return res.status(400).json({
        success: false,
        message: 'Name, start location, end location, and center ID are required'
      });
    }
    
    // Insert new evacuation route
    const [result] = await pool.execute(`
      INSERT INTO evacuation_routes (
        center_id, name, description, start_location, end_location, waypoints, 
        distance, estimated_time, priority, status, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NOW(), NOW())
    `, [
      center_id, name, description, start_location, end_location, 
      JSON.stringify(waypoints), distance, estimated_time, priority
    ]);
    
    const routeId = result.insertId;
    
    // Log the creation
    const { created_by } = req.body;
    const finalCreatedBy = created_by !== null && created_by !== undefined
      ? created_by
      : (req.admin?.admin_id || null);

    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'evacuation_route_create', ?, NOW())
    `, [finalCreatedBy, `Created new evacuation route: ${name}`]);
    
    res.status(201).json({
      success: true,
      message: 'Evacuation route created successfully',
      routeId
    });
    
  } catch (error) {
    console.error('Error creating evacuation route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create evacuation route',
      error: error.message
    });
  }
});

// PUT - Update evacuation route
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      name,
      description,
      start_location,
      end_location,
      waypoints,
      distance,
      estimated_time,
      priority,
      status,
      center_id
    } = req.body;
    
    console.log('Updating evacuation route:', id);
    
    // Check if route exists
    const [existingRoutes] = await pool.execute(
      'SELECT * FROM evacuation_routes WHERE id = ?',
      [id]
    );
    
    if (existingRoutes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Evacuation route not found'
      });
    }
    
    // Update evacuation route
    await pool.execute(`
      UPDATE evacuation_routes 
      SET center_id = ?, name = ?, description = ?, start_location = ?, end_location = ?, 
          waypoints = ?, distance = ?, estimated_time = ?, priority = ?, 
          status = ?, updated_at = NOW()
      WHERE id = ?
    `, [
      center_id, name, description, start_location, end_location,
      JSON.stringify(waypoints || []), distance, estimated_time, 
      priority, status, id
    ]);
    
    // Log the update
    const { created_by } = req.body;
    const finalCreatedBy = created_by !== null && created_by !== undefined
      ? created_by
      : (req.admin?.admin_id || null);

    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'evacuation_route_update', ?, NOW())
    `, [finalCreatedBy, `Updated evacuation route: ${name} (ID: ${id})`]);
    
    res.json({
      success: true,
      message: 'Evacuation route updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating evacuation route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update evacuation route',
      error: error.message
    });
  }
});

// DELETE - Delete evacuation route
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting evacuation route:', id);
    
    // Check if route exists
    const [existingRoutes] = await pool.execute(
      'SELECT name FROM evacuation_routes WHERE id = ?',
      [id]
    );
    
    if (existingRoutes.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Evacuation route not found'
      });
    }
    
    const routeName = existingRoutes[0].name;
    
    // Delete evacuation route
    await pool.execute('DELETE FROM evacuation_routes WHERE id = ?', [id]);
    
    // Log the deletion
    const { created_by } = req.body;
    const finalCreatedBy = created_by !== null && created_by !== undefined
      ? created_by
      : (req.admin?.admin_id || null);

    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'evacuation_route_delete', ?, NOW())
    `, [finalCreatedBy, `Deleted evacuation route: ${routeName} (ID: ${id})`]);
    
    res.json({
      success: true,
      message: 'Evacuation route deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting evacuation route:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete evacuation route',
      error: error.message
    });
  }
});

module.exports = router;
