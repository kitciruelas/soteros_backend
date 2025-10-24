const express = require('express');
const router = express.Router();
const pool = require('../config/conn');
const { authenticateUser } = require('../middleware/authMiddleware');
const path = require('path');
const fs = require('fs');
const { uploadProfile } = require('../config/cloudinary');

// Get current user profile (authenticated user)
router.get('/me', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.user_id;

    const [users] = await pool.execute(
      `SELECT user_id, first_name as firstName, last_name as lastName, 
              email, phone, address, city, state, zip_code as zipCode,
              profile_picture, created_at, updated_at
       FROM general_users 
       WHERE user_id = ? AND status = 1`,
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: users[0]
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Update user profile (authenticated user)
router.put('/update', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const {
      firstName,
      lastName,
      email,
      phone,
      address,
      city,
      state,
      zipCode
    } = req.body;

    console.log('Profile update request from user ID:', userId, req.body);

    // Validate required fields
    if (!firstName || !lastName || !email) {
      return res.status(400).json({
        success: false,
        message: 'First name, last name, and email are required'
      });
    }

    // Check if email is being changed and if it's already taken by another user
    if (email) {
      const [existingUsers] = await pool.execute(
        'SELECT user_id FROM general_users WHERE email = ? AND user_id != ?',
        [email, userId]
      );

      if (existingUsers.length > 0) {
        return res.status(409).json({
          success: false,
          message: 'Email already taken by another user'
        });
      }
    }

    // Update user profile
    await pool.execute(
      `UPDATE general_users 
       SET first_name = ?, last_name = ?, email = ?, phone = ?, address = ?, 
           city = ?, state = ?, zip_code = ?, updated_at = NOW()
       WHERE user_id = ?`,
      [
        firstName,
        lastName,
        email,
        phone || null,
        address || null,
        city || null,
        state || null,
        zipCode || null,
        userId
      ]
    );

    console.log('Profile updated for user ID:', userId);

    // Log profile update
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
      await pool.execute(`
        INSERT INTO activity_logs (general_user_id, action, details, ip_address, created_at)
        VALUES (?, 'profile_update', ?, ?, NOW())
      `, [userId, `Profile updated for user: ${email}`, clientIP]);
      console.log('✅ Activity logged: profile_update');
    } catch (logError) {
      console.error('❌ Failed to log profile update activity:', logError.message);
    }

    // Get updated user data
    const [updatedUsers] = await pool.execute(
      `SELECT user_id, first_name as firstName, last_name as lastName, 
              email, phone, address, city, state, zip_code as zipCode,
              profile_picture, created_at, updated_at
       FROM general_users 
       WHERE user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Profile updated successfully',
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('Error updating profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update profile. Please try again.'
    });
  }
});

// Change password (authenticated user)
router.post('/change-password', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.user_id;
    const { currentPassword, newPassword } = req.body;

    console.log('Password change request from user ID:', userId);

    // Validate required fields
    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        success: false,
        message: 'Current password and new password are required'
      });
    }

    // Validate new password strength
    if (newPassword.length < 8) {
      return res.status(400).json({
        success: false,
        message: 'New password must be at least 8 characters long'
      });
    }

    // Get current user password
    const [users] = await pool.execute(
      'SELECT password FROM general_users WHERE user_id = ? AND status = 1',
      [userId]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const user = users[0];
    const bcrypt = require('bcryptjs');

    // Verify current password
    let isCurrentPasswordValid = false;

    if (user.password.startsWith('$2y$') || user.password.startsWith('$2b$') || user.password.startsWith('$2a$')) {
      // Hashed password - use bcrypt compare
      const hashToCompare = user.password.replace(/^\$2y\$/, '$2b$');
      isCurrentPasswordValid = await bcrypt.compare(currentPassword, hashToCompare);
    } else {
      // Plain text password (for backward compatibility)
      isCurrentPasswordValid = currentPassword === user.password;
    }

    if (!isCurrentPasswordValid) {
      return res.status(400).json({
        success: false,
        message: 'Current password is incorrect'
      });
    }

    // Hash the new password
    const saltRounds = 10;
    const hashedNewPassword = await bcrypt.hash(newPassword, saltRounds);

    // Update password
    await pool.execute(
      'UPDATE general_users SET password = ?, updated_at = NOW() WHERE user_id = ?',
      [hashedNewPassword, userId]
    );

    console.log('Password changed successfully for user ID:', userId);

    // Log password change activity
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
      await pool.execute(`
        INSERT INTO activity_logs (general_user_id, action, details, ip_address, created_at)
        VALUES (?, 'password_change', ?, ?, NOW())
      `, [userId, 'Password changed successfully', clientIP]);
      console.log('✅ Activity logged: password_change');
    } catch (logError) {
      console.error('❌ Failed to log password change activity:', logError.message);
    }

    res.json({
      success: true,
      message: 'Password changed successfully'
    });

  } catch (error) {
    console.error('Error changing password:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to change password. Please try again.'
    });
  }
});

// Get user profile by email (admin only - keep for backward compatibility)
router.get('/:email', async (req, res) => {
  try {
    const { email } = req.params;

    const [users] = await pool.execute(
      `SELECT user_id, first_name as firstName, last_name as lastName, 
              email, phone, address, city, state, zip_code as zipCode, created_at, updated_at
       FROM general_users 
       WHERE email = ? AND status = 1`,
      [email]
    );

    if (users.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    res.json({
      success: true,
      user: users[0]
    });

  } catch (error) {
    console.error('Error fetching profile:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch profile'
    });
  }
});

// Upload profile picture (authenticated user) - Using Cloudinary
router.post('/upload-picture', authenticateUser, uploadProfile.single('profilePicture'), async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log('📤 Profile picture upload request received');
    console.log('User ID from token:', userId);
    console.log('File received:', req.file ? 'Yes' : 'No');

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No file uploaded'
      });
    }

    console.log('✅ Cloudinary upload successful:', {
      url: req.file.path,
      filename: req.file.filename
    });

    // Get current profile picture
    const [currentUsers] = await pool.execute(
      'SELECT profile_picture FROM general_users WHERE user_id = ?',
      [userId]
    );

    if (currentUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentUser = currentUsers[0];

    // Note: Old Cloudinary images can be cleaned up via Cloudinary dashboard or API
    // For now, we just replace the URL in the database
    if (currentUser.profile_picture) {
      console.log('Replacing old profile picture URL:', currentUser.profile_picture);
    }

    // Store the full Cloudinary URL
    const cloudinaryUrl = req.file.path;

    // Update user profile with new Cloudinary URL
    await pool.execute(
      'UPDATE general_users SET profile_picture = ?, updated_at = NOW() WHERE user_id = ?',
      [cloudinaryUrl, userId]
    );

    console.log('✅ Profile picture updated for user ID:', userId);

    // Log profile picture update
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
      await pool.execute(`
        INSERT INTO activity_logs (general_user_id, action, details, ip_address, created_at)
        VALUES (?, 'profile_picture_update', ?, ?, NOW())
      `, [userId, `Profile picture uploaded to Cloudinary`, clientIP]);
      console.log('✅ Activity logged: profile_picture_update');
    } catch (logError) {
      console.error('❌ Failed to log profile picture update activity:', logError.message);
    }

    // Get updated user data
    const [updatedUsers] = await pool.execute(
      `SELECT user_id, first_name as firstName, last_name as lastName, 
              email, phone, address, city, state, zip_code as zipCode,
              profile_picture, created_at, updated_at
       FROM general_users 
       WHERE user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Profile picture updated successfully',
      user: updatedUsers[0],
      profilePicture: cloudinaryUrl
    });

  } catch (error) {
    console.error('❌ Error uploading profile picture:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to upload profile picture. Please try again.'
    });
  }
});

