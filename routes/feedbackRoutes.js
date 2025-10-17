const express = require('express');
const router = express.Router();
const { submitFeedback, getFeedback } = require('../controllers/feedbackController');
const { authenticateUser, authenticateAdmin, authenticateStaff, authenticateAny } = require('../middleware/authMiddleware');

// Submit feedback (authenticated users)
router.post('/submit', authenticateAny, submitFeedback);

// Get feedback (admin/staff only - for viewing feedback)
router.get('/', authenticateAny, (req, res, next) => {
    // Check if user is admin or staff
    const userType = req.userType;
    if (userType !== 'admin' && userType !== 'staff') {
        return res.status(403).json({
            success: false,
            message: 'Access denied. Admin or staff privileges required.'
        });
    }
    next();
}, getFeedback);



// Test route
router.get('/test', (req, res) => {
    res.json({
        success: true,
        message: 'Feedback routes are working'
    });
});

module.exports = router;
