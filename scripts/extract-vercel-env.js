#!/usr/bin/env node

/**
 * Extract Google Cloud credentials for Vercel environment variables
 *
 * Usage: node scripts/extract-vercel-env.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n========================================');
console.log('  Vercel Environment Variables Helper');
console.log('========================================\n');

// Check if google-cloud-key.json exists
const keyFilePath = path.join(__dirname, '..', 'google-cloud-key.json');

if (!fs.existsSync(keyFilePath)) {
  console.error('❌ Error: google-cloud-key.json not found in project root');
  console.error('   Please make sure the file exists at:', keyFilePath);
  process.exit(1);
}

try {
  // Read and parse the JSON file
  const data = JSON.parse(fs.readFileSync(keyFilePath, 'utf8'));

  // Validate required fields
  if (!data.project_id || !data.client_email || !data.private_key) {
    console.error('❌ Error: google-cloud-key.json is missing required fields');
    console.error('   Required: project_id, client_email, private_key');
    process.exit(1);
  }

  console.log('✅ Successfully read google-cloud-key.json\n');
  console.log('📋 Copy these values to Vercel:\n');
  console.log('━'.repeat(80));

  // Variable 1
  console.log('\n1️⃣  GOOGLE_CLOUD_PROJECT_ID');
  console.log('   ┌─────────────────────────────────────────────────────');
  console.log('   │ ' + data.project_id);
  console.log('   └─────────────────────────────────────────────────────');

  // Variable 2
  console.log('\n2️⃣  GOOGLE_CLOUD_CLIENT_EMAIL');
  console.log('   ┌─────────────────────────────────────────────────────');
  console.log('   │ ' + data.client_email);
  console.log('   └─────────────────────────────────────────────────────');

  // Variable 3
  console.log('\n3️⃣  GOOGLE_CLOUD_PRIVATE_KEY');
  console.log('   ⚠️  This is a LONG value - scroll down to see it all!');
  console.log('   ⚠️  Make sure to copy the ENTIRE value including \\n characters');
  console.log('   ┌─────────────────────────────────────────────────────');

  // Print private key with proper formatting
  const privateKey = data.private_key;
  const lines = privateKey.split('\n');

  // Show each line of the private key
  console.log('   │ ' + privateKey);

  console.log('   └─────────────────────────────────────────────────────');

  console.log('\n━'.repeat(80));
  console.log('\n📝 Instructions:');
  console.log('   1. Go to: https://vercel.com/dashboard');
  console.log('   2. Select your project');
  console.log('   3. Go to: Settings → Environment Variables');
  console.log('   4. Add each variable above (copy from the boxes)');
  console.log('   5. Select all environments: Production, Preview, Development');
  console.log('   6. Save and redeploy your application');
  console.log('\n💡 Pro Tip: You can also copy-paste from the JSON format below:\n');

  console.log('━'.repeat(80));
  console.log('JSON Format (for reference):');
  console.log('━'.repeat(80));
  console.log(JSON.stringify({
    GOOGLE_CLOUD_PROJECT_ID: data.project_id,
    GOOGLE_CLOUD_CLIENT_EMAIL: data.client_email,
    GOOGLE_CLOUD_PRIVATE_KEY: data.private_key
  }, null, 2));
  console.log('━'.repeat(80));

  console.log('\n✅ Done! Follow the instructions above to add these to Vercel.');
  console.log('\n📚 For detailed step-by-step guide, see: docs/VERCEL_ENV_SETUP.md\n');

} catch (error) {
  console.error('❌ Error reading google-cloud-key.json:', error.message);
  process.exit(1);
}
