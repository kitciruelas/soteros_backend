const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const WebSocket = require('ws');
const http = require('http');
require('dotenv').config();

// Set NODE_ENV to development if not set (for debugging)
if (!process.env.NODE_ENV) {
  process.env.NODE_ENV = 'development';
}

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: ['http://localhost:5173', 'http://localhost:3000'], // Allow both Vite and React default ports
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Cache-Control']
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Serve incident attachments specifically
app.use('/uploads/incidents', express.static(path.join(__dirname, 'uploads', 'incidents')));

// Import routes
const authRoutes = require('./routes/authRoutes');
const adminAuthRoutes = require('./routes/adminAuthRoutes');
const adminDashboardRoutes = require('./routes/adminDashboardRoutes');
const alertsRoutes = require('./routes/alertsRoutes');
const evacuationCentersRoutes = require('./routes/evacuationCentersRoutes');
const evacuationRoutesRoutes = require('./routes/evacuationRoutesRoutes');
const incidentRoutes = require('./routes/incidentRoutes');
const profileRoutes = require('./routes/profileRoutes');
const reportsRoutes = require('./routes/reportsRoutes');
const safetyProtocolsRoutes = require('./routes/safetyProtocolsRoutes');
const staffManagementRoutes = require('./routes/staffManagementRoutes');
const systemSettingsRoutes = require('./routes/systemSettingsRoutes');
const teamsRoutes = require('./routes/teamsRoutes');
const userManagementRoutes = require('./routes/userManagementRoutes');
const activityLogsRoutes = require('./routes/activityLogsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const feedbackRoutes = require('./routes/feedbackRoutes');
const staffDashboardRoutes = require('./routes/staffDashboardRoutes');
const welfareRoutes = require('./routes/welfareRoutes');
const adminWelfareRoutes = require('./routes/adminWelfareRoutes');
const notificationsRoutes = require('./routes/notificationsRoutes');

// Routing service proxy
const routingRoutes = require('./routes/routingRoutes');
const geocodingRoutes = require('./routes/geocodingRoutes');

// Use routes
app.use('/api/auth', authRoutes);
app.use('/api/admin/auth', adminAuthRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/alerts', alertsRoutes);
app.use('/api/evacuation-centers', evacuationCentersRoutes);
app.use('/api/evacuation-routes', evacuationRoutesRoutes);
app.use('/api/incidents', incidentRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/safety-protocols', safetyProtocolsRoutes);
app.use('/api/staff', staffManagementRoutes);
app.use('/api/system-settings', systemSettingsRoutes);
app.use('/api/teams', teamsRoutes);
app.use('/api/users', userManagementRoutes);
app.use('/api/activity-logs', activityLogsRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/feedback', feedbackRoutes);
app.use('/api/staff/dashboard', staffDashboardRoutes);
app.use('/api/welfare', welfareRoutes);
app.use('/api/admin/welfare', adminWelfareRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/routing', routingRoutes);
app.use('/api/geocoding', geocodingRoutes);

// Health check route
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'MDRRMO Backend API is running',
        timestamp: new Date().toISOString()
    });
});

// Root route
app.get('/', (req, res) => {
    res.json({
        success: true,
        message: 'Welcome to MDRRMO Backend API',
        version: '1.0.0'
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        success: false,
        message: 'Something went wrong!'
    });
});

// 404 handler
app.use('*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'Route not found'
    });
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server
const wss = new WebSocket.Server({ server });

// Store connected clients with their user info
const connectedClients = new Map();

