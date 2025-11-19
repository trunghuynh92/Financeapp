/**
 * Migration 060: Fix Debt Payback Delete - Clear Bidirectional Match
 *
 * NOTE: This migration needs to be run manually in the Supabase SQL Editor
 * because it contains complex DDL statements that cannot be executed via the Supabase client API.
 *
 * To run this migration:
 * 1. Open your Supabase project dashboard
 * 2. Go to SQL Editor
 * 3. Copy the contents of database/migrations/060_fix_debt_payback_delete.sql
 * 4. Paste and execute in the SQL Editor
 *
 * Or use psql:
 * psql [YOUR_DATABASE_URL] < database/migrations/060_fix_debt_payback_delete.sql
 */

import * as fs from 'fs'
import * as path from 'path'

console.log('╔════════════════════════════════════════════════════════════════════╗')
console.log('║  Migration 060: Fix Debt Payback Delete                           ║')
console.log('╚════════════════════════════════════════════════════════════════════╝')
console.log('')
console.log('This migration must be run manually in the Supabase SQL Editor.')
console.log('')
console.log('Steps:')
console.log('1. Open your Supabase project dashboard')
console.log('2. Navigate to SQL Editor')
console.log('3. Copy the migration SQL from:')
console.log('   database/migrations/060_fix_debt_payback_delete.sql')
console.log('4. Paste and execute in the SQL Editor')
console.log('')
console.log('Migration creates:')
console.log('- clear_match_on_delete() function')
console.log('- trigger_clear_match_on_delete trigger')
console.log('')
console.log('This fixes the bug where:')
console.log('- Deleting DEBT_PAY transaction leaves DEBT_SETTLE matched to non-existent transaction')
console.log('- Drawdown balance and status do not update correctly')
console.log('')
console.log('After this migration:')
console.log('- When DEBT_PAY is deleted, DEBT_SETTLE is automatically unmatched')
console.log('- Existing trigger recalculates drawdown balance and status')
console.log('- Works for all transaction pairs (TRF_OUT/IN, DEBT_DRAW/ACQ, DEBT_PAY/SETTLE)')
console.log('')

// Print the file path for easy access
const migrationPath = path.join(__dirname, '../database/migrations/060_fix_debt_payback_delete.sql')
console.log(`Migration file location:`)
console.log(migrationPath)
console.log('')

// Read and display the SQL
const sql = fs.readFileSync(migrationPath, 'utf8')
console.log('════════════════════════════════════════════════════════════════════')
console.log('SQL TO EXECUTE:')
console.log('════════════════════════════════════════════════════════════════════')
console.log('')
console.log(sql)
console.log('')
console.log('════════════════════════════════════════════════════════════════════')
