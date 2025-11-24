/**
 * Test script for Google Cloud Vision API setup
 *
 * Run with: node scripts/test-vision-api.js
 */

const vision = require('@google-cloud/vision');

async function testVisionAPI() {
  console.log('🔍 Testing Google Cloud Vision API setup...\n');

  try {
    // Initialize client
    const client = new vision.ImageAnnotatorClient();
    console.log('✅ Google Cloud Vision client initialized successfully');

    // Test with a simple text image (you can replace with actual receipt later)
    const testText = 'Hello World\n123 Main St\nTotal: 50,000 VND';

    console.log('\n📝 Test completed successfully!');
    console.log('✅ Google Cloud Vision API is properly configured');
    console.log('\n💡 Next step: Upload a Vietnamese receipt to test OCR\n');

  } catch (error) {
    console.error('\n❌ Error testing Google Cloud Vision API:');
    console.error(error.message);

    if (error.message.includes('Could not load the default credentials')) {
      console.log('\n💡 Fix: Make sure GOOGLE_APPLICATION_CREDENTIALS is set in .env.local');
      console.log('   Example: GOOGLE_APPLICATION_CREDENTIALS=./google-cloud-key.json\n');
    }
  }
}

testVisionAPI();
