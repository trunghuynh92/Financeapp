import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

export type Entity = {
  id: string
  name: string
  type: 'company' | 'personal'
  description: string | null
  created_at: string
  updated_at: string
}

// Re-export account types for convenience
export type {
  Account,
  AccountBalance,
  AccountWithBalance,
  AccountWithEntity,
  AccountType,
  Currency
} from '@/types/account'
