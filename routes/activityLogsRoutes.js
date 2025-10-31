const express = require('express');
const router = express.Router();
const pool = require('../config/conn');
const { authenticateAdmin } = require('../middleware/authMiddleware');

// GET - Get activity logs with pagination and filtering
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      user_type = 'all',
      action = 'all',
      date_from = '',
      date_to = '',
      search = ''
    } = req.query;
    
    // First, check if the activity_logs table exists
    try {
      const [tableCheck] = await pool.execute("SHOW TABLES LIKE 'activity_logs'");
      if (tableCheck.length === 0) {
        return res.status(500).json({
          success: false,
          message: 'Activity logs table not found. Please run the setup script first.',
          error: 'Table not found'
        });
      }
    } catch (tableError) {
      return res.status(500).json({
        success: false,
        message: 'Database connection error',
        error: tableError.message
      });
    }
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    // Add user type filter
    if (user_type !== 'all') {
      if (user_type === 'admin') {
        whereClause += ' AND admin_id IS NOT NULL';
      } else if (user_type === 'staff') {
        whereClause += ' AND staff_id IS NOT NULL';
      } else if (user_type === 'user') {
        whereClause += ' AND general_user_id IS NOT NULL';
      }
    }
    
    // Add action filter
    if (action !== 'all') {
      whereClause += ' AND action LIKE ?';
      queryParams.push(`%${action}%`);
    }
    
    // Add date range filter
    if (date_from && date_from.trim() !== '') {
      whereClause += ' AND al.created_at >= ?';
      queryParams.push(date_from + ' 00:00:00');
    }

    if (date_to && date_to.trim() !== '') {
      whereClause += ' AND al.created_at <= ?';
      queryParams.push(date_to + ' 23:59:59');
    }

    // Add search filter
    if (search && search.trim() !== '') {
      whereClause += ' AND (al.action LIKE ? OR al.details LIKE ? OR a.name LIKE ? OR s.name LIKE ? OR CONCAT(u.first_name, " ", u.last_name) LIKE ?)';
      const searchPattern = `%${search.trim()}%`;
      queryParams.push(searchPattern, searchPattern, searchPattern, searchPattern, searchPattern);
    }
    
    console.log('🔍 Building query with whereClause:', whereClause);
    console.log('🔍 Query parameters:', queryParams);
    
    // Get total count
    const countQuery = `
      SELECT COUNT(*) as total FROM activity_logs al
      LEFT JOIN admin a ON al.admin_id = a.admin_id
      LEFT JOIN staff s ON al.staff_id = s.id
      LEFT JOIN general_users u ON al.general_user_id = u.user_id
      ${whereClause}
    `;
    console.log('📊 Count query:', countQuery);

    const [countResult] = await pool.execute(countQuery, queryParams);
    const totalLogs = countResult[0].total;
    const totalPages = Math.ceil(totalLogs / limit);
    const offset = (page - 1) * limit;
    
    console.log('📊 Query results - Total logs:', totalLogs, 'Total pages:', totalPages, 'Offset:', offset);
    
    // Get paginated logs with user details
    const logsQuery = `
      SELECT 
        al.*,
        CASE 
          WHEN al.admin_id IS NOT NULL THEN COALESCE(a.name, 'Unknown Admin')
          WHEN al.staff_id IS NOT NULL THEN COALESCE(s.name, 'Unknown Staff')
          WHEN al.general_user_id IS NOT NULL THEN COALESCE(CONCAT(u.first_name, ' ', u.last_name), 'Unknown User')
          ELSE 'Unknown User'
        END as user_name,
        CASE 
          WHEN al.staff_id IS NOT NULL THEN s.email
          WHEN al.general_user_id IS NOT NULL THEN u.email
          ELSE NULL
        END as user_email,
        CASE 
          WHEN al.admin_id IS NOT NULL THEN 'admin'
          WHEN al.staff_id IS NOT NULL THEN 'staff'
          WHEN al.general_user_id IS NOT NULL THEN 'user'
          ELSE 'unknown'
        END as user_type
      FROM activity_logs al
      LEFT JOIN admin a ON al.admin_id = a.admin_id
      LEFT JOIN staff s ON al.staff_id = s.id
      LEFT JOIN general_users u ON al.general_user_id = u.user_id
      ${whereClause}
      ORDER BY al.created_at DESC
      LIMIT ? OFFSET ?
    `;
    
    console.log('📊 Logs query:', logsQuery);
    console.log('📊 Final query parameters:', [...queryParams, parseInt(limit), offset]);
    
    const [logs] = await pool.execute(logsQuery, [...queryParams, parseInt(limit), offset]);
    
    console.log('✅ Successfully fetched', logs.length, 'logs');
    
    res.json({
      success: true,
      logs,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalLogs,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('❌ Error fetching activity logs:', error);
    console.error('❌ Error stack:', error.stack);
    console.error('❌ Error code:', error.code);
    console.error('❌ Error sqlMessage:', error.sqlMessage);
    
    // Provide more specific error messages
    let errorMessage = 'Failed to fetch activity logs';
    if (error.code === 'ER_NO_SUCH_TABLE') {
      errorMessage = 'Activity logs table not found. Please run the setup script.';
    } else if (error.code === 'ER_BAD_FIELD_ERROR') {
      errorMessage = 'Database table structure error. Please check the table schema.';
    } else if (error.code === 'ER_PARSE_ERROR') {
      errorMessage = 'SQL query syntax error. Please check the database query.';
    } else if (error.code === 'ER_ACCESS_DENIED_ERROR') {
      errorMessage = 'Database access denied. Please check database credentials.';
    } else if (error.code === 'ECONNREFUSED') {
      errorMessage = 'Database connection refused. Please check if MySQL is running.';
    }
    
    res.status(500).json({
      success: false,
      message: errorMessage,
      error: error.message,
      code: error.code,
      sqlMessage: error.sqlMessage || null
    });
  }
});