// Delete profile picture (authenticated user)
router.delete('/delete-picture', authenticateUser, async (req, res) => {
  try {
    const userId = req.user.user_id;

    console.log('🗑️ Profile picture deletion request from user ID:', userId);

    // Get current profile picture
    const [currentUsers] = await pool.execute(
      'SELECT profile_picture FROM general_users WHERE user_id = ?',
      [userId]
    );

    if (currentUsers.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'User not found'
      });
    }

    const currentUser = currentUsers[0];

    if (!currentUser.profile_picture) {
      return res.status(400).json({
        success: false,
        message: 'No profile picture to delete'
      });
    }

    // Note: For Cloudinary images, deletion can be managed via Cloudinary dashboard
    // We just remove the URL from the database here
    console.log('Removing profile picture URL from database:', currentUser.profile_picture);

    // Update user profile to remove picture path
    await pool.execute(
      'UPDATE general_users SET profile_picture = NULL, updated_at = NOW() WHERE user_id = ?',
      [userId]
    );

    console.log('✅ Profile picture deleted for user ID:', userId);

    // Log profile picture deletion
    try {
      const clientIP = req.headers['x-forwarded-for'] || req.connection.remoteAddress || req.ip || 'unknown';
      await pool.execute(`
        INSERT INTO activity_logs (general_user_id, action, details, ip_address, created_at)
        VALUES (?, 'profile_picture_delete', ?, ?, NOW())
      `, [userId, 'Profile picture deleted', clientIP]);
      console.log('✅ Activity logged: profile_picture_delete');
    } catch (logError) {
      console.error('❌ Failed to log profile picture deletion activity:', logError.message);
    }

    // Get updated user data
    const [updatedUsers] = await pool.execute(
      `SELECT user_id, first_name as firstName, last_name as lastName, 
              email, phone, address, city, state, zip_code as zipCode,
              profile_picture, created_at, updated_at
       FROM general_users 
       WHERE user_id = ?`,
      [userId]
    );

    res.json({
      success: true,
      message: 'Profile picture deleted successfully',
      user: updatedUsers[0]
    });

  } catch (error) {
    console.error('❌ Error deleting profile picture:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete profile picture. Please try again.'
    });
  }
});

module.exports = router;
