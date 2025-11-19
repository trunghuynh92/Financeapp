#!/usr/bin/env tsx
/**
 * Script to apply migration 054 - Fix loan balance trigger
 * This updates the trigger to use LOAN_COLLECT instead of the deleted LOAN_SETTLE type
 */

import { readFileSync } from 'fs'
import { join } from 'path'

console.log('='.repeat(80))
console.log('Migration 054: Fix Loan Balance Trigger')
console.log('='.repeat(80))
console.log()
console.log('This migration fixes the loan disbursement balance update trigger.')
console.log('The trigger was looking for LOAN_SETTLE transactions which were deleted')
console.log('in migration 042. It now correctly uses LOAN_COLLECT transactions.')
console.log()
console.log('To apply this migration:')
console.log('1. Go to your Supabase Dashboard')
console.log('2. Navigate to: SQL Editor')
console.log('3. Copy and paste the SQL below')
console.log('4. Click "Run"')
console.log()
console.log('='.repeat(80))
console.log()

// Read and display the migration SQL
const migrationPath = join(process.cwd(), 'database/migrations/054_fix_loan_balance_trigger.sql')
const sql = readFileSync(migrationPath, 'utf-8')

console.log(sql)
console.log()
console.log('='.repeat(80))
