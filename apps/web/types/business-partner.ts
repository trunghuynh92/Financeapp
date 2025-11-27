/**
 * Type definitions for Business Partners
 * Centralized contact management for all business relationships
 */

export type PartnerType = 'customer' | 'vendor' | 'employee' | 'owner' | 'partner' | 'lender' | 'other'

export interface BusinessPartner {
  partner_id: number
  entity_id: string

  // Classification
  partner_type: PartnerType

  // Basic information
  partner_name: string
  legal_name: string | null
  display_name: string | null

  // Identification
  tax_id: string | null
  registration_number: string | null

  // Contact information
  contact_person: string | null
  email: string | null
  phone: string | null
  mobile: string | null
  website: string | null

  // Address
  address_line1: string | null
  address_line2: string | null
  city: string | null
  state_province: string | null
  postal_code: string | null
  country: string | null

  // Banking information
  bank_account_number: string | null
  bank_name: string | null
  bank_branch: string | null
  bank_swift_code: string | null

  // Additional details
  notes: string | null
  tags: string[] | null

  // Status
  is_active: boolean

  // Audit fields
  created_at: string
  updated_at: string
  created_by_user_id: string | null
}

export interface BusinessPartnerWithEntity extends BusinessPartner {
  entity: {
    id: string
    name: string
    type: string
  }
}

export interface CreateBusinessPartnerInput {
  entity_id: string
  partner_type: PartnerType
  partner_name: string
  legal_name?: string | null
  display_name?: string | null
  tax_id?: string | null
  registration_number?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  website?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state_province?: string | null
  postal_code?: string | null
  country?: string | null
  bank_account_number?: string | null
  bank_name?: string | null
  bank_branch?: string | null
  bank_swift_code?: string | null
  notes?: string | null
  tags?: string[] | null
}

export interface UpdateBusinessPartnerInput {
  partner_name?: string
  legal_name?: string | null
  display_name?: string | null
  partner_type?: PartnerType
  tax_id?: string | null
  registration_number?: string | null
  contact_person?: string | null
  email?: string | null
  phone?: string | null
  mobile?: string | null
  website?: string | null
  address_line1?: string | null
  address_line2?: string | null
  city?: string | null
  state_province?: string | null
  postal_code?: string | null
  country?: string | null
  bank_account_number?: string | null
  bank_name?: string | null
  bank_branch?: string | null
  bank_swift_code?: string | null
  notes?: string | null
  tags?: string[] | null
  is_active?: boolean
}

// Display configuration
export const PARTNER_TYPE_LABELS: Record<PartnerType, string> = {
  customer: 'Customer',
  vendor: 'Vendor',
  employee: 'Employee',
  owner: 'Owner',
  partner: 'Partner',
  lender: 'Lender',
  other: 'Other',
}

export const PARTNER_TYPE_COLORS: Record<PartnerType, string> = {
  customer: 'bg-blue-100 text-blue-800',
  vendor: 'bg-purple-100 text-purple-800',
  employee: 'bg-green-100 text-green-800',
  owner: 'bg-orange-100 text-orange-800',
  partner: 'bg-teal-100 text-teal-800',
  lender: 'bg-red-100 text-red-800',
  other: 'bg-gray-100 text-gray-800',
}

// Helper function to get display name
export function getPartnerDisplayName(partner: BusinessPartner): string {
  return partner.display_name || partner.partner_name
}

// Helper function to format address
export function formatAddress(partner: BusinessPartner): string | null {
  const parts = [
    partner.address_line1,
    partner.address_line2,
    partner.city,
    partner.state_province,
    partner.postal_code,
    partner.country,
  ].filter(Boolean)

  return parts.length > 0 ? parts.join(', ') : null
}
