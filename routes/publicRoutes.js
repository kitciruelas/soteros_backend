const express = require('express');
const https = require('https');
const router = express.Router();

// Public routes that don't require authentication
// These routes are accessible to all users without login

// Health check route (public)
router.get('/health', (req, res) => {
    res.json({
        success: true,
        message: 'MDRRMO Public API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Get public system information
router.get('/system-info', (req, res) => {
    res.json({
        success: true,
        system: 'MDRRMO Disaster Response Management System',
        version: '1.0.0',
        status: 'operational',
        public_endpoints: [
            '/api/public/health',
            '/api/public/system-info'
        ]
    });
});

// Get public alerts (non-sensitive information only)
router.get('/alerts/public', async (req, res) => {
    try {
        const pool = require('../config/conn');

        const [alerts] = await pool.execute(`
            SELECT
                id as alert_id,
                title,
                description as message,
                alert_type,
                alert_severity as severity,
                status,
                created_at
            FROM alerts
            WHERE status = 'active'
            ORDER BY created_at DESC
            LIMIT 10
        `);

        res.json({
            success: true,
            alerts: alerts
        });
    } catch (error) {
        console.error('Error fetching public alerts:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch public alerts',
            error: error.message
        });
    }
});

// Get public statistics
router.get('/stats', async (req, res) => {
    try {
        const pool = require('../config/conn');

        // Get various statistics
        const [userStats] = await pool.execute(
            'SELECT COUNT(*) as total_users FROM general_users WHERE status = 1'
        );

        const [staffStats] = await pool.execute(
            'SELECT COUNT(*) as total_staff FROM staff WHERE status = 1'
        );

        const [adminStats] = await pool.execute(
            'SELECT COUNT(*) as total_admins FROM admin WHERE status = "active"'
        );

        const [incidentStats] = await pool.execute(
            'SELECT COUNT(*) as total_incidents FROM incident_reports'
        );

        const [activeIncidents] = await pool.execute(
            'SELECT COUNT(*) as active_incidents FROM incident_reports WHERE status IN ("pending", "in_progress")'
        );

        const [resolvedIncidents] = await pool.execute(
            'SELECT COUNT(*) as resolved_incidents FROM incident_reports WHERE status = "resolved"'
        );

        const [evacuationCenters] = await pool.execute(
            'SELECT COUNT(*) as total_centers FROM evacuation_centers WHERE status IN ("open", "full")'
        );

        const [activeAlerts] = await pool.execute(
            'SELECT COUNT(*) as active_alerts FROM alerts WHERE status = "active"'
        );

        res.json({
            success: true,
            stats: {
                users: {
                    total: userStats[0].total_users || 0
                },
                staff: {
                    total: staffStats[0].total_staff || 0
                },
                admins: {
                    total: adminStats[0].total_admins || 0
                },
                incidents: {
                    total: incidentStats[0].total_incidents || 0,
                    active: activeIncidents[0].active_incidents || 0,
                    resolved: resolvedIncidents[0].resolved_incidents || 0
                },
                evacuation_centers: {
                    total: evacuationCenters[0].total_centers || 0
                },
                alerts: {
                    active: activeAlerts[0].active_alerts || 0
                }
            },
            last_updated: new Date().toISOString()
        });

    } catch (error) {
        console.error('Error fetching public stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch public statistics',
            error: error.message
        });
    }
});

// Get public testimonials (feedback for display on home page)
router.get('/testimonials', async (req, res) => {
    try {
        const pool = require('../config/conn');
        const limit = parseInt(req.query.limit) || 6; // Default to 6 testimonials

        // Get feedback with user information, ordered by creation date (newest first)
        // Only get feedback with ratings (assuming rated feedback is more positive)
        const [feedbackRows] = await pool.execute(`
            SELECT
                f.id,
                f.message,
                f.rating,
                f.created_at,
                CASE
                    WHEN f.general_user_id IS NOT NULL THEN JSON_OBJECT(
                        'name', CONCAT(gu.first_name, ' ', gu.last_name),
                        'type', 'Resident'
                    )
                    WHEN f.staff_id IS NOT NULL THEN JSON_OBJECT(
                        'name', s.name,
                        'type', 'Staff',
                        'department', s.department
                    )
                    ELSE NULL
                END as user_info
            FROM feedback f
            LEFT JOIN general_users gu ON f.general_user_id = gu.user_id
            LEFT JOIN staff s ON f.staff_id = s.id
            WHERE f.rating IS NOT NULL AND f.rating >= 3
            AND (f.general_user_id IS NOT NULL OR f.staff_id IS NOT NULL)
            ORDER BY f.created_at DESC
            LIMIT ?
        `, [limit]);

        // Parse user_info JSON strings to objects and format for testimonials
        const testimonials = feedbackRows.map(row => {
            const userInfo = JSON.parse(row.user_info);
            return {
                id: row.id,
                quote: row.message,
                rating: row.rating,
                name: userInfo.name,
                type: userInfo.type,
                department: userInfo.type === 'Staff' ? userInfo.department : undefined,
                created_at: row.created_at
            };
        });

        res.json({
            success: true,
            testimonials: testimonials
        });

    } catch (error) {
        console.error('Error fetching public testimonials:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch testimonials',
            error: error.message
        });
    }
});

// Geocoding proxy endpoint to avoid CORS issues
router.get('/geocode', async (req, res) => {
    try {
        const { lat, lon } = req.query;

        if (!lat || !lon) {
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=18&addressdetails=1`;

        const options = {
            headers: {
                'User-Agent': 'ProteQ-Emergency-Management/1.0'
            }
        };

        https.get(url, options, (response) => {
            let data = '';

            response.on('data', (chunk) => {
                data += chunk;
            });

            response.on('end', () => {
                try {
                    const result = JSON.parse(data);
                    
                    if (!result || !result.display_name) {
                        return res.json({
                            success: false,
                            message: 'No location data found',
                            display_name: 'Unknown Location'
                        });
                    }

                    // Extract location details
                    let locationName = 'Unknown Location';
                    let detailedInfo = {};

                    if (result.address) {
                        const barangay = result.address.suburb || result.address.neighbourhood || result.address.hamlet || result.address.locality;
                        const municipality = result.address.city || result.address.town || result.address.village || result.address.municipality;
                        const province = result.address.state || result.address.county;
                        const country = result.address.country;

                        // Build location name with barangay if available
                        if (barangay && municipality && province) {
                            locationName = `Barangay ${barangay}, ${municipality}, ${province}`;
                        } else if (barangay && municipality) {
                            locationName = `Barangay ${barangay}, ${municipality}`;
                        } else if (municipality && province) {
                            locationName = `${municipality}, ${province}`;
                        } else if (municipality) {
                            locationName = municipality;
                        } else if (province) {
                            locationName = province;
                        } else {
                            locationName = result.display_name.split(',')[0] || result.display_name;
                        }

                        // Add country if it's not Philippines
                        if (country && country !== 'Philippines' && !locationName.includes(country)) {
                            locationName += `, ${country}`;
                        }

                        detailedInfo = {
                            barangay: barangay,
                            municipality: municipality || 'Unknown',
                            province: province || 'Unknown',
                            country: country || 'Unknown',
                            coordinates: {
                                latitude: parseFloat(lat),
                                longitude: parseFloat(lon)
                            }
                        };
                    } else {
                        locationName = result.display_name.split(',')[0] || result.display_name;
                    }

                    res.json({
                        success: true,
                        display_name: locationName,
                        original_display_name: result.display_name,
                        address: result.address,
                        detailed_info: detailedInfo
                    });

                } catch (parseError) {
                    console.error('Error parsing geocoding response:', parseError);
                    res.json({
                        success: false,
                        message: 'Failed to parse location data',
                        display_name: 'Unknown Location'
                    });
                }
            });

        }).on('error', (error) => {
            console.error('Geocoding request error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to fetch location data',
                error: error.message
            });
        });

    } catch (error) {
        console.error('Geocoding proxy error:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

module.exports = router;