// GET - Get activity log statistics
router.get('/stats', authenticateAdmin, async (req, res) => {
  try {
    console.log('Fetching activity log statistics...');
    
    // Get total logs by user type
    const [userTypeStats] = await pool.execute(`
      SELECT 
        CASE 
          WHEN admin_id IS NOT NULL THEN 'admin'
          WHEN staff_id IS NOT NULL THEN 'staff'
          WHEN general_user_id IS NOT NULL THEN 'user'
          ELSE 'unknown'
        END as user_type,
        COUNT(*) as count 
      FROM activity_logs 
      GROUP BY 
        CASE 
          WHEN admin_id IS NOT NULL THEN 'admin'
          WHEN staff_id IS NOT NULL THEN 'staff'
          WHEN general_user_id IS NOT NULL THEN 'user'
          ELSE 'unknown'
        END
      ORDER BY count DESC
    `);
    
    // Get most common actions
    const [actionStats] = await pool.execute(`
      SELECT action, COUNT(*) as count 
      FROM activity_logs 
      GROUP BY action 
      ORDER BY count DESC 
      LIMIT 10
    `);
    
    // Get activity by day (last 7 days)
    const [dailyActivity] = await pool.execute(`
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count
      FROM activity_logs 
      WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
      GROUP BY DATE(created_at)
      ORDER BY date ASC
    `);
    
    // Get recent high-impact activities
    const [recentHighImpact] = await pool.execute(`
      SELECT * FROM activity_logs 
      WHERE action IN ('user_delete', 'staff_delete', 'incident_create', 'alert_send', 'system_setting_update')
      ORDER BY created_at DESC 
      LIMIT 10
    `);
    
    res.json({
      success: true,
      stats: {
        userTypeDistribution: userTypeStats,
        topActions: actionStats,
        dailyActivity,
        recentHighImpact
      }
    });
    
  } catch (error) {
    console.error('Error fetching activity log statistics:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch activity log statistics',
      error: error.message
    });
  }
});

// POST - Log admin activity (utility function for other routes)
router.post('/log', authenticateAdmin, async (req, res) => {
  try {
    const {
      user_type = 'admin',
      admin_id = null,
      staff_id = null,
      general_user_id = null,
      action,
      details,
      ip_address,
      user_agent
    } = req.body;
    
    if (!action) {
      return res.status(400).json({
        success: false,
        message: 'Action is required'
      });
    }
    
    await pool.execute(`
      INSERT INTO activity_logs (admin_id, staff_id, general_user_id, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, NOW())
    `, [admin_id, staff_id, general_user_id, action, details, ip_address]);
    
    res.json({
      success: true,
      message: 'Activity logged successfully'
    });
    
  } catch (error) {
    console.error('Error logging activity:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log activity',
      error: error.message
    });
  }
});

// DELETE - Clear old activity logs (older than specified days)
router.delete('/cleanup', authenticateAdmin, async (req, res) => {
  try {
    const { days = 90 } = req.query;
    
    console.log(`Cleaning up activity logs older than ${days} days...`);
    
    const [result] = await pool.execute(`
      DELETE FROM activity_logs 
      WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)
    `, [parseInt(days)]);
    
    // Log the cleanup action
    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'logs_cleanup', ?, NOW())
    `, [req.user?.id || 1, `Cleaned up ${result.affectedRows} activity logs older than ${days} days`]);
    
    res.json({
      success: true,
      message: `Successfully cleaned up ${result.affectedRows} old activity logs`,
      deletedCount: result.affectedRows
    });
    
  } catch (error) {
    console.error('Error cleaning up activity logs:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to clean up activity logs',
      error: error.message
    });
  }
});

// Test endpoint to check database connectivity and table status
router.get('/test', authenticateAdmin, async (req, res) => {
  try {
    console.log('🧪 Testing activity logs database connectivity...');
    
    // Test database connection
    const [connectionTest] = await pool.execute('SELECT 1 as test');
    console.log('✅ Database connection successful');
    
    // Check if activity_logs table exists
    const [tableCheck] = await pool.execute("SHOW TABLES LIKE 'activity_logs'");
    if (tableCheck.length === 0) {
      return res.json({
        success: false,
        message: 'Activity logs table does not exist',
        databaseConnected: true,
        tableExists: false
      });
    }
    
    console.log('✅ Activity logs table exists');
    
    // Check table structure
    const [columns] = await pool.execute("DESCRIBE activity_logs");
    const columnNames = columns.map(col => col.Field);
    
    // Check if table has the correct structure
    const hasCorrectStructure = columnNames.includes('admin_id') && 
                               columnNames.includes('staff_id') && 
                               columnNames.includes('general_user_id');
    
    if (!hasCorrectStructure) {
      return res.json({
        success: false,
        message: 'Table structure is incorrect',
        databaseConnected: true,
        tableExists: true,
        correctStructure: false,
        currentColumns: columnNames
      });
    }
    
    console.log('✅ Table structure is correct');
    
    // Count total logs
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM activity_logs');
    const totalLogs = countResult[0].total;
    
    // Get sample log
    const [sampleLog] = await pool.execute('SELECT * FROM activity_logs ORDER BY created_at DESC LIMIT 1');
    
    res.json({
      success: true,
      message: 'Activity logs system is working correctly',
      databaseConnected: true,
      tableExists: true,
      correctStructure: true,
      totalLogs,
      sampleLog: sampleLog[0] || null,
      tableStructure: columns
    });
    
  } catch (error) {
    console.error('❌ Test endpoint error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message,
      databaseConnected: false
    });
  }
});

module.exports = router;
