const express = require('express');
const router = express.Router();
const pool = require('../config/conn');
const fs = require('fs').promises;
const path = require('path');

// GET - Get all reports with pagination and filtering
router.get('/', async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 10, 
      type = 'all',
      status = 'all',
      date_from = '',
      date_to = ''
    } = req.query;
    
    console.log('Fetching reports with filters:', { page, limit, type, status, date_from, date_to });
    
    let whereClause = 'WHERE 1=1';
    let queryParams = [];
    
    // Add type filter
    if (type !== 'all') {
      whereClause += ' AND type = ?';
      queryParams.push(type);
    }
    
    // Add status filter
    if (status !== 'all') {
      whereClause += ' AND status = ?';
      queryParams.push(status);
    }
    
    // Add date range filter
    if (date_from) {
      whereClause += ' AND DATE(created_at) >= ?';
      queryParams.push(date_from);
    }
    
    if (date_to) {
      whereClause += ' AND DATE(created_at) <= ?';
      queryParams.push(date_to);
    }
    
    // Get total count
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM reports ${whereClause}`,
      queryParams
    );
    
    const totalReports = countResult[0].total;
    const totalPages = Math.ceil(totalReports / limit);
    const offset = (page - 1) * limit;
    
    // Get paginated reports with generator info
    const [reports] = await pool.execute(`
      SELECT 
        r.*,
        CASE 
          WHEN r.generated_by IS NOT NULL THEN 'Admin User'
          ELSE 'System'
        END as generator_name
      FROM reports r
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT ? OFFSET ?
    `, [...queryParams, parseInt(limit), offset]);
    
    // Parse JSON parameters
    const processedReports = reports.map(report => ({
      ...report,
      parameters: report.parameters ? JSON.parse(report.parameters) : {}
    }));
    
    res.json({
      success: true,
      reports: processedReports,
      pagination: {
        currentPage: parseInt(page),
        totalPages,
        totalReports,
        hasNext: page < totalPages,
        hasPrev: page > 1
      }
    });
    
  } catch (error) {
    console.error('Error fetching reports:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch reports',
      error: error.message
    });
  }
});

// GET - Get report by ID
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Fetching report with ID:', id);
    
    const [reports] = await pool.execute(
      'SELECT * FROM reports WHERE id = ?',
      [id]
    );
    
    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const report = reports[0];
    report.parameters = report.parameters ? JSON.parse(report.parameters) : {};
    
    res.json({
      success: true,
      report
    });
    
  } catch (error) {
    console.error('Error fetching report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch report',
      error: error.message
    });
  }
});

// POST - Generate new report
router.post('/generate', async (req, res) => {
  try {
    const {
      title,
      type,
      description,
      parameters = {}
    } = req.body;
    
    console.log('Generating new report:', { title, type });
    
    if (!title || !type) {
      return res.status(400).json({
        success: false,
        message: 'Title and type are required'
      });
    }
    
    // Insert report record
    const [result] = await pool.execute(`
      INSERT INTO reports (
        title, type, description, parameters, status, 
        generated_by, created_at
      )
      VALUES (?, ?, ?, ?, 'generating', ?, NOW())
    `, [title, type, description, JSON.stringify(parameters), req.user?.id || 1]);
    
    const reportId = result.insertId;
    
    // Start report generation process (async)
    generateReportData(reportId, type, parameters);
    
    // Log the generation request
    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'report_generate', ?, NOW())
    `, [req.user?.id || 1, `Requested generation of ${type} report: ${title}`]);
    
    res.status(201).json({
      success: true,
      message: 'Report generation started',
      reportId
    });
    
  } catch (error) {
    console.error('Error generating report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate report',
      error: error.message
    });
  }
});

