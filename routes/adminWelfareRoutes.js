const express = require('express');
const router = express.Router();
const db = require('../config/conn');
const { authenticateAdmin } = require('../middleware/authMiddleware');
const NotificationService = require('../services/notificationService');

// Get welfare check settings (admin only)
router.get('/settings', authenticateAdmin, async (req, res) => {
  try {
    console.log('Fetching welfare check settings for admin...');

    const [settingsResult] = await db.execute(
      'SELECT * FROM welfare_check_settings ORDER BY id DESC'
    );

    console.log('Welfare settings query result:', settingsResult);

    const settings = settingsResult || [];

    const response = {
      success: true,
      settings: settings.map(setting => ({
        id: setting.id,
        isActive: Boolean(setting.is_active),
        title: setting.title,
        description: setting.description,
        messageWhenDisabled: setting.message_when_disabled,
        createdAt: setting.created_at,
        updatedAt: setting.updated_at
      }))
    };
    
    console.log('Welfare settings response:', response);
    res.json(response);

  } catch (error) {
    console.error('Error fetching welfare check settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch welfare check settings',
      error: error.message
    });
  }
});

// Create welfare check settings (admin only)
router.post('/settings', authenticateAdmin, async (req, res) => {
  try {
    console.log('POST /settings request body:', req.body);
    const { isActive, title, description, messageWhenDisabled } = req.body;
    const adminId = req.admin?.admin_id || req.user?.user_id || req.user?.id;

    console.log('Creating setting with values:', { isActive, title, description, messageWhenDisabled, adminId });

    // Validate required fields
    if (!title) {
      return res.status(400).json({
        success: false,
        message: 'Title is required'
      });
    }

    if (!adminId) {
      return res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
    }

    try {
      // Test database connection first
      console.log('Testing database connection...');
      await db.execute('SELECT 1');
      console.log('Database connection successful');

      // If this setting is being set as active, deactivate all other settings
      if (isActive) {
        console.log('Deactivating other settings...');
        try {
          await db.execute(
            'UPDATE welfare_check_settings SET is_active = 0 WHERE is_active = 1'
          );
          console.log('Other settings deactivated');
        } catch (updateError) {
          console.log('No existing settings to deactivate:', updateError.message);
        }
      }

      // Insert new settings
      console.log('Inserting new setting...');
      const [result] = await db.execute(
        `INSERT INTO welfare_check_settings (is_active, title, description, message_when_disabled, created_by) 
         VALUES (?, ?, ?, ?, ?)`,
        [isActive ? 1 : 0, title, description, messageWhenDisabled, adminId]
      );

      console.log('Settings created with ID:', result.insertId);
      console.log('Insert result:', result);

      // Log activity
      try {
        const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
        await db.execute(`
          INSERT INTO activity_logs (admin_id, action, details, ip_address, created_at)
          VALUES (?, 'welfare_settings_create', ?, ?, NOW())
        `, [adminId, `Created welfare check settings: "${title}" (ID: ${result.insertId})`, clientIP]);
        console.log('✅ Activity logged: welfare_settings_create');
      } catch (logError) {
        console.error('❌ Failed to log welfare settings creation activity:', logError.message);
      }

      // Create notification for all users about welfare system settings change
      try {
        await NotificationService.createWelfareSettingsNotification({
          isActive: isActive,
          title: title,
          description: description
        });
        console.log('Notification created for welfare settings change');
      } catch (notificationError) {
        console.error('Error creating notification for welfare settings:', notificationError);
        // Don't fail the settings creation if notification fails
      }

      res.json({
        success: true,
        message: 'Welfare check settings created successfully',
        settingId: result.insertId
      });

    } catch (dbError) {
      console.error('Database error in POST /settings:', dbError);
      console.error('Database error details:', {
        message: dbError.message,
        code: dbError.code,
        errno: dbError.errno,
        sqlState: dbError.sqlState,
        sqlMessage: dbError.sqlMessage
      });
      
      res.status(500).json({
        success: false,
        message: 'Database error occurred',
        error: dbError.message
      });
    }

  } catch (error) {
    console.error('Error creating welfare check settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create welfare check settings',
      error: error.message
    });
  }
});

