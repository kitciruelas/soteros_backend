const express = require('express');
const router = express.Router();
const pool = require('../config/conn');
const { authenticateAdmin } = require('../middleware/authMiddleware');
const NotificationService = require('../services/notificationService');
const { uploadSafetyProtocol } = require('../config/cloudinary');

// Upload an attachment for safety protocols
router.post('/upload', uploadSafetyProtocol.single('attachment'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'No file uploaded' });
    }
    
    // Log what Cloudinary returns for debugging
    console.log('📤 Cloudinary upload SUCCESS:', {
      filename: req.file.filename,
      path: req.file.path,
      mimetype: req.file.mimetype,
      size: req.file.size
    });
    
    // Validate that we got a proper Cloudinary URL
    if (!req.file.path || !req.file.path.startsWith('https://res.cloudinary.com/')) {
      console.error('❌ Invalid Cloudinary URL received:', req.file.path);
      return res.status(500).json({ 
        success: false, 
        message: 'File uploaded but invalid URL received from Cloudinary'
      });
    }
    
    // For PDFs, ensure the URL uses /raw/upload/ not /image/upload/
    let finalUrl = req.file.path;
    if (req.file.mimetype === 'application/pdf' && finalUrl.includes('/image/upload/')) {
      finalUrl = finalUrl.replace('/image/upload/', '/raw/upload/');
      console.log('✅ Corrected PDF URL from /image/upload/ to /raw/upload/');
    }
    
    console.log('✅ Final URL to store:', finalUrl);
    
    // Return the full Cloudinary URL - this is what should be stored in the database
    return res.json({
      success: true,
      filename: req.file.filename, // Just the public ID (for reference)
      path: finalUrl, // Full Cloudinary URL (THIS is what should be stored!)
      url: finalUrl // Full Cloudinary URL for direct access
    });
  } catch (error) {
    console.error('❌ Error uploading attachment:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Get all safety protocols (admin protected)
router.get('/', authenticateAdmin, async (req, res) => {
  try {
    console.log('Fetching safety protocols (admin)...');
    const [results] = await pool.execute(`
      SELECT 
        sp.*,
        CASE 
          WHEN sp.created_by IS NULL THEN 'System'
          ELSE COALESCE(a.name, 'Unknown Admin')
        END as creator_name,
        a.admin_id,
        a.name as admin_name
      FROM safety_protocols sp
      LEFT JOIN admin a ON sp.created_by = a.admin_id
      ORDER BY sp.created_at DESC
    `);
    console.log('Found safety protocols:', results.length);
    console.log('Sample protocol data:', results.length > 0 ? {
      protocol_id: results[0].protocol_id,
      title: results[0].title,
      created_by: results[0].created_by,
      creator_name: results[0].creator_name
    } : 'No protocols found');
    res.json(results);
  } catch (error) {
    console.error('Error fetching safety protocols:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Get all safety protocols (public access - no authentication required)
router.get('/public', async (req, res) => {
  try {
    console.log('Fetching safety protocols (public)...');
    const [results] = await pool.execute(`
      SELECT 
        protocol_id,
        title,
        description,
        type,
        file_attachment,
        created_at,
        updated_at
      FROM safety_protocols 
      ORDER BY created_at DESC
    `);
    console.log('Found public safety protocols:', results.length);
    res.json(results);
  } catch (error) {
    console.error('Error fetching public safety protocols:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error.message
    });
  }
});

// Create a safety protocol
router.post('/', authenticateAdmin, async (req, res) => {
  try {
    const { title, description, type, file_attachment = null, created_by = null } = req.body || {};
    
    console.log('Creating safety protocol - received data:', {
      title,
      type,
      created_by_from_body: created_by,
      admin_id_from_request: req.admin?.admin_id
    });

    if (!title || !description || !type) {
      return res.status(400).json({ success: false, message: 'title, description and type are required' });
    }

    // Validate type against enum
    const allowedTypes = ['fire', 'earthquake', 'medical', 'intrusion', 'general'];
    if (!allowedTypes.includes(String(type).toLowerCase())) {
      return res.status(400).json({ success: false, message: 'Invalid type value' });
    }

    // Use created_by from request body, or fallback to req.admin.admin_id, or default to null
    const finalCreatedBy = created_by !== null && created_by !== undefined
      ? created_by
      : (req.admin?.admin_id || null);

    console.log('Final created_by value to be inserted:', finalCreatedBy);

    const insertSql = `
      INSERT INTO safety_protocols (title, description, type, file_attachment, created_by)
      VALUES (?, ?, ?, ?, ?)
    `;
    const [result] = await pool.execute(insertSql, [title, description, String(type).toLowerCase(), file_attachment, finalCreatedBy]);

    // Create notification for all users
    try {
      await NotificationService.createSafetyProtocolNotification({
        id: result.insertId,
        title: title,
        description: description,
        type: String(type).toLowerCase()
      });
      console.log('Notification created for safety protocol:', result.insertId);
    } catch (notificationError) {
      console.error('Error creating notification for safety protocol:', notificationError);
      // Don't fail the protocol creation if notification fails
    }

    // Log the protocol creation
    try {
      const { created_by } = req.body;
      const finalCreatedBy = created_by !== null && created_by !== undefined
        ? created_by
        : (req.admin?.admin_id || null);

      console.log('Final created_by value to be inserted:', finalCreatedBy);

      if (finalCreatedBy) {
        await pool.execute(`
          INSERT INTO activity_logs (admin_id, action, details, created_at)
          VALUES (?, 'safety_protocol_create', ?, NOW())
        `, [finalCreatedBy, `Created safety protocol: ${title} (ID: ${result.insertId})`]);
      } else {
        console.warn('Admin ID not found for logging safety protocol creation');
      }
    } catch (logError) {
      console.warn('Failed to log safety protocol creation activity:', logError.message);
    }

    const [rows] = await pool.execute('SELECT * FROM safety_protocols WHERE protocol_id = ?', [result.insertId]);
    return res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error creating safety protocol:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Update a safety protocol
router.put('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, type, file_attachment, created_by } = req.body || {};

    // Build dynamic update
    const fields = [];
    const values = [];
    if (title !== undefined) { fields.push('title = ?'); values.push(title); }
    if (description !== undefined) { fields.push('description = ?'); values.push(description); }
    if (type !== undefined) {
      const allowedTypes = ['fire', 'earthquake', 'medical', 'intrusion', 'general'];
      if (!allowedTypes.includes(String(type).toLowerCase())) {
        return res.status(400).json({ success: false, message: 'Invalid type value' });
      }
      fields.push('type = ?'); values.push(String(type).toLowerCase());
    }
    if (file_attachment !== undefined) { fields.push('file_attachment = ?'); values.push(file_attachment); }
    if (created_by !== undefined) { fields.push('created_by = ?'); values.push(created_by); }

    if (fields.length === 0) {
      return res.status(400).json({ success: false, message: 'No fields to update' });
    }

    const sql = `UPDATE safety_protocols SET ${fields.join(', ')} WHERE protocol_id = ?`;
    values.push(id);
    await pool.execute(sql, values);

    // Log the protocol update
    try {
      if (req.admin?.admin_id) {
        await pool.execute(`
          INSERT INTO activity_logs (admin_id, action, details, created_at)
          VALUES (?, 'safety_protocol_update', ?, NOW())
        `, [req.admin.admin_id, `Updated safety protocol (ID: ${id})`]);
      } else {
        console.warn('Admin ID not found for logging safety protocol update');
      }
    } catch (logError) {
      console.warn('Failed to log safety protocol update activity:', logError.message);
    }

    const [rows] = await pool.execute('SELECT * FROM safety_protocols WHERE protocol_id = ?', [id]);
    if (!rows[0]) return res.status(404).json({ success: false, message: 'Not found' });
    return res.json({ success: true, data: rows[0] });
  } catch (error) {
    console.error('Error updating safety protocol:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Delete a safety protocol
router.delete('/:id', authenticateAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Get protocol details before deletion for logging
    const [existingProtocols] = await pool.execute(
      'SELECT title FROM safety_protocols WHERE protocol_id = ?',
      [id]
    );
    
    const [result] = await pool.execute('DELETE FROM safety_protocols WHERE protocol_id = ?', [id]);
    if (result.affectedRows === 0) return res.status(404).json({ success: false, message: 'Not found' });
    
    // Log the protocol deletion
    try {
      const protocolTitle = existingProtocols[0]?.title || `ID: ${id}`;
      if (req.admin?.admin_id) {
        await pool.execute(`
          INSERT INTO activity_logs (admin_id, action, details, created_at)
          VALUES (?, 'safety_protocol_delete', ?, NOW())
        `, [req.admin.admin_id, `Deleted safety protocol: ${protocolTitle} (ID: ${id})`]);
      } else {
        console.warn('Admin ID not found for logging safety protocol deletion');
      }
    } catch (logError) {
      console.warn('Failed to log safety protocol deletion activity:', logError.message);
    }
    
    return res.json({ success: true });
  } catch (error) {
    console.error('Error deleting safety protocol:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

// Utility endpoint to check and fix Cloudinary URLs (admin only)
router.post('/fix-urls', authenticateAdmin, async (req, res) => {
  try {
    const [protocols] = await pool.execute('SELECT protocol_id, title, file_attachment FROM safety_protocols WHERE file_attachment IS NOT NULL');
    
    const fixes = [];
    const errors = [];
    
    for (const protocol of protocols) {
      const original = protocol.file_attachment;
      let fixed = original;
      let needsUpdate = false;
      
      // Check if it's already a valid Cloudinary URL
      if (original.startsWith('https://res.cloudinary.com/')) {
        // Check if PDF URL is using wrong resource type
        if (original.toLowerCase().endsWith('.pdf') && original.includes('/image/upload/')) {
          fixed = original.replace('/image/upload/', '/raw/upload/');
          needsUpdate = true;
        }
      } else if (original.startsWith('http://') || original.startsWith('https://')) {
        // It's a URL but not Cloudinary - might be old local URL
        errors.push({
          protocol_id: protocol.protocol_id,
          title: protocol.title,
          url: original,
          issue: 'Not a Cloudinary URL - may need re-upload'
        });
      } else {
        // It's just a filename or partial path - needs manual fixing
        errors.push({
          protocol_id: protocol.protocol_id,
          title: protocol.title,
          url: original,
          issue: 'Incomplete URL - needs re-upload'
        });
      }
      
      if (needsUpdate) {
        await pool.execute('UPDATE safety_protocols SET file_attachment = ? WHERE protocol_id = ?', [fixed, protocol.protocol_id]);
        fixes.push({
          protocol_id: protocol.protocol_id,
          title: protocol.title,
          original: original,
          fixed: fixed
        });
      }
    }
    
    console.log('✅ URL Fix Results:', {
      total: protocols.length,
      fixed: fixes.length,
      errors: errors.length
    });
    
    res.json({
      success: true,
      summary: {
        total: protocols.length,
        fixed: fixes.length,
        errors: errors.length
      },
      fixes: fixes,
      errors: errors
    });
  } catch (error) {
    console.error('❌ Error fixing URLs:', error);
    res.status(500).json({ success: false, message: 'Internal server error', error: error.message });
  }
});

module.exports = router;