// GET - Download report file
router.get('/:id/download', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Downloading report:', id);
    
    const [reports] = await pool.execute(
      'SELECT * FROM reports WHERE id = ? AND status = "completed"',
      [id]
    );
    
    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found or not completed'
      });
    }
    
    const report = reports[0];
    
    if (!report.file_path) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found'
      });
    }
    
    const filePath = path.join(__dirname, '..', report.file_path);
    
    try {
      await fs.access(filePath);
      res.download(filePath, `${report.title}.csv`);
    } catch (fileError) {
      return res.status(404).json({
        success: false,
        message: 'Report file not found on disk'
      });
    }
    
  } catch (error) {
    console.error('Error downloading report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to download report',
      error: error.message
    });
  }
});

// DELETE - Delete report
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    console.log('Deleting report:', id);
    
    // Get report details
    const [reports] = await pool.execute(
      'SELECT title, file_path FROM reports WHERE id = ?',
      [id]
    );
    
    if (reports.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Report not found'
      });
    }
    
    const report = reports[0];
    
    // Delete file if exists
    if (report.file_path) {
      const filePath = path.join(__dirname, '..', report.file_path);
      try {
        await fs.unlink(filePath);
      } catch (fileError) {
        console.log('File already deleted or not found:', fileError.message);
      }
    }
    
    // Delete report record
    await pool.execute('DELETE FROM reports WHERE id = ?', [id]);
    
    // Log the deletion
    await pool.execute(`
      INSERT INTO activity_logs (admin_id, action, details, created_at)
      VALUES (?, 'report_delete', ?, NOW())
    `, [req.user?.id || 1, `Deleted report: ${report.title} (ID: ${id})`]);
    
    res.json({
      success: true,
      message: 'Report deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting report:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete report',
      error: error.message
    });
  }
});

// Async function to generate report data
async function generateReportData(reportId, type, parameters) {
  try {
    console.log(`Generating ${type} report with ID: ${reportId}`);
    
    let query = '';
    let filename = '';
    
    // Define queries based on report type
    switch (type) {
      case 'user':
        query = `
          SELECT id, name, email, phone, barangay, status, created_at, last_login
          FROM users 
          WHERE status != 'deleted'
          ORDER BY created_at DESC
        `;
        filename = `user_report_${Date.now()}.csv`;
        break;
        
      case 'incident':
        query = `
          SELECT id, title, type, priority, status, location, description, created_at
          FROM incidents 
          ORDER BY created_at DESC
        `;
        filename = `incident_report_${Date.now()}.csv`;
        break;
        
      case 'staff':
        query = `
          SELECT staff_id, name, email, position, department, status, hired_date, created_at
          FROM staff 
          WHERE status != 'deleted'
          ORDER BY created_at DESC
        `;
        filename = `staff_report_${Date.now()}.csv`;
        break;
        
      default:
        throw new Error('Unsupported report type');
    }
    
    // Execute query
    const [data] = await pool.execute(query);
    
    // Generate CSV content
    if (data.length === 0) {
      throw new Error('No data found for report');
    }
    
    const headers = Object.keys(data[0]);
    const csvContent = [
      headers.join(','),
      ...data.map(row => headers.map(header => `"${row[header] || ''}"`).join(','))
    ].join('\n');
    
    // Save file
    const reportsDir = path.join(__dirname, '..', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });
    
    const filePath = path.join(reportsDir, filename);
    await fs.writeFile(filePath, csvContent);
    
    const fileStats = await fs.stat(filePath);
    
    // Update report status
    await pool.execute(`
      UPDATE reports 
      SET status = 'completed', file_path = ?, file_size = ?, completed_at = NOW()
      WHERE id = ?
    `, [`reports/${filename}`, fileStats.size, reportId]);
    
    console.log(`Report ${reportId} generated successfully`);
    
  } catch (error) {
    console.error(`Error generating report ${reportId}:`, error);
    
    // Update report status to failed
    await pool.execute(`
      UPDATE reports 
      SET status = 'failed', completed_at = NOW()
      WHERE id = ?
    `, [reportId]);
  }
}

module.exports = router;