// Update welfare check settings (admin only)
router.put('/settings', authenticateAdmin, async (req, res) => {
  try {
    console.log('PUT /settings request body:', req.body);
    const { id, isActive, title, description, messageWhenDisabled } = req.body;
    const adminId = req.admin?.admin_id || req.user?.user_id || req.user?.id;

    console.log('Extracted values:', { id, isActive, title, description, messageWhenDisabled });

    if (!id) {
      console.log('No ID provided in request body');
      return res.status(400).json({
        success: false,
        message: 'Setting ID is required for update'
      });
    }

    // Check if settings exist
    const [existingSettings] = await db.execute(
      'SELECT id FROM welfare_check_settings WHERE id = ?',
      [id]
    );

    console.log('Existing settings found:', existingSettings.length);

    if (existingSettings.length === 0) {
      console.log('Setting not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Welfare check settings not found'
      });
    }

    // If this setting is being set as active, deactivate all other settings
    if (isActive) {
      console.log('Deactivating other settings...');
      const [deactivateResult] = await db.execute(
        'UPDATE welfare_check_settings SET is_active = 0 WHERE is_active = 1 AND id != ?',
        [id]
      );
      console.log('Deactivated other settings:', deactivateResult.affectedRows);
    }

      // Update existing settings
      console.log('Updating setting with values:', { isActive, title, description, messageWhenDisabled, id });
      const [result] = await db.execute(
        `UPDATE welfare_check_settings 
         SET is_active = ?, title = ?, description = ?, message_when_disabled = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE id = ?`,
        [isActive ? 1 : 0, title, description, messageWhenDisabled, id]
      );
    console.log('Update result:', result);

    // Log activity
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
      await db.execute(`
        INSERT INTO activity_logs (admin_id, action, details, ip_address, created_at)
        VALUES (?, 'welfare_settings_update', ?, ?, NOW())
      `, [adminId, `Updated welfare check settings: "${title}" (ID: ${id})`, clientIP]);
      console.log('✅ Activity logged: welfare_settings_update');
    } catch (logError) {
      console.error('❌ Failed to log welfare settings update activity:', logError.message);
    }

    // Create notification for all users about welfare system settings change
    try {
      await NotificationService.createWelfareSettingsNotification({
        isActive: isActive,
        title: title,
        description: description
      });
      console.log('Notification created for welfare settings update');
    } catch (notificationError) {
      console.error('Error creating notification for welfare settings update:', notificationError);
      // Don't fail the settings update if notification fails
    }

    res.json({
      success: true,
      message: 'Welfare check settings updated successfully'
    });

  } catch (error) {
    console.error('Error updating welfare check settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update welfare check settings',
      error: error.message
    });
  }
});

// Delete welfare check settings (admin only)
router.delete('/settings', authenticateAdmin, async (req, res) => {
  try {
    console.log('DELETE /settings request body:', req.body);
    const { id } = req.body;
    const adminId = req.admin?.admin_id || req.user?.user_id || req.user?.id;

    console.log('Deleting setting with ID:', id);

    if (!id) {
      console.log('No ID provided in request body');
      return res.status(400).json({
        success: false,
        message: 'Setting ID is required for deletion'
      });
    }

    // Check if setting exists and get details for logging
    const [existingSettings] = await db.execute(
      'SELECT id, title FROM welfare_check_settings WHERE id = ?',
      [id]
    );

    console.log('Existing settings found:', existingSettings.length);

    if (existingSettings.length === 0) {
      console.log('Setting not found with ID:', id);
      return res.status(404).json({
        success: false,
        message: 'Welfare check settings not found'
      });
    }

    const settingTitle = existingSettings[0].title;

    // Delete the specific setting
    const [result] = await db.execute(
      'DELETE FROM welfare_check_settings WHERE id = ?',
      [id]
    );

    console.log('Delete result:', result);

    // Log activity
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
      await db.execute(`
        INSERT INTO activity_logs (admin_id, action, details, ip_address, created_at)
        VALUES (?, 'welfare_settings_delete', ?, ?, NOW())
      `, [adminId, `Deleted welfare check settings: "${settingTitle}" (ID: ${id})`, clientIP]);
      console.log('✅ Activity logged: welfare_settings_delete');
    } catch (logError) {
      console.error('❌ Failed to log welfare settings deletion activity:', logError.message);
    }

    res.json({
      success: true,
      message: 'Welfare check settings deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting welfare check settings:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete welfare check settings',
      error: error.message
    });
  }
});

// Get welfare check reports (admin only)
router.get('/reports', authenticateAdmin, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;
    const status = req.query.status; // Filter by status if provided
    const settingId = req.query.setting_id; // Filter by setting ID if provided

    let whereClause = '';
    let queryParams = [];
    let whereConditions = [];

    if (status && ['safe', 'needs_help'].includes(status)) {
      whereConditions.push('wr.status = ?');
      queryParams.push(status);
    }

    if (settingId) {
      whereConditions.push('wr.setting_id = ?');
      queryParams.push(settingId);
    }

    if (whereConditions.length > 0) {
      whereClause = 'WHERE ' + whereConditions.join(' AND ');
    }

    // Add limit and offset to query params
    queryParams.push(limit, offset);

    let reports, countResult;
    try {
      [reports] = await db.execute(
        `SELECT wr.report_id, wr.status, wr.additional_info, wr.submitted_at,
                gu.first_name, gu.last_name, gu.email, gu.address, gu.city, gu.state, gu.zip_code
         FROM welfare_reports wr
         JOIN general_users gu ON wr.user_id = gu.user_id
         ${whereClause}
         ORDER BY wr.submitted_at DESC
         LIMIT ? OFFSET ?`,
        queryParams
      );

      [countResult] = await db.execute(
        `SELECT COUNT(*) as total 
         FROM welfare_reports wr
         JOIN general_users gu ON wr.user_id = gu.user_id
         ${whereClause}`,
        whereConditions.length > 0 ? queryParams.slice(0, -2) : []
      );
    } catch (tableError) {
      // If table doesn't exist, return empty results
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.log('Welfare reports table does not exist, returning empty results');
        reports = [];
        countResult = [{ total: 0 }];
      } else {
        throw tableError;
      }
    }

    res.json({
      success: true,
      reports,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(countResult[0].total / limit),
        totalItems: countResult[0].total,
        itemsPerPage: limit
      }
    });

  } catch (error) {
    console.error('Error fetching welfare check reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch welfare check reports',
      error: error.message
    });
  }
});

