const express = require('express');
const router = express.Router();
const NodeCache = require('node-cache');

// Cache geocoding results for 24 hours
const geocodingCache = new NodeCache({ stdTTL: 86400 });

// Rate limiting setup - 1 request per second
let lastRequestTime = 0;
const minRequestInterval = 1000; // 1 second in milliseconds

const getLocationName = async (req, res) => {
    try {
        const { lat, lon } = req.query;
        
        console.log('Geocoding request:', { lat, lon });

        if (!lat || !lon) {
            console.log('Missing lat/lon parameters');
            return res.status(400).json({
                success: false,
                message: 'Latitude and longitude are required'
            });
        }

        // Check cache first
        const cacheKey = `${lat},${lon}`;
        const cachedResult = geocodingCache.get(cacheKey);
        if (cachedResult) {
            return res.json({
                success: true,
                data: cachedResult
            });
        }

        // Implement rate limiting
        const now = Date.now();
        const timeSinceLastRequest = now - lastRequestTime;
        if (timeSinceLastRequest < minRequestInterval) {
            await new Promise(resolve => setTimeout(resolve, minRequestInterval - timeSinceLastRequest));
        }
        lastRequestTime = Date.now();

        // Make request to Nominatim
        const url = `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=16&addressdetails=1`;
        console.log('Making request to:', url);
        
        const response = await fetch(url, {
            headers: {
                'User-Agent': 'PROTEQ-MDRRMO_Rosario/1.0'
            }
        });
        
        console.log('Nominatim response status:', response.status);

        if (!response.ok) {
            console.error('Nominatim API error:', {
                status: response.status,
                statusText: response.statusText
            });
            throw new Error(`Geocoding service error: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        
        // Validate response data
        if (!data || (typeof data !== 'object')) {
            throw new Error('Invalid response from geocoding service');
        }

        // Process the response
        let locationName = '';
        if (data.display_name) {
            const parts = data.display_name.split(', ');
            locationName = parts.slice(0, 3).join(', ');
        } else if (data.address) {
            const address = data.address;
            if (address.road && address.city) {
                locationName = `${address.road}, ${address.city}`;
            } else if (address.city) {
                locationName = address.city;
            } else if (address.town) {
                locationName = address.town;
            } else if (address.village) {
                locationName = address.village;
            } else {
                locationName = 'Unknown Location';
            }
        } else {
            locationName = 'Unknown Location';
        }

        // Cache the result
        geocodingCache.set(cacheKey, locationName);
        
        console.log('Geocoding success:', { cacheKey, locationName });

        res.json({
            success: true,
            data: locationName
        });
    } catch (error) {
        console.error('Geocoding error:', error);
        res.status(500).json({
            success: false,
            message: 'Error geocoding location'
        });
    }
};

router.get('/reverse', getLocationName);

module.exports = router;
