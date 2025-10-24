/**
 * Cloudinary Connection Test Script
 * 
 * Run this script to verify your Cloudinary configuration is working correctly.
 * 
 * Usage:
 *   node test-cloudinary.js
 */

require('dotenv').config();
const cloudinary = require('cloudinary').v2;

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

console.log('🔍 Testing Cloudinary Configuration...\n');

// Test 1: Check configuration
console.log('📋 Configuration:');
console.log(`   Cloud Name: ${process.env.CLOUDINARY_CLOUD_NAME || '❌ NOT SET'}`);
console.log(`   API Key: ${process.env.CLOUDINARY_API_KEY ? '✅ Set' : '❌ NOT SET'}`);
console.log(`   API Secret: ${process.env.CLOUDINARY_API_SECRET ? '✅ Set' : '❌ NOT SET'}`);
console.log('');

// Test 2: Try to connect to Cloudinary
async function testConnection() {
  try {
    console.log('🌐 Testing connection to Cloudinary...');
    
    // List resources in the safety-protocols folder
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'mdrrmo/safety-protocols',
      max_results: 10
    });
    
    console.log('✅ Successfully connected to Cloudinary!\n');
    console.log(`📁 Found ${result.resources.length} files in mdrrmo/safety-protocols folder:`);
    
    if (result.resources.length === 0) {
      console.log('   (No files found - this is normal for a new setup)');
    } else {
      result.resources.forEach((resource, index) => {
        const fileType = resource.resource_type;
        const fileName = resource.public_id.split('/').pop();
        const url = resource.secure_url;
        console.log(`   ${index + 1}. [${fileType}] ${fileName}`);
        console.log(`      URL: ${url}`);
      });
    }
    
    console.log('\n✨ Cloudinary is properly configured and accessible!');
    
  } catch (error) {
    console.error('❌ Failed to connect to Cloudinary:\n');
    console.error(`   Error: ${error.message}`);
    
    if (error.error && error.error.message) {
      console.error(`   Details: ${error.error.message}`);
    }
    
    console.log('\n💡 Troubleshooting tips:');
    console.log('   1. Check your .env file has correct Cloudinary credentials');
    console.log('   2. Verify your API key and secret are correct');
    console.log('   3. Check your internet connection');
    console.log('   4. Make sure your Cloudinary account is active');
    
    process.exit(1);
  }
}

// Test 3: Check upload capability
async function testUpload() {
  try {
    console.log('\n🧪 Testing upload capability...');
    
    // Create a simple test file (1x1 transparent PNG)
    const testImageData = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    const uploadResult = await cloudinary.uploader.upload(testImageData, {
      folder: 'mdrrmo/safety-protocols/test',
      resource_type: 'image',
      public_id: 'test-upload-' + Date.now()
    });
    
    console.log('✅ Test upload successful!');
    console.log(`   URL: ${uploadResult.secure_url}`);
    console.log(`   Public ID: ${uploadResult.public_id}`);
    
    // Clean up test file
    console.log('\n🧹 Cleaning up test file...');
    await cloudinary.uploader.destroy(uploadResult.public_id, {
      resource_type: 'image'
    });
    console.log('✅ Test file deleted');
    
    console.log('\n🎉 All tests passed! Your Cloudinary setup is working perfectly!');
    
  } catch (error) {
    console.error('❌ Upload test failed:\n');
    console.error(`   Error: ${error.message}`);
    
    console.log('\n💡 This might mean:');
    console.log('   1. Your API credentials are read-only');
    console.log('   2. Upload permissions are disabled');
    console.log('   3. Folder permissions are restricted');
    
    // Don't exit - connection test passed which is the main thing
  }
}

// Run tests
async function runTests() {
  if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
    console.error('❌ Missing Cloudinary credentials in .env file\n');
    console.log('Please add these to your .env file:');
    console.log('   CLOUDINARY_CLOUD_NAME=your_cloud_name');
    console.log('   CLOUDINARY_API_KEY=your_api_key');
    console.log('   CLOUDINARY_API_SECRET=your_api_secret');
    process.exit(1);
  }
  
  await testConnection();
  await testUpload();
}

runTests().catch(err => {
  console.error('❌ Test failed:', err);
  process.exit(1);
});

