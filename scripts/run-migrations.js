const { Client } = require('pg');
const fs = require('fs');
const path = require('path');

// Get DATABASE_URL from environment or use hardcoded for this run
const databaseUrl = process.env.DATABASE_URL || 'postgresql://postgres.mflyrbzriksgjutlalkf:nocxih-kYpten-najxe1@aws-1-ap-southeast-1.pooler.supabase.com:5432/postgres';

const migrations = [
  '070_auto_delete_investment_on_unmatch.sql',
  '071_add_investment_balance_tracking.sql',
  '072_auto_update_investment_balance.sql',
];

async function runMigrations() {
  const client = new Client({ connectionString: databaseUrl });

  console.log('🚀 Investment System Migrations');
  console.log('='.repeat(60));

  try {
    await client.connect();
    console.log('✅ Connected to database\n');

    for (const file of migrations) {
      console.log(`📝 Running: ${file}`);
      const sql = fs.readFileSync(
        path.join(__dirname, '..', 'database', 'migrations', file),
        'utf-8'
      );

      await client.query(sql);
      console.log(`✅ ${file} completed\n`);
    }

    console.log('🎉 All migrations completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  } finally {
    await client.end();
  }
}

runMigrations();
