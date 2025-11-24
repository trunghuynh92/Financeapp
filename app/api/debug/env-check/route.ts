/**
 * Debug endpoint to check environment variables on Vercel
 * DELETE THIS FILE after debugging!
 */

import { NextResponse } from 'next/server'

export async function GET() {
  const envCheck = {
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY ? 'SET (length: ' + process.env.ANTHROPIC_API_KEY.length + ')' : 'NOT SET',
    GOOGLE_CLOUD_PROJECT_ID: process.env.GOOGLE_CLOUD_PROJECT_ID || 'NOT SET',
    GOOGLE_CLOUD_CLIENT_EMAIL: process.env.GOOGLE_CLOUD_CLIENT_EMAIL || 'NOT SET',
    GOOGLE_CLOUD_PRIVATE_KEY: process.env.GOOGLE_CLOUD_PRIVATE_KEY
      ? {
          length: process.env.GOOGLE_CLOUD_PRIVATE_KEY.length,
          starts_with: process.env.GOOGLE_CLOUD_PRIVATE_KEY.substring(0, 30),
          ends_with: process.env.GOOGLE_CLOUD_PRIVATE_KEY.substring(process.env.GOOGLE_CLOUD_PRIVATE_KEY.length - 30),
          has_literal_backslash_n: process.env.GOOGLE_CLOUD_PRIVATE_KEY.includes('\\n'),
          has_actual_newlines: process.env.GOOGLE_CLOUD_PRIVATE_KEY.includes('\n'),
        }
      : 'NOT SET',
  }

  return NextResponse.json({
    environment: process.env.VERCEL_ENV || 'local',
    checks: envCheck,
  })
}
