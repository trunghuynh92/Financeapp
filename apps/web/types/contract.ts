// Contract and Amendment Types
// Corresponds to database/migrations/060_create_contracts_and_amendments.sql

// ==============================================================================
// Enums
// ==============================================================================

export type ContractType =
  | 'lease'
  | 'service'
  | 'construction'
  | 'subscription'
  | 'purchase'
  | 'supply'
  | 'other'

export type ContractStatus =
  | 'draft'
  | 'pending_signature'
  | 'active'
  | 'expired'
  | 'terminated'
  | 'renewed'

export type AmendmentType =
  | 'amount_change'
  | 'payment_schedule_change'
  | 'term_extension'
  | 'term_reduction'
  | 'scope_change'
  | 'party_change'
  | 'other'

export type AmendmentStatus =
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'superseded'

export type ImpactDirection = 'increase' | 'decrease' | 'neutral'

export type PaymentType =
  | 'primary'
  | 'rent'
  | 'service_charge'
  | 'utilities'
  | 'parking'
  | 'deposit'
  | 'milestone'
  | 'retainer'
  | 'subscription'
  | 'other'

// ==============================================================================
// Contract Interfaces
// ==============================================================================

export interface Contract {
  contract_id: number
  entity_id: string

  // Identification
  contract_number: string
  contract_name: string
  contract_type: ContractType

  // Parties
  counterparty: string
  counterparty_contact: string | null
  counterparty_address: string | null

  // Contract Terms
  signing_date: string | null  // ISO date string
  effective_date: string       // ISO date string
  expiration_date: string | null  // ISO date string

  // Financial
  total_contract_value: number | null

  // Terms & Conditions
  payment_terms: string | null
  renewal_terms: string | null
  termination_terms: string | null
  special_terms: string | null

  // Status
  status: ContractStatus

  // Renewal Tracking
  renewed_from_contract_id: number | null
  renewal_count: number

  // Documentation
  document_url: string | null
  attachments: any | null  // JSONB

  // Notes
  notes: string | null

  // Metadata
  is_active: boolean
  created_at: string  // ISO timestamp
  updated_at: string  // ISO timestamp
  created_by: string | null
}

export interface ContractAmendment {
  amendment_id: number
  contract_id: number

  // Identification
  amendment_number: number
  amendment_date: string  // ISO date string

  // Effective Period
  effective_start_date: string  // ISO date string
  effective_end_date: string | null  // ISO date string

  // Amendment Details
  amendment_type: AmendmentType

  // New Values
  new_payment_amount: number | null
  new_frequency: string | null
  new_expiration_date: string | null  // ISO date string

  // Description
  title: string
  description: string
  reason: string | null

  // Financial Impact
  estimated_impact: number | null
  impact_direction: ImpactDirection | null

  // Documentation
  amendment_document_url: string | null

  // Approval
  status: AmendmentStatus
  approved_by: string | null
  approved_at: string | null  // ISO timestamp
  rejection_reason: string | null

  // Metadata
  created_at: string  // ISO timestamp
  updated_at: string  // ISO timestamp
  created_by: string | null
}

// ==============================================================================
// View Interfaces
// ==============================================================================

export interface ContractOverview extends Contract {
  payment_schedules_count: number
  total_monthly_obligation: number
  amendments_count: number
  active_amendments_count: number
  days_until_expiration: number | null
  derived_status: ContractStatus | 'expiring_soon'
}

export interface AmendmentHistory extends ContractAmendment {
  contract_name: string
  contract_number: string
  affected_instances_count: number
  total_financial_impact: number
}

// ==============================================================================
// Request/Response Types
// ==============================================================================

export interface CreateContractRequest {
  entity_id: string
  contract_number: string
  contract_name: string
  contract_type: ContractType
  counterparty: string
  counterparty_contact?: string
  counterparty_address?: string
  signing_date?: string
  effective_date: string
  expiration_date?: string
  total_contract_value?: number
  payment_terms?: string
  renewal_terms?: string
  termination_terms?: string
  special_terms?: string
  status?: ContractStatus
  document_url?: string
  notes?: string
}

export interface UpdateContractRequest {
  contract_number?: string
  contract_name?: string
  contract_type?: ContractType
  counterparty?: string
  counterparty_contact?: string
  counterparty_address?: string
  signing_date?: string
  effective_date?: string
  expiration_date?: string
  total_contract_value?: number
  payment_terms?: string
  renewal_terms?: string
  termination_terms?: string
  special_terms?: string
  status?: ContractStatus
  document_url?: string
  notes?: string
}

export interface CreateAmendmentRequest {
  contract_id: number
  amendment_number?: number  // Auto-generated if not provided
  amendment_date?: string    // Defaults to today
  effective_start_date: string
  effective_end_date?: string
  amendment_type: AmendmentType

  // New values (depending on type)
  new_payment_amount?: number
  new_frequency?: string
  new_expiration_date?: string

  // Description
  title: string
  description: string
  reason?: string

  // Financial impact
  estimated_impact?: number
  impact_direction?: ImpactDirection

  // Documentation
  amendment_document_url?: string

  // Status
  status?: AmendmentStatus

  // Auto-apply to instances
  auto_apply?: boolean  // If true, automatically update instances
}

export interface UpdateAmendmentRequest {
  amendment_date?: string
  effective_start_date?: string
  effective_end_date?: string
  amendment_type?: AmendmentType
  new_payment_amount?: number
  new_frequency?: string
  new_expiration_date?: string
  title?: string
  description?: string
  reason?: string
  estimated_impact?: number
  impact_direction?: ImpactDirection
  amendment_document_url?: string
  status?: AmendmentStatus
}

export interface ApplyAmendmentResponse {
  instances_updated: number
  old_total: number
  new_total: number
}

export interface RevertAmendmentResponse {
  instances_reverted: number
}

// ==============================================================================
// Summary Types
// ==============================================================================

export interface ContractSummary {
  total_contracts: number
  active_contracts: number
  expiring_soon_count: number  // Within 30 days
  expired_count: number
  total_monthly_obligation: number
  contracts_with_amendments: number
  pending_amendments_count: number
}

export interface AmendmentImpactPreview {
  affected_schedules: number
  affected_instances: number
  current_total: number
  new_total: number
  total_impact: number
  impact_direction: ImpactDirection
  instances_preview: Array<{
    instance_id: number
    due_date: string
    current_amount: number
    new_amount: number
    difference: number
  }>
}
