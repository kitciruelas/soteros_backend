const express = require('express');
const router = express.Router();
const pool = require('../config/conn');
const path = require('path');
const fs = require('fs');
const { authenticateAdmin } = require('../middleware/authMiddleware');
const { uploadResource, cloudinary } = require('../config/cloudinary');

// Helper function to extract public_id from Cloudinary URL
const getCloudinaryPublicId = (url) => {
  if (!url || !url.includes('cloudinary')) return null;
  try {
    // Extract public_id from URL like: https://res.cloudinary.com/.../mdrrmo/resources/filename.ext
    const matches = url.match(/\/mdrrmo\/resources\/([^\.]+)/);
    return matches ? `mdrrmo/resources/${matches[1]}` : null;
  } catch (error) {
    console.error('Error extracting public_id:', error);
    return null;
  }
};

// Helper function to delete image from Cloudinary
const deleteCloudinaryImage = async (url) => {
  const publicId = getCloudinaryPublicId(url);
  if (publicId) {
    try {
      await cloudinary.uploader.destroy(publicId);
      console.log('🗑️ Deleted image from Cloudinary:', publicId);
    } catch (error) {
      console.error('Error deleting from Cloudinary:', error);
    }
  }
};

// Get all evacuation centers (public access for viewing)
router.get('/', async (req, res) => {
  try {
    console.log('Fetching evacuation centers...');
    const [results] = await pool.execute('SELECT * FROM evacuation_centers');
    console.log('Found evacuation centers:', results.length);
    res.json(results);
  } catch (error) {
    console.error('Error fetching evacuation centers:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create a new evacuation center
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      name,
      latitude,
      longitude,
      capacity,
      current_occupancy = 0,
      status = 'open',
      contact_person = null,
      contact_number = null
    } = req.body || {};

    if (!name || latitude === undefined || longitude === undefined || capacity === undefined) {
      return res.status(400).json({ success: false, message: 'name, latitude, longitude, capacity are required' });
    }

    const [result] = await pool.execute(
      'INSERT INTO evacuation_centers (name, latitude, longitude, capacity, current_occupancy, status, contact_person, contact_number) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [name, latitude, longitude, capacity, current_occupancy, status, contact_person, contact_number]
    );
    const [rows] = await pool.execute('SELECT * FROM evacuation_centers WHERE center_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error creating evacuation center:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Update an evacuation center
router.put('/:centerId', authenticateAdmin, async (req, res) => {
  const { centerId } = req.params;
  try {
    const { name, latitude, longitude, capacity, current_occupancy, status, contact_person, contact_number } = req.body || {};
    const fields = [];
    const values = [];
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (latitude !== undefined) { fields.push('latitude = ?'); values.push(latitude); }
    if (longitude !== undefined) { fields.push('longitude = ?'); values.push(longitude); }
    if (capacity !== undefined) { fields.push('capacity = ?'); values.push(capacity); }
    if (current_occupancy !== undefined) { fields.push('current_occupancy = ?'); values.push(current_occupancy); }
    if (status !== undefined) { fields.push('status = ?'); values.push(status); }
    if (contact_person !== undefined) { fields.push('contact_person = ?'); values.push(contact_person); }
    if (contact_number !== undefined) { fields.push('contact_number = ?'); values.push(contact_number); }
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(centerId);
    const sql = `UPDATE evacuation_centers SET ${fields.join(', ')} WHERE center_id = ?`;
    await pool.execute(sql, values);

    const [rows] = await pool.execute('SELECT * FROM evacuation_centers WHERE center_id = ?', [centerId]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    // Log the center update
    try {
      const { created_by } = req.body;
      const finalCreatedBy = created_by !== null && created_by !== undefined
        ? created_by
        : (req.admin?.admin_id || null);

      console.log('Final created_by value to be inserted:', finalCreatedBy);

      await pool.execute(`
        INSERT INTO activity_logs (admin_id, action, details, created_at)
        VALUES (?, 'evacuation_center_update', ?, NOW())
      `, [finalCreatedBy, `Updated evavcuation center: ${rows[0].name}`]);
    } catch (logError) {
      console.warn('Failed to log evacuation center update activity:', logError.message);
    }

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error updating evacuation center:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Delete an evacuation center (cascades to resources)
router.delete('/:centerId', authenticateAdmin, async (req, res) => {
  const { centerId } = req.params;
  try {
    const [centerRows] = await pool.execute('SELECT name FROM evacuation_centers WHERE center_id = ?', [centerId]);
    const [result] = await pool.execute('DELETE FROM evacuation_centers WHERE center_id = ?', [centerId]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ success: false, message: 'Center not found' });
    }

    // Log the center deletion
    try {
      const { created_by } = req.body;
      const finalCreatedBy = created_by !== null && created_by !== undefined
        ? created_by
        : (req.admin?.admin_id || null);

      console.log('Final created_by value to be inserted:', finalCreatedBy);

      await pool.execute(`
        INSERT INTO activity_logs (admin_id, action, details, created_at)
        VALUES (?, 'evacuation_center_delete', ?, NOW())
      `, [finalCreatedBy, `Deleted evacuation center: ${centerRows[0].name}`]);
    } catch (logError) {
      console.warn('Failed to log evacuation center deletion activity:', logError.message);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting evacuation center:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Get resources for a specific evacuation center (public access for viewing)
router.get('/:centerId/resources', async (req, res) => {
  const { centerId } = req.params;
  try {
    console.log('Fetching resources for center:', centerId);
    const [rows] = await pool.execute(
      'SELECT * FROM evacuation_resources WHERE center_id = ? ORDER BY type, name',
      [centerId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('Error fetching evacuation resources:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Create a new resource for a center
router.post('/:centerId/resources', authenticateAdmin, async (req, res) => {
  const { centerId } = req.params;
  const { type, name, quantity = 0, picture = null } = req.body || {};
  try {
    if (!type || !name) {
      return res.status(400).json({ success: false, message: 'type and name are required' });
    }
    const [result] = await pool.execute(
      'INSERT INTO evacuation_resources (center_id, type, name, quantity, picture) VALUES (?, ?, ?, ?, ?)',
      [centerId, type, name, quantity, picture]
    );

    const [centerRows] = await pool.execute('SELECT name FROM evacuation_centers WHERE center_id = ?', [centerId]);

    // Log the resource creation
    try {
      const { created_by } = req.body;
      const finalCreatedBy = created_by !== null && created_by !== undefined
        ? created_by
        : (req.admin?.admin_id || null);

      console.log('Final created_by value to be inserted:', finalCreatedBy);

      await pool.execute(`
        INSERT INTO activity_logs (admin_id, action, details, created_at)
        VALUES (?, 'evacuation_resource_create', ?, NOW())
      `, [finalCreatedBy, `Created evacuation resource: ${name} (ID: ${result.insertId}) for center ${centerRows[0].name}`]);
    } catch (logError) {
      console.warn('Failed to log evacuation resource creation activity:', logError.message);
    }
    
    const [rows] = await pool.execute('SELECT * FROM evacuation_resources WHERE resource_id = ?', [result.insertId]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error creating evacuation resource:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Update a resource
router.put('/:centerId/resources/:resourceId', authenticateAdmin, async (req, res) => {
  const { centerId, resourceId } = req.params;
  const { type, name, quantity, picture } = req.body || {};
  try {
    const fields = [];
    const values = [];
    if (type !== undefined) { fields.push('type = ?'); values.push(type); }
    if (name !== undefined) { fields.push('name = ?'); values.push(name); }
    if (quantity !== undefined) { fields.push('quantity = ?'); values.push(quantity); }
    if (picture !== undefined) { fields.push('picture = ?'); values.push(picture); }
    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }
    values.push(centerId, resourceId);
    const sql = `UPDATE evacuation_resources SET ${fields.join(', ')} WHERE center_id = ? AND resource_id = ?`;
    await pool.execute(sql, values);

    const [centerRows] = await pool.execute('SELECT name FROM evacuation_centers WHERE center_id = ?', [centerId]);

    // Log the resource update
    try {
      const { created_by } = req.body;
      const finalCreatedBy = created_by !== null && created_by !== undefined
        ? created_by
        : (req.admin?.admin_id || null);

      console.log('Final created_by value to be inserted:', finalCreatedBy);

      await pool.execute(`
        INSERT INTO activity_logs (admin_id, action, details, created_at)
        VALUES (?, 'evacuation_resource_update', ?, NOW())
      `, [finalCreatedBy, `Updated evacuation resource (ID: ${resourceId}) for center ${centerRows[0].name}`]);
    } catch (logError) {
      console.warn('Failed to log evacuation resource update activity:', logError.message);
    }
    
    const [rows] = await pool.execute('SELECT * FROM evacuation_resources WHERE center_id = ? AND resource_id = ?', [centerId, resourceId]);
    if (!rows[0]) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error updating evacuation resource:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Upload a resource picture (multipart/form-data) - Using Cloudinary
router.post('/:centerId/resources/:resourceId/picture', authenticateAdmin, uploadResource.single('picture'), async (req, res) => {
  const { centerId, resourceId } = req.params;
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    console.log('📸 Resource picture uploaded to Cloudinary:', {
      filename: req.file.originalname,
      path: req.file.path,
      size: req.file.size
    });
    
    // Get the current resource to check for existing picture
    const [currentResource] = await pool.execute('SELECT picture FROM evacuation_resources WHERE center_id = ? AND resource_id = ?', [centerId, resourceId]);
    
    if (!currentResource[0]) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    
    // Delete old image from Cloudinary if it exists
    if (currentResource[0].picture && currentResource[0].picture.includes('cloudinary')) {
      await deleteCloudinaryImage(currentResource[0].picture);
    }
    
    // Use Cloudinary secure_url as the picture URL
    const pictureUrl = req.file.path; // Cloudinary provides the URL in the path field
    
    // Update the resource with the Cloudinary URL
    await pool.execute('UPDATE evacuation_resources SET picture = ? WHERE center_id = ? AND resource_id = ?', [pictureUrl, centerId, resourceId]);
    
    const [rows] = await pool.execute('SELECT * FROM evacuation_resources WHERE center_id = ? AND resource_id = ?', [centerId, resourceId]);
    
    console.log('✅ Resource picture updated successfully:', pictureUrl);
    
    res.json({ success: true, data: rows[0], pictureUrl });
  } catch (error) {
    console.error('❌ Error uploading resource picture:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Delete a resource
router.delete('/:centerId/resources/:resourceId', authenticateAdmin, async (req, res) => {
  const { centerId, resourceId } = req.params;
  try {
    const [centerRows] = await pool.execute('SELECT name FROM evacuation_centers WHERE center_id = ?', [centerId]);
    
    // Get the resource to check for picture before deletion
    const [resourceRows] = await pool.execute('SELECT picture FROM evacuation_resources WHERE center_id = ? AND resource_id = ?', [centerId, resourceId]);
    
    if (resourceRows.length === 0) {
      return res.status(404).json({ success: false, message: 'Resource not found' });
    }
    
    // Delete the resource from database
    const [result] = await pool.execute('DELETE FROM evacuation_resources WHERE center_id = ? AND resource_id = ?', [centerId, resourceId]);
    
    // Delete image from Cloudinary if it exists
    if (resourceRows[0].picture && resourceRows[0].picture.includes('cloudinary')) {
      await deleteCloudinaryImage(resourceRows[0].picture);
    }

    // Log the resource deletion
    try {
      const { created_by } = req.body;
      const finalCreatedBy = created_by !== null && created_by !== undefined
        ? created_by
        : (req.admin?.admin_id || null);

      console.log('Final created_by value to be inserted:', finalCreatedBy);

      await pool.execute(`
        INSERT INTO activity_logs (admin_id, action, details, created_at)
        VALUES (?, 'evacuation_resource_delete', ?, NOW())
      `, [finalCreatedBy, `Deleted evacuation resource (ID: ${resourceId}) from center ${centerRows[0].name}`]);
    } catch (logError) {
      console.warn('Failed to log evacuation resource deletion activity:', logError.message);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Error deleting evacuation resource:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

module.exports = router;