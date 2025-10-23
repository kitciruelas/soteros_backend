const cryptoTimingSafeEqual = (a, b) => {
    if (typeof a !== 'string' || typeof b !== 'string') return false;
    if (a.length !== b.length) return false;
    let result = 0;
    for (let i = 0; i < a.length; i++) {
        result |= a.charCodeAt(i) ^ b.charCodeAt(i);
    }
    return result === 0;
};

module.exports = function apiKey(req, res, next) {
    const providedKey = req.header('x-api-key') || '';
    const expectedKey = process.env.PUBLIC_API_KEY || '';

    if (!expectedKey) {
        return res.status(503).json({ success: false, message: 'Public API is disabled' });
    }

    if (!cryptoTimingSafeEqual(providedKey, expectedKey)) {
        return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    next();
};


