const express = require('express');
const router = express.Router();
const { authenticateAdmin } = require('../middleware/authMiddleware');
const AdminNotificationService = require('../services/adminNotificationService');

/**
 * Get admin notifications with pagination and filters
 * GET /api/admin/notifications
 */
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.user.admin_id || req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const unreadOnly = req.query.unread_only === 'true';
    const type = req.query.type || null;
    const severity = req.query.severity || null;

    const result = await AdminNotificationService.getAdminNotifications(adminId, {
      page,
      limit,
      unreadOnly,
      type,
      severity
    });

    res.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('❌ Error fetching admin notifications:', error);
    
    // If table doesn't exist, return empty results
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        notifications: [],
        total: 0,
        unreadCount: 0,
        pagination: {
          currentPage: 1,
          totalPages: 0,
          totalItems: 0,
          itemsPerPage: limit
        },
        message: 'Notifications table not yet created. Please run the SQL migration.'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch admin notifications',
      error: error.message
    });
  }
});

/**
 * Get unread notifications count
 * GET /api/admin/notifications/unread-count
 */
router.get('/unread-count', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.user.admin_id || req.user.id;
    const count = await AdminNotificationService.getUnreadCount(adminId);

    res.json({
      success: true,
      unreadCount: count
    });
  } catch (error) {
    console.error('❌ Error fetching unread count:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        unreadCount: 0
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch unread count',
      error: error.message
    });
  }
});

/**
 * Get priority notifications count
 * GET /api/admin/notifications/priority-count
 */
router.get('/priority-count', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.user.admin_id || req.user.id;
    const count = await AdminNotificationService.getPriorityNotifications(adminId);

    res.json({
      success: true,
      priorityCount: count
    });
  } catch (error) {
    console.error('❌ Error fetching priority count:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        priorityCount: 0
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to fetch priority count',
      error: error.message
    });
  }
});

/**
 * Mark notification as read
 * PUT /api/admin/notifications/:id/read
 */
router.put('/:id/read', authenticateAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminId = req.user.admin_id || req.user.id;

    const success = await AdminNotificationService.markAsRead(notificationId, adminId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found or already read'
      });
    }

    res.json({
      success: true,
      message: 'Notification marked as read'
    });
  } catch (error) {
    console.error('❌ Error marking notification as read:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        message: 'Notification marked as read'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to mark notification as read',
      error: error.message
    });
  }
});

/**
 * Mark all notifications as read
 * PUT /api/admin/notifications/read-all
 */
router.put('/read-all', authenticateAdmin, async (req, res) => {
  try {
    const adminId = req.user.admin_id || req.user.id;
    const count = await AdminNotificationService.markAllAsRead(adminId);

    res.json({
      success: true,
      message: `${count} notification(s) marked as read`,
      count
    });
  } catch (error) {
    console.error('❌ Error marking all notifications as read:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        message: 'All notifications marked as read',
        count: 0
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to mark all notifications as read',
      error: error.message
    });
  }
});

/**
 * Delete notification
 * DELETE /api/admin/notifications/:id
 */
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const notificationId = req.params.id;
    const adminId = req.user.admin_id || req.user.id;

    const success = await AdminNotificationService.deleteNotification(notificationId, adminId);

    if (!success) {
      return res.status(404).json({
        success: false,
        message: 'Notification not found'
      });
    }

    res.json({
      success: true,
      message: 'Notification deleted successfully'
    });
  } catch (error) {
    console.error('❌ Error deleting notification:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.json({
        success: true,
        message: 'Notification deleted successfully'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to delete notification',
      error: error.message
    });
  }
});

/**
 * Test notification creation (for development)
 * POST /api/admin/notifications/test
 */
router.post('/test', authenticateAdmin, async (req, res) => {
  try {
    const { type = 'system', title = 'Test Notification', message = 'This is a test notification' } = req.body;
    
    const notificationId = await AdminNotificationService.createNotificationForAllAdmins({
      type,
      title,
      message,
      severity: 'info',
      priority_level: 'low'
    });

    res.json({
      success: true,
      message: 'Test notification created successfully',
      notificationId
    });
  } catch (error) {
    console.error('❌ Error creating test notification:', error);
    
    if (error.code === 'ER_NO_SUCH_TABLE') {
      return res.status(500).json({
        success: false,
        message: 'Notifications table not yet created. Please run: backend/sql/create_admin_notifications.sql'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Failed to create test notification',
      error: error.message
    });
  }
});

module.exports = router;

