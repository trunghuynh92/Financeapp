/**
 * API Route: /api/business-partners
 * List and create business partners
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { CreateBusinessPartnerInput } from '@/types/business-partner'

// ==============================================================================
// GET - List business partners for an entity
// ==============================================================================

export async function GET(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()
    const searchParams = request.nextUrl.searchParams
    const entityId = searchParams.get('entity_id')
    const partnerType = searchParams.get('partner_type')
    const isActive = searchParams.get('is_active')

    let query = supabase
      .from('business_partners')
      .select('*')
      .order('partner_name', { ascending: true })

    if (entityId) {
      query = query.eq('entity_id', entityId)
    }

    if (partnerType && partnerType !== 'all') {
      query = query.eq('partner_type', partnerType)
    }

    if (isActive !== null && isActive !== undefined) {
      query = query.eq('is_active', isActive === 'true')
    }

    const { data: partners, error } = await query

    if (error) {
      console.error('Error fetching business partners:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: partners,
      count: partners?.length || 0,
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch business partners',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// POST - Create a new business partner
// ==============================================================================

export async function POST(request: NextRequest) {
  try {
    const supabase = createSupabaseServerClient()

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body: CreateBusinessPartnerInput = await request.json()

    // Validation
    if (!body.entity_id || !body.partner_name || !body.partner_type) {
      return NextResponse.json(
        { error: 'Missing required fields: entity_id, partner_name, partner_type' },
        { status: 400 }
      )
    }

    // Create business partner
    const { data: partner, error: insertError } = await supabase
      .from('business_partners')
      .insert([{
        entity_id: body.entity_id,
        partner_type: body.partner_type,
        partner_name: body.partner_name,
        legal_name: body.legal_name || null,
        display_name: body.display_name || null,
        tax_id: body.tax_id || null,
        registration_number: body.registration_number || null,
        contact_person: body.contact_person || null,
        email: body.email || null,
        phone: body.phone || null,
        mobile: body.mobile || null,
        website: body.website || null,
        address_line1: body.address_line1 || null,
        address_line2: body.address_line2 || null,
        city: body.city || null,
        state_province: body.state_province || null,
        postal_code: body.postal_code || null,
        country: body.country || null,
        bank_account_number: body.bank_account_number || null,
        bank_name: body.bank_name || null,
        bank_branch: body.bank_branch || null,
        bank_swift_code: body.bank_swift_code || null,
        notes: body.notes || null,
        tags: body.tags || null,
        created_by_user_id: user.id,
      }])
      .select()
      .single()

    if (insertError) {
      console.error('Error creating business partner:', insertError)
      return NextResponse.json(
        { error: insertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: partner,
      message: 'Business partner created successfully',
    }, { status: 201 })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to create business partner',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
