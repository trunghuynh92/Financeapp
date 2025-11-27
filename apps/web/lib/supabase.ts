import { createClient } from '@supabase/supabase-js'
import { createBrowserClient } from '@supabase/ssr'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Legacy client for backward compatibility (no auth)
export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// Client-side auth-aware client
export function createSupabaseClient() {
  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}

export type Entity = {
  id: string // UUID
  name: string
  type: 'company' | 'personal'
  description: string | null
  created_at: string
  updated_at: string
  owner_user_id?: string | null // UUID
}

export type UserRole = 'owner' | 'admin' | 'editor' | 'viewer'

export type User = {
  id: string
  email: string
  full_name: string | null
  avatar_url: string | null
  created_at: string
  updated_at: string
}

export type EntityUser = {
  id: number
  entity_id: number
  user_id: string
  role: UserRole
  created_at: string
  created_by_user_id: string | null
}

export type EntityWithRole = Entity & {
  user_role: UserRole
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