// WebSocket connection handling
wss.on('connection', (ws, req) => {
    console.log('New WebSocket connection');

    // Parse token from URL query parameters
    const url = new URL(req.url, 'ws://localhost');
    const token = url.searchParams.get('token');

    if (!token) {
        ws.close(1008, 'Token required');
        return;
    }

    // Verify token and get user info
    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
        
        // Store client info
        const clientInfo = {
            ws: ws,
            userId: decoded.user_id || decoded.id,
            userType: decoded.user_type || decoded.userType,
            email: decoded.email,
            name: decoded.name || decoded.first_name
        };
        
        connectedClients.set(ws, clientInfo);
        console.log(`WebSocket client connected: ${clientInfo.userType} - ${clientInfo.email}`);

        // Send initial connection success message
        ws.send(JSON.stringify({ 
            type: 'connection', 
            status: 'connected',
            userType: clientInfo.userType,
            timestamp: new Date().toISOString()
        }));

    } catch (error) {
        console.error('Invalid token:', error.message);
        ws.close(1008, 'Invalid token');
        return;
    }

    // Handle incoming messages
    ws.on('message', (message) => {
        try {
            const data = JSON.parse(message);
            console.log('Received WebSocket message:', data);
            
            // Handle different message types
            switch (data.type) {
                case 'ping':
                    ws.send(JSON.stringify({ type: 'pong', timestamp: new Date().toISOString() }));
                    break;
                case 'subscribe':
                    // Handle subscription to specific notification types
                    console.log(`Client subscribed to: ${data.channels}`);
                    break;
                default:
                    console.log('Unknown message type:', data.type);
            }
        } catch (error) {
            console.error('Error processing WebSocket message:', error);
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid message format' }));
        }
    });

    // Handle client disconnection
    ws.on('close', () => {
        const clientInfo = connectedClients.get(ws);
        if (clientInfo) {
            console.log(`WebSocket client disconnected: ${clientInfo.userType} - ${clientInfo.email}`);
            connectedClients.delete(ws);
        }
    });

    // Handle errors
    ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        connectedClients.delete(ws);
    });
});

// Function to broadcast notifications to specific user types
function broadcastToUserType(userType, message) {
    let sentCount = 0;
    connectedClients.forEach((clientInfo, ws) => {
        if (clientInfo.userType === userType && ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
                sentCount++;
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                connectedClients.delete(ws);
            }
        }
    });
    console.log(`Broadcasted to ${sentCount} ${userType} clients`);
}

// Function to broadcast to all connected clients
function broadcastToAll(message) {
    let sentCount = 0;
    connectedClients.forEach((clientInfo, ws) => {
        if (ws.readyState === WebSocket.OPEN) {
            try {
                ws.send(JSON.stringify(message));
                sentCount++;
            } catch (error) {
                console.error('Error sending WebSocket message:', error);
                connectedClients.delete(ws);
            }
        }
    });
    console.log(`Broadcasted to ${sentCount} clients`);
}

// Function to broadcast incident notifications
function broadcastIncidentNotification(incidentData, type = 'new_incident') {
    const message = {
        type: type,
        data: incidentData,
        timestamp: new Date().toISOString()
    };
    
    // Broadcast to admin users
    broadcastToUserType('admin', message);
    
    // Also broadcast to staff if it's a new incident
    if (type === 'new_incident') {
        broadcastToUserType('staff', message);
    }
}

// Function to broadcast welfare notifications
function broadcastWelfareNotification(welfareData, type = 'new_welfare_report') {
    const message = {
        type: type,
        data: welfareData,
        timestamp: new Date().toISOString()
    };
    
    // Broadcast to admin users
    broadcastToUserType('admin', message);
}

// Export functions for use in other modules
global.broadcastIncidentNotification = broadcastIncidentNotification;
global.broadcastWelfareNotification = broadcastWelfareNotification;
global.broadcastToUserType = broadcastToUserType;
global.broadcastToAll = broadcastToAll;

// Start server
server.listen(PORT, () => {
    console.log(`MDRRMO Backend server is running on port ${PORT}`);
    console.log(`Health check: http://localhost:${PORT}/api/health`);
    console.log(`WebSocket server is running on ws://localhost:${PORT}`);
});

module.exports = app;
