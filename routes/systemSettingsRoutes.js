const express = require('express');
const router = express.Router();
const pool = require('../config/conn');

// GET - Get all system settings
router.get('/', async (req, res) => {
  try {
    const { category = 'all', is_public = 'all' } = req.query;
    
    console.log('Fetching system settings with filters:', { category, is_public });
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    // Add category filter
    if (category !== 'all') {
      whereClause += ' AND category = ?';
      queryParams.push(category);
    }
    
    // Add public filter
    if (is_public !== 'all') {
      whereClause += ' AND is_public = ?';
      queryParams.push(is_public === 'true');
    }
    
    const [settings] = await pool.execute(`
      SELECT * FROM system_settings 
      ${whereClause}
      ORDER BY category, setting_key
    `, queryParams);
    
    // Parse JSON values
    const processedSettings = settings.map(setting => ({
      ...setting,
      setting_value: setting.setting_type === 'json' && setting.setting_value 
        ? JSON.parse(setting.setting_value) 
        : setting.setting_value
    }));
    
    res.json({
      success: true,
      settings: processedSettings
    });
    
  } catch (error) {
    console.error('Error fetching system settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system settings',
      error: error.message
    });
  }
});

// GET - Get system setting by key
router.get('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    console.log('Fetching system setting with key:', key);
    
    const [settings] = await pool.execute(
      'SELECT * FROM system_settings WHERE setting_key = ?',
      [key]
    );
    
    if (settings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'System setting not found'
      });
    }
    
    const setting = settings[0];
    if (setting.setting_type === 'json' && setting.setting_value) {
      setting.setting_value = JSON.parse(setting.setting_value);
    }
    
    res.json({
      success: true,
      setting
    });
    
  } catch (error) {
    console.error('Error fetching system setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch system setting',
      error: error.message
    });
  }
});

// POST - Create new system setting
router.post('/', async (req, res) => {
  try {
    const {
      setting_key,
      setting_value,
      setting_type = 'string',
      description,
      category = 'general',
      is_public = false
    } = req.body;
    
    console.log('Creating new system setting:', { setting_key, setting_type, category });
    
    if (!setting_key) {
      return res.status(400).json({
        success: false,
        message: 'Setting key is required'
      });
    }
    
    // Check if setting key already exists
    const [existingSettings] = await pool.execute(
      'SELECT id FROM system_settings WHERE setting_key = ?',
      [setting_key]
    );
    
    if (existingSettings.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Setting key already exists'
      });
    }
    
    // Process setting value based on type
    let processedValue = setting_value;
    if (setting_type === 'json' && typeof setting_value === 'object') {
      processedValue = JSON.stringify(setting_value);
    }
    
    // Insert new system setting
    const [result] = await pool.execute(`
      INSERT INTO system_settings (
        setting_key, setting_value, setting_type, description, 
        category, is_public, updated_by, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, NOW())
    `, [setting_key, processedValue, setting_type, description, category, is_public, req.user?.id || 1]);
    
    const settingId = result.insertId;
    
    // Log the creation
    const { created_by } = req.body;
    const finalCreatedBy = created_by !== null && created_by !== undefined
      ? created_by
      : (req.admin?.admin_id || null);

    console.log('Final created_by value to be inserted:', finalCreatedBy);

    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'system_setting_create', ?, NOW())
    `, [finalCreatedBy, `Created new system setting: ${setting_key}`]);
    
    res.status(201).json({
      success: true,
      message: 'System setting created successfully',
      settingId
    });
    
  } catch (error) {
    console.error('Error creating system setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create system setting',
      error: error.message
    });
  }
});

// PUT - Update system setting
router.put('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    const {
      setting_value,
      setting_type,
      description,
      category,
      is_public
    } = req.body;
    
    console.log('Updating system setting:', key);
    
    // Check if setting exists
    const [existingSettings] = await pool.execute(
      'SELECT * FROM system_settings WHERE setting_key = ?',
      [key]
    );
    
    if (existingSettings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'System setting not found'
      });
    }
    
    // Process setting value based on type
    let processedValue = setting_value;
    if (setting_type === 'json' && typeof setting_value === 'object') {
      processedValue = JSON.stringify(setting_value);
    }
    
    // Update system setting
    await pool.execute(`
      UPDATE system_settings 
      SET setting_value = ?, setting_type = ?, description = ?, 
          category = ?, is_public = ?, updated_by = ?, updated_at = NOW()
      WHERE setting_key = ?
    `, [processedValue, setting_type, description, category, is_public, req.user?.id || 1, key]);
    
    // Log the update
    const { created_by } = req.body;
    const finalCreatedBy = created_by !== null && created_by !== undefined
      ? created_by
      : (req.admin?.admin_id || null);

    console.log('Final created_by value to be inserted:', finalCreatedBy);

    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'system_setting_update', ?, NOW())
    `, [finalCreatedBy, `Updated system setting: ${key}`]);
    
    res.json({
      success: true,
      message: 'System setting updated successfully'
    });
    
  } catch (error) {
    console.error('Error updating system setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update system setting',
      error: error.message
    });
  }
});

// DELETE - Delete system setting
router.delete('/:key', async (req, res) => {
  try {
    const { key } = req.params;
    console.log('Deleting system setting:', key);
    
    // Check if setting exists
    const [existingSettings] = await pool.execute(
      'SELECT id FROM system_settings WHERE setting_key = ?',
      [key]
    );
    
    if (existingSettings.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'System setting not found'
      });
    }
    
    // Delete system setting
    await pool.execute('DELETE FROM system_settings WHERE setting_key = ?', [key]);
    
    // Log the deletion
    const { created_by } = req.body;
    const finalCreatedBy = created_by !== null && created_by !== undefined
      ? created_by
      : (req.admin?.admin_id || null);

    console.log('Final created_by value to be inserted:', finalCreatedBy);

    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'system_setting_delete', ?, NOW())
    `, [finalCreatedBy, `Deleted system setting: ${key}`]);
    
    res.json({
      success: true,
      message: 'System setting deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting system setting:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete system setting',
      error: error.message
    });
  }
});

// GET - Get settings by category
router.get('/category/:category', async (req, res) => {
  try {
    const { category } = req.params;
    console.log('Fetching settings for category:', category);
    
    const [settings] = await pool.execute(
      'SELECT * FROM system_settings WHERE category = ? ORDER BY setting_key',
      [category]
    );
    
    // Parse JSON values
    const processedSettings = settings.map(setting => ({
      ...setting,
      setting_value: setting.setting_type === 'json' && setting.setting_value 
        ? JSON.parse(setting.setting_value) 
        : setting.setting_value
    }));
    
    res.json({
      success: true,
      settings: processedSettings
    });
    
  } catch (error) {
    console.error('Error fetching settings by category:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch settings by category',
      error: error.message
    });
  }
});

module.exports = router;
