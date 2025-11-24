import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CreateContractRequest, ContractOverview, ContractSummary } from '@/types/contract'

// GET /api/contracts - List all contracts with optional filters
export async function GET(request: NextRequest) {
  const supabase = createSupabaseServerClient()
  const searchParams = request.nextUrl.searchParams

  // Get query parameters
  const entityId = searchParams.get('entity_id')
  const contractType = searchParams.get('contract_type')
  const status = searchParams.get('status')
  const counterparty = searchParams.get('counterparty')
  const activeOnly = searchParams.get('active_only') === 'true'
  const includeSummary = searchParams.get('include_summary') === 'true'

  if (!entityId) {
    return NextResponse.json(
      { error: 'entity_id is required' },
      { status: 400 }
    )
  }

  try {
    // Build query for contract overview
    let query = supabase
      .from('contract_overview')
      .select('*')
      .eq('entity_id', entityId)
      .order('created_at', { ascending: false })

    // Apply filters
    if (contractType) {
      query = query.eq('contract_type', contractType)
    }
    if (status) {
      query = query.eq('status', status)
    }
    if (counterparty) {
      query = query.ilike('counterparty', `%${counterparty}%`)
    }
    if (activeOnly) {
      query = query.eq('is_active', true).eq('status', 'active')
    }

    const { data: contracts, error: contractsError } = await query

    if (contractsError) {
      console.error('Error fetching contracts:', contractsError)
      return NextResponse.json(
        { error: 'Failed to fetch contracts', details: contractsError.message },
        { status: 500 }
      )
    }

    // Calculate summary if requested
    let summary: ContractSummary | null = null
    if (includeSummary && contracts) {
      const activeContracts = contracts.filter(c => c.is_active && c.status === 'active')
      const expiringSoon = contracts.filter(c =>
        c.derived_status === 'expiring_soon' && c.is_active
      )
      const expired = contracts.filter(c =>
        (c.status === 'expired' || c.derived_status === 'expired') && c.is_active
      )

      summary = {
        total_contracts: contracts.length,
        active_contracts: activeContracts.length,
        expiring_soon_count: expiringSoon.length,
        expired_count: expired.length,
        total_monthly_obligation: activeContracts.reduce(
          (sum, c) => sum + parseFloat(c.total_monthly_obligation.toString()),
          0
        ),
        contracts_with_amendments: contracts.filter(c => c.amendments_count > 0).length,
        pending_amendments_count: 0  // Would need separate query
      }
    }

    return NextResponse.json({
      data: contracts as ContractOverview[],
      summary,
      count: contracts?.length || 0
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST /api/contracts - Create new contract
export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient()

  try {
    const body: CreateContractRequest = await request.json()

    // Validation
    if (!body.entity_id || !body.contract_number || !body.contract_name) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_id, contract_number, contract_name' },
        { status: 400 }
      )
    }

    if (!body.counterparty) {
      return NextResponse.json(
        { error: 'counterparty is required' },
        { status: 400 }
      )
    }

    if (!body.effective_date) {
      return NextResponse.json(
        { error: 'effective_date is required' },
        { status: 400 }
      )
    }

    // Validate date range
    if (body.expiration_date && new Date(body.expiration_date) < new Date(body.effective_date)) {
      return NextResponse.json(
        { error: 'expiration_date must be after effective_date' },
        { status: 400 }
      )
    }

    // Check for duplicate contract number
    const { data: existing } = await supabase
      .from('contracts')
      .select('contract_id')
      .eq('entity_id', body.entity_id)
      .eq('contract_number', body.contract_number)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: `Contract number ${body.contract_number} already exists for this entity` },
        { status: 409 }
      )
    }

    // Insert contract
    const { data: contract, error: insertError } = await supabase
      .from('contracts')
      .insert([{
        entity_id: body.entity_id,
        contract_number: body.contract_number,
        contract_name: body.contract_name,
        contract_type: body.contract_type,
        counterparty: body.counterparty,
        counterparty_contact: body.counterparty_contact || null,
        counterparty_address: body.counterparty_address || null,
        signing_date: body.signing_date || null,
        effective_date: body.effective_date,
        expiration_date: body.expiration_date || null,
        total_contract_value: body.total_contract_value || null,
        payment_terms: body.payment_terms || null,
        renewal_terms: body.renewal_terms || null,
        termination_terms: body.termination_terms || null,
        special_terms: body.special_terms || null,
        status: body.status || 'draft',
        document_url: body.document_url || null,
        notes: body.notes || null,
        is_active: true
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating contract:', insertError)
      return NextResponse.json(
        { error: 'Failed to create contract', details: insertError.message },
        { status: 500 }
      )
    }

    // Fetch the created contract with overview data
    const { data: overview, error: overviewError } = await supabase
      .from('contract_overview')
      .select('*')
      .eq('contract_id', contract.contract_id)
      .single()

    if (overviewError) {
      // Return the basic data if overview fetch fails
      return NextResponse.json({
        data: contract,
        message: 'Contract created successfully'
      }, { status: 201 })
    }

    return NextResponse.json({
      data: overview,
      message: 'Contract created successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
