const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const multer = require('multer');

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Create Cloudinary storage for safety protocols
const safetyProtocolsStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mdrrmo/safety-protocols',
    resource_type: 'auto', // Supports images, PDFs, videos, etc.
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'gif', 'webp'],
    transformation: [{ quality: 'auto' }],
  },
});

// Create Cloudinary storage for incident attachments
const incidentsStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mdrrmo/incidents',
    resource_type: 'auto',
    allowed_formats: ['jpg', 'jpeg', 'png', 'pdf', 'doc', 'docx', 'gif', 'webp'],
    transformation: [{ quality: 'auto' }],
  },
});

// Create Cloudinary storage for profile pictures
const profilesStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mdrrmo/profiles',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp'],
    transformation: [
      { width: 500, height: 500, crop: 'limit' },
      { quality: 'auto' },
    ],
  },
});

// Create Cloudinary storage for evacuation center resources
const resourcesStorage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'mdrrmo/resources',
    resource_type: 'image',
    allowed_formats: ['jpg', 'jpeg', 'png', 'gif', 'webp', 'avif'],
    transformation: [{ quality: 'auto' }],
  },
});

// Create multer instances
const uploadSafetyProtocol = multer({ storage: safetyProtocolsStorage });
const uploadIncident = multer({ storage: incidentsStorage });
const uploadProfile = multer({ storage: profilesStorage });
const uploadResource = multer({ storage: resourcesStorage });

module.exports = {
  cloudinary,
  uploadSafetyProtocol,
  uploadIncident,
  uploadProfile,
  uploadResource,
};

