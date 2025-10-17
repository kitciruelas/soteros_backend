// In-memory OTP store (in production, use Redis or database)
const otpStore = new Map();

// OTP configuration
const OTP_LENGTH = 6;
const OTP_EXPIRY_MINUTES = 10;

// Generate a random OTP
const generateOTP = () => {
    let otp = '';
    for (let i = 0; i < OTP_LENGTH; i++) {
        otp += Math.floor(Math.random() * 10);
    }
    return otp;
};

// Store OTP with expiry
const storeOTP = (email, otp) => {
    const expiryTime = Date.now() + (OTP_EXPIRY_MINUTES * 60 * 1000);
    otpStore.set(email.toLowerCase(), {
        otp: otp,
        expiry: expiryTime,
        attempts: 0
    });
    console.log(`OTP stored for ${email}: ${otp} (expires at ${new Date(expiryTime).toISOString()})`);
};

// Verify OTP
const verifyOTP = (email, otp, deleteOnSuccess = false) => {
    const emailKey = email.toLowerCase();
    const storedData = otpStore.get(emailKey);

    if (!storedData) {
        return { valid: false, message: 'OTP not found or expired' };
    }

    // Check if OTP has expired
    if (Date.now() > storedData.expiry) {
        otpStore.delete(emailKey);
        return { valid: false, message: 'OTP has expired' };
    }

    // Check if OTP matches
    if (storedData.otp !== otp) {
        storedData.attempts += 1;

        // Delete OTP after 3 failed attempts
        if (storedData.attempts >= 3) {
            otpStore.delete(emailKey);
            return { valid: false, message: 'Too many failed attempts. OTP has been invalidated.' };
        }

        return { valid: false, message: `Invalid OTP. ${3 - storedData.attempts} attempts remaining.` };
    }

    // OTP is valid
    if (deleteOnSuccess) {
        otpStore.delete(emailKey);
    }

    return { valid: true, message: 'OTP verified successfully' };
};

// Delete OTP
const deleteOTP = (email) => {
    const emailKey = email.toLowerCase();
    const deleted = otpStore.delete(emailKey);
    if (deleted) {
        console.log(`OTP deleted for ${email}`);
    }
    return deleted;
};

// Clean up expired OTPs (can be called periodically)
const cleanupExpiredOTPs = () => {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [email, data] of otpStore.entries()) {
        if (now > data.expiry) {
            otpStore.delete(email);
            cleanedCount++;
        }
    }

    if (cleanedCount > 0) {
        console.log(`Cleaned up ${cleanedCount} expired OTPs`);
    }
};

// Clean up expired OTPs every 5 minutes
setInterval(cleanupExpiredOTPs, 5 * 60 * 1000);

module.exports = {
    generateOTP,
    storeOTP,
    verifyOTP,
    deleteOTP,
    cleanupExpiredOTPs
};
