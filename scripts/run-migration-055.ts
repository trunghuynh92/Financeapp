#!/usr/bin/env tsx
/**
 * Script to apply migration 055 - Add Interest Payment Category
 * This adds template categories for interest payments
 */

import { readFileSync } from 'fs'
import { join } from 'path'

console.log('='.repeat(80))
console.log('Migration 055: Add Interest Payment Category')
console.log('='.repeat(80))
console.log()
console.log('This migration adds Interest Payment as a template category.')
console.log('It will be available for both business and personal entities.')
console.log()
console.log('Note: Interest Income (INTEREST_INC) already exists in the system.')
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
const migrationPath = join(process.cwd(), 'database/migrations/055_add_interest_payment_category.sql')
const sql = readFileSync(migrationPath, 'utf-8')

console.log(sql)
console.log()
console.log('='.repeat(80))
