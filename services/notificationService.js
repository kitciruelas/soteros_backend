const db = require('../config/conn');

class NotificationService {
  // Create notification for all users (like admin activity logs)
  static async createNotificationForAllUsers(notificationData) {
    try {
      const { type, title, message, severity = 'info', relatedId = null } = notificationData;
      
      // Try to create notification, if table doesn't exist, create it
      try {
        const [result] = await db.execute(
          'INSERT INTO notifications (user_id, type, title, message, severity, related_id) VALUES (NULL, ?, ?, ?, ?, ?)',
          [type, title, message, severity, relatedId]
        );
        
        console.log(`Notification created for all users: ${title}`);
        return result.insertId;
      } catch (error) {
        if (error.code === 'ER_NO_SUCH_TABLE') {
          // Create the table if it doesn't exist
          await this.createNotificationsTable();
          
          // Try again
          const [result] = await db.execute(
            'INSERT INTO notifications (user_id, type, title, message, severity, related_id) VALUES (NULL, ?, ?, ?, ?, ?)',
            [type, title, message, severity, relatedId]
          );
          
          console.log(`Notification created for all users: ${title}`);
          return result.insertId;
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error('Error creating notification for all users:', error);
      // Don't throw error, just log it like admin system
    }
  }

  // Create notifications table (like admin tables)
  static async createNotificationsTable() {
    try {
      console.log('Creating notifications table...');
      
      await db.execute(`
        CREATE TABLE \`notifications\` (
          \`id\` int(11) NOT NULL AUTO_INCREMENT,
          \`user_id\` int(11) DEFAULT NULL,
          \`type\` enum('alert','safety_protocol','welfare','system') NOT NULL,
          \`title\` varchar(255) NOT NULL,
          \`message\` text NOT NULL,
          \`severity\` enum('info','warning','emergency') NOT NULL DEFAULT 'info',
          \`is_read\` tinyint(1) NOT NULL DEFAULT 0,
          \`related_id\` int(11) DEFAULT NULL,
          \`created_at\` timestamp NOT NULL DEFAULT current_timestamp(),
          \`updated_at\` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
          PRIMARY KEY (\`id\`),
          KEY \`user_id\` (\`user_id\`),
          KEY \`type\` (\`type\`),
          KEY \`is_read\` (\`is_read\`),
          KEY \`created_at\` (\`created_at\`)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
      `);

      console.log('Notifications table created successfully');
    } catch (error) {
      console.error('Error creating notifications table:', error);
    }
  }

  // Create notification for specific user
  static async createNotificationForUser(userId, notificationData) {
    try {
      const { type, title, message, severity = 'info', relatedId = null } = notificationData;
      
      const [result] = await db.execute(
        'INSERT INTO notifications (user_id, type, title, message, severity, related_id) VALUES (?, ?, ?, ?, ?, ?)',
        [userId, type, title, message, severity, relatedId]
      );
      
      console.log(`Notification created for user ${userId}: ${title}`);
      return result.insertId;
    } catch (error) {
      console.error('Error creating notification for user:', error);
      // Don't throw error, just log it like admin system
    }
  }

  // Create alert notification
  static async createAlertNotification(alertData) {
    const { id, title, description, alert_severity, alert_type } = alertData;
    
    const severityMap = {
      'emergency': 'emergency',
      'warning': 'warning',
      'info': 'info'
    };

    return await this.createNotificationForAllUsers({
      type: 'alert',
      title: `🚨 ${title}`,
      message: description,
      severity: severityMap[alert_severity] || 'info',
      relatedId: id
    });
  }

  // Create safety protocol notification
  static async createSafetyProtocolNotification(protocolData) {
    const { id, title, description, type } = protocolData;
    
    const typeEmoji = {
      'fire': '🔥',
      'earthquake': '🌍',
      'medical': '🏥',
      'intrusion': '🚨',
      'general': '🛡️'
    };

    return await this.createNotificationForAllUsers({
      type: 'safety_protocol',
      title: `${typeEmoji[type] || '🛡️'} New Safety Protocol: ${title}`,
      message: description,
      severity: 'warning',
      relatedId: id
    });
  }

  // Create welfare check settings notification
  static async createWelfareSettingsNotification(settingsData) {
    const { isActive, title, description } = settingsData;
    
    const statusEmoji = isActive ? '✅' : '❌';
    const statusText = isActive ? 'Enabled' : 'Disabled';
    
    return await this.createNotificationForAllUsers({
      type: 'welfare',
      title: `${statusEmoji} Welfare Check System ${statusText}`,
      message: isActive 
        ? `The welfare check system is now active. ${description || 'You can now report your welfare status.'}`
        : `The welfare check system has been disabled. ${description || 'Please contact emergency services directly if needed.'}`,
      severity: isActive ? 'info' : 'warning',
      relatedId: null
    });
  }

  // Create system notification
  static async createSystemNotification(title, message, severity = 'info') {
    return await this.createNotificationForAllUsers({
      type: 'system',
      title: `🔧 ${title}`,
      message: message,
      severity: severity
    });
  }

  // Create incident report validation notification
  static async createIncidentValidationNotification(incidentData, validationStatus, userId) {
    const { incident_id, incident_type, description, priority_level } = incidentData;
    
    const statusEmoji = validationStatus === 'validated' ? '✅' : '❌';
    const statusText = validationStatus === 'validated' ? 'Validated' : 'Rejected';
    const severity = validationStatus === 'validated' ? 'info' : 'warning';
    
    const title = `${statusEmoji} Report ${statusText}: ${incident_type}`;
    const message = `Your incident report "${incident_type}" has been ${validationStatus} by the admin team. ${validationStatus === 'validated' ? 'The response team has been notified.' : 'Please review and resubmit if needed.'}`;
    
    return await this.createNotificationForUser(userId, {
      type: 'system',
      title: title,
      message: message,
      severity: severity,
      relatedId: incident_id
    });
  }

  // Create incident status update notification
  static async createIncidentStatusNotification(incidentData, status, userId) {
    const { incident_id, incident_type, description, priority_level } = incidentData;
    
    const statusEmoji = status === 'resolved' ? '🎉' : '🔒';
    const statusText = status === 'resolved' ? 'Resolved' : 'Closed';
    const severity = 'info';
    
    const title = `${statusEmoji} Report ${statusText}: ${incident_type}`;
    const message = `Your incident report "${incident_type}" has been ${status}. ${status === 'resolved' ? 'Thank you for your report. The issue has been successfully resolved.' : 'Your incident report has been closed.'}`;
    
    return await this.createNotificationForUser(userId, {
      type: 'system',
      title: title,
      message: message,
      severity: severity,
      relatedId: incident_id
    });
  }

  // Get user's notification preferences (simplified like admin system)
  static async getUserNotificationSettings(userId) {
    // Return default settings for now (like admin system)
    return {
      enableAlerts: true,
      enableSafetyProtocols: true,
      enableWelfare: true,
      enableSystem: true
    };
  }
}

module.exports = NotificationService;
