const crypto = require('crypto');

// Encryption configuration
const ALGORITHM = 'aes-256-gcm';
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 16; // 128 bits
const TAG_LENGTH = 16; // 128 bits

/**
 * Generate or retrieve encryption key from environment
 */
function getEncryptionKey() {
  let key = process.env.INCIDENT_ENCRYPTION_KEY;
  
  if (!key) {
    // Generate a new key if none exists (for development)
    key = crypto.randomBytes(KEY_LENGTH).toString('hex');
    console.warn('⚠️ No INCIDENT_ENCRYPTION_KEY found in environment. Generated temporary key:', key);
    console.warn('⚠️ Please set INCIDENT_ENCRYPTION_KEY in your environment variables for production!');
  }
  
  // Convert hex string to buffer if needed
  if (typeof key === 'string' && key.length === KEY_LENGTH * 2) {
    return Buffer.from(key, 'hex');
  }
  
  // Use key directly if it's already a buffer or create from string
  return Buffer.from(key, 'utf8').subarray(0, KEY_LENGTH);
}

/**
 * Encrypt sensitive data
 */
function encryptData(plaintext) {
  if (!plaintext || typeof plaintext !== 'string') {
    return plaintext;
  }

  try {
    const key = getEncryptionKey();
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipher(ALGORITHM, key);
    cipher.setAAD(Buffer.from('incident-data', 'utf8'));
    
    let encrypted = cipher.update(plaintext, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const tag = cipher.getAuthTag();
    
    // Combine IV, tag, and encrypted data
    const combined = iv.toString('hex') + ':' + tag.toString('hex') + ':' + encrypted;
    
    return combined;
  } catch (error) {
    console.error('❌ Encryption failed:', error.message);
    return plaintext; // Return original data if encryption fails
  }
}

/**
 * Decrypt sensitive data
 */
function decryptData(encryptedData) {
  if (!encryptedData || typeof encryptedData !== 'string') {
    return encryptedData;
  }

  try {
    const key = getEncryptionKey();
    const parts = encryptedData.split(':');
    
    if (parts.length !== 3) {
      // Not encrypted data, return as is
      return encryptedData;
    }
    
    const iv = Buffer.from(parts[0], 'hex');
    const tag = Buffer.from(parts[1], 'hex');
    const encrypted = parts[2];
    
    const decipher = crypto.createDecipher(ALGORITHM, key);
    decipher.setAAD(Buffer.from('incident-data', 'utf8'));
    decipher.setAuthTag(tag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    console.error('❌ Decryption failed:', error.message);
    return encryptedData; // Return original data if decryption fails
  }
}

/**
 * Middleware to encrypt sensitive incident data before sending response
 */
function encryptIncidentResponse(req, res, next) {
  const originalSend = res.send;
  
  res.send = function(data) {
    try {
      if (data && typeof data === 'string') {
        const parsed = JSON.parse(data);
        
        if (parsed.success && parsed.incidents) {
          // Encrypt sensitive fields in incident data
          parsed.incidents = parsed.incidents.map(incident => ({
            ...incident,
            description: encryptData(incident.description),
            validation_notes: encryptData(incident.validation_notes),
            // Keep other fields as they are for functionality
          }));
        } else if (parsed.success && parsed.incident) {
          // Encrypt single incident
          parsed.incident = {
            ...parsed.incident,
            description: encryptData(parsed.incident.description),
            validation_notes: encryptData(parsed.incident.validation_notes),
          };
        }
        
        data = JSON.stringify(parsed);
      }
    } catch (error) {
      console.error('❌ Response encryption failed:', error.message);
      // Continue with original data if encryption fails
    }
    
    originalSend.call(this, data);
  };
  
  next();
}

/**
 * Middleware to decrypt sensitive incident data when receiving requests
 */
function decryptIncidentRequest(req, res, next) {
  try {
    if (req.body && typeof req.body === 'object') {
      // Decrypt sensitive fields in request body
      if (req.body.description) {
        req.body.description = decryptData(req.body.description);
      }
      if (req.body.validationNotes) {
        req.body.validationNotes = decryptData(req.body.validationNotes);
      }
    }
  } catch (error) {
    console.error('❌ Request decryption failed:', error.message);
    // Continue with original data if decryption fails
  }
  
  next();
}

module.exports = {
  encryptData,
  decryptData,
  encryptIncidentResponse,
  decryptIncidentRequest
};