// Get welfare check statistics (admin only) - alias for /stats
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    let stats, recentReports;
    try {
      [stats] = await db.execute(`
        SELECT 
          COUNT(*) as total_reports,
          SUM(CASE WHEN status = 'safe' THEN 1 ELSE 0 END) as safe_reports,
          SUM(CASE WHEN status = 'needs_help' THEN 1 ELSE 0 END) as needs_help_reports,
          COUNT(DISTINCT user_id) as unique_users,
          DATE(MIN(submitted_at)) as first_report_date,
          DATE(MAX(submitted_at)) as latest_report_date
        FROM welfare_reports
      `);

      [recentReports] = await db.execute(`
        SELECT wr.status, wr.submitted_at, gu.first_name, gu.last_name
        FROM welfare_reports wr
        JOIN general_users gu ON wr.user_id = gu.user_id
        ORDER BY wr.submitted_at DESC
        LIMIT 10
      `);
    } catch (tableError) {
      // If table doesn't exist, return empty statistics
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.log('Welfare reports table does not exist, returning empty statistics');
        stats = [{
          total_reports: 0,
          safe_reports: 0,
          needs_help_reports: 0,
          unique_users: 0,
          first_report_date: null,
          latest_report_date: null
        }];
        recentReports = [];
      } else {
        throw tableError;
      }
    }

    // Get settings count
    let settingsCount = 0;
    let activeSettingsCount = 0;
    try {
      const [settingsResult] = await db.execute('SELECT COUNT(*) as total, SUM(is_active) as active FROM welfare_check_settings');
      settingsCount = settingsResult[0].total || 0;
      activeSettingsCount = settingsResult[0].active || 0;
    } catch (settingsError) {
      console.log('Welfare settings table does not exist or error occurred');
    }

    res.json({
      success: true,
      stats: {
        totalSettings: settingsCount,
        activeSettings: activeSettingsCount,
        totalReports: stats[0].total_reports || 0,
        safeReports: stats[0].safe_reports || 0,
        needsHelpReports: stats[0].needs_help_reports || 0,
        uniqueUsers: stats[0].unique_users || 0,
        firstReportDate: stats[0].first_report_date,
        latestReportDate: stats[0].latest_report_date
      },
      recentReports
    });

  } catch (error) {
    console.error('Error fetching welfare check statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch welfare check statistics',
      error: error.message
    });
  }
});

// Get welfare check statistics (admin only) - original endpoint
router.get('/statistics', authenticateAdmin, async (req, res) => {
  try {
    let stats, recentReports;
    try {
      [stats] = await db.execute(`
        SELECT 
          COUNT(*) as total_reports,
          SUM(CASE WHEN status = 'safe' THEN 1 ELSE 0 END) as safe_reports,
          SUM(CASE WHEN status = 'needs_help' THEN 1 ELSE 0 END) as needs_help_reports,
          COUNT(DISTINCT user_id) as unique_users,
          DATE(MIN(submitted_at)) as first_report_date,
          DATE(MAX(submitted_at)) as latest_report_date
        FROM welfare_reports
      `);

      [recentReports] = await db.execute(`
        SELECT wr.status, wr.submitted_at, gu.first_name, gu.last_name
        FROM welfare_reports wr
        JOIN general_users gu ON wr.user_id = gu.user_id
        ORDER BY wr.submitted_at DESC
        LIMIT 10
      `);
    } catch (tableError) {
      // If table doesn't exist, return empty statistics
      if (tableError.code === 'ER_NO_SUCH_TABLE') {
        console.log('Welfare reports table does not exist, returning empty statistics');
        stats = [{
          total_reports: 0,
          safe_reports: 0,
          needs_help_reports: 0,
          unique_users: 0,
          first_report_date: null,
          latest_report_date: null
        }];
        recentReports = [];
      } else {
        throw tableError;
      }
    }

    res.json({
      success: true,
      statistics: stats[0],
      recentReports
    });

  } catch (error) {
    console.error('Error fetching welfare check statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch welfare check statistics',
      error: error.message
    });
  }
});

module.exports = router;