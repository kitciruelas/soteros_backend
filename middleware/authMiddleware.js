
const jwt = require('jsonwebtoken');
const pool = require('../config/conn');

// Middleware to authenticate general users
const authenticateUser = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        console.log('AuthenticateUser middleware called');
        console.log('Authorization header:', authHeader);
        console.log('Request URL:', req.originalUrl);
        console.log('Request method:', req.method);

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('No valid authorization header found');
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log('Token extracted:', token.substring(0, 20) + '...');

        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET environment variable is not set');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error'
            });
        }
        
        console.log('Verifying JWT token...');
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('Token decoded successfully:', { id: decoded.id, type: decoded.type });

        // Check if token is for user type
        if (decoded.type !== 'user') {
            return res.status(403).json({
                success: false,
                message: 'Invalid token type for user access'
            });
        }

        // Get user details from database
        console.log('Querying database for user ID:', decoded.id);
        const [users] = await pool.execute(
            'SELECT * FROM general_users WHERE user_id = ? AND status = 1',
            [decoded.id]
        );
        console.log('Database query result:', users.length, 'users found');

        if (users.length === 0) {
            console.log('No users found in database');
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
        }

        // Attach user to request object
        req.user = users[0];
        console.log('User authenticated successfully:', req.user.user_id);
        next();

    } catch (error) {
        console.error('User authentication error:', error);
        console.error('Error name:', error.name);
        console.error('Error message:', error.message);

        if (error.name === 'JsonWebTokenError') {
            console.log('JWT verification failed - invalid token');
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            console.log('JWT verification failed - token expired');
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        console.log('Other authentication error occurred');
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// Middleware to authenticate admin users
const authenticateAdmin = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify JWT token
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET environment variable is not set');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error'
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // Check if token is for admin type
        if (decoded.type !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Invalid token type for admin access'
            });
        }

        // Get admin details from database
        const [admins] = await pool.execute(
            'SELECT * FROM admin WHERE admin_id = ? AND status = "active"',
            [decoded.id]
        );

        if (admins.length === 0) {
            return res.status(401).json({
                success: false,
                message: 'Admin not found or inactive'
            });
        }

        // Attach admin to request object
        req.admin = admins[0];
        // Also set req.user for compatibility with routes that expect it
        req.user = admins[0];
        next();

    } catch (error) {
        console.error('Admin authentication error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// Middleware to authenticate staff users
const authenticateStaff = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        console.log('🔐 AuthenticateStaff middleware called');
        console.log('🔐 Request URL:', req.originalUrl);
        console.log('🔐 Request method:', req.method);

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            console.log('❌ No valid authorization header found');
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        console.log('🔐 Token extracted:', token.substring(0, 20) + '...');

        // Verify JWT token
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET environment variable is not set');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error'
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        console.log('🔐 Token decoded successfully:', { id: decoded.id, type: decoded.type });

        // Check if token is for staff type
        if (decoded.type !== 'staff') {
            console.log('❌ Invalid token type for staff access:', decoded.type);
            return res.status(403).json({
                success: false,
                message: 'Invalid token type for staff access'
            });
        }

        // Get staff details from database
        console.log('🔐 Querying database for staff ID:', decoded.id);
        const [staff] = await pool.execute(
            'SELECT * FROM staff WHERE id = ? AND status = 1',
            [decoded.id]
        );
        console.log('🔐 Database query result:', staff.length, 'staff found');

        if (staff.length === 0) {
            console.log('❌ No staff found in database');
            return res.status(401).json({
                success: false,
                message: 'Staff member not found, inactive, or unavailable'
            });
        }

        // Attach staff to request object
        req.staff = staff[0];
        // Also set req.user for compatibility with routes that expect it
        req.user = staff[0];
        console.log('✅ Staff authenticated successfully:', req.staff.id);
        next();

    } catch (error) {
        console.error('❌ Staff authentication error:', error);
        console.error('❌ Error name:', error.name);
        console.error('❌ Error message:', error.message);

        if (error.name === 'JsonWebTokenError') {
            console.log('❌ JWT verification failed - invalid token');
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            console.log('❌ JWT verification failed - token expired');
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        console.log('❌ Other authentication error occurred');
        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

// Middleware to authenticate any authenticated user (user, admin, or staff)
const authenticateAny = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                message: 'Access token required'
            });
        }

        const token = authHeader.substring(7); // Remove 'Bearer ' prefix

        // Verify JWT token
        if (!process.env.JWT_SECRET) {
            console.error('JWT_SECRET environment variable is not set');
            return res.status(500).json({
                success: false,
                message: 'Server configuration error'
            });
        }
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        let user = null;

        // Try to find user based on type
        if (decoded.type === 'user') {
            const [users] = await pool.execute(
                'SELECT *, "user" as user_type FROM general_users WHERE user_id = ? AND status = 1',
                [decoded.id]
            );
            if (users.length > 0) user = users[0];
        } else if (decoded.type === 'admin') {
            const [admins] = await pool.execute(
                'SELECT *, "admin" as user_type FROM admin WHERE admin_id = ? AND status = "active"',
                [decoded.id]
            );
            if (admins.length > 0) user = admins[0];
        } else if (decoded.type === 'staff') {
            const [staff] = await pool.execute(
                'SELECT *, "staff" as user_type FROM staff WHERE id = ? AND status = 1',
                [decoded.id]
            );
            if (staff.length > 0) user = staff[0];
        }

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'User not found or inactive'
            });
        }

        // Attach user to request object
        req.user = user;
        req.userType = decoded.type;
        next();

    } catch (error) {
        console.error('Authentication error:', error);

        if (error.name === 'JsonWebTokenError') {
            return res.status(401).json({
                success: false,
                message: 'Invalid token'
            });
        }

        if (error.name === 'TokenExpiredError') {
            return res.status(401).json({
                success: false,
                message: 'Token expired'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Authentication error'
        });
    }
};

module.exports = {
    authenticateUser,
    authenticateAdmin,
    authenticateStaff,
    authenticateAny
};
