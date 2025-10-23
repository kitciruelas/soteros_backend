#!/bin/bash

# Deployment script for PROTEQ MDRRMO Backend
echo "Starting deployment process..."

# Clean install dependencies
echo "Installing dependencies..."
npm ci --prefer-offline --no-audit

# Create necessary directories
echo "Creating upload directories..."
mkdir -p uploads/profiles
mkdir -p uploads/incidents

# Set permissions
echo "Setting permissions..."
chmod 755 uploads
chmod 755 uploads/profiles
chmod 755 uploads/incidents

# Verify bcryptjs installation
echo "Verifying bcryptjs installation..."
node -e "console.log('bcryptjs version:', require('bcryptjs/package.json').version)"

echo "Deployment setup complete!"
echo "Starting server..."
npm start
