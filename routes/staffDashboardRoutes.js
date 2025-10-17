const express = require('express');
const router = express.Router();
const db = require('../config/conn');
const { authenticateStaff } = require('../middleware/authMiddleware');

// Get staff dashboard stats
router.get('/stats', authenticateStaff, async (req, res) => {
  try {
    const staffId = req.staff.id;

    // Get all incidents
    const [incidents] = await db.execute(`
      SELECT incident_id, status, priority_level, assigned_staff_id
      FROM incident_reports
    `);

    // Filter incidents assigned to this staff
    const assignedIncidents = incidents.filter(incident => incident.assigned_staff_id === staffId);

    // Calculate stats
    const totalIncidents = assignedIncidents.length;
    const pendingIncidents = assignedIncidents.filter(incident => incident.status === 'pending').length;
    const inProgressIncidents = assignedIncidents.filter(incident => incident.status === 'in_progress').length;
    const resolvedIncidents = assignedIncidents.filter(incident => incident.status === 'resolved').length;
    const criticalIncidents = assignedIncidents.filter(incident => incident.priority_level === 'critical').length;
    const highPriorityIncidents = assignedIncidents.filter(incident => incident.priority_level === 'high').length;

    const stats = {
      totalIncidents,
      pendingIncidents,
      inProgressIncidents,
      resolvedIncidents,
      criticalIncidents,
      highPriorityIncidents
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Error fetching staff dashboard stats:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch dashboard stats'
    });
  }
});

module.exports = router;
