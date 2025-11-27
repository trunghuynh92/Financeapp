/**
 * API Route: /api/business-partners/[id]
 * Get, update, or delete a specific business partner
 */

import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { UpdateBusinessPartnerInput } from '@/types/business-partner'

// ==============================================================================
// GET - Get business partner details
// ==============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const partnerId = parseInt(params.id, 10)

    if (isNaN(partnerId)) {
      return NextResponse.json(
        { error: 'Invalid business partner ID' },
        { status: 400 }
      )
    }

    const { data: partner, error } = await supabase
      .from('business_partners')
      .select('*')
      .eq('partner_id', partnerId)
      .single()

    if (error || !partner) {
      return NextResponse.json(
        { error: 'Business partner not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ data: partner })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch business partner',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// PATCH - Update business partner
// ==============================================================================

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const partnerId = parseInt(params.id, 10)

    if (isNaN(partnerId)) {
      return NextResponse.json(
        { error: 'Invalid business partner ID' },
        { status: 400 }
      )
    }

    const body: UpdateBusinessPartnerInput = await request.json()

    // Verify partner exists
    const { data: existingPartner, error: fetchError } = await supabase
      .from('business_partners')
      .select('partner_id')
      .eq('partner_id', partnerId)
      .single()

    if (fetchError || !existingPartner) {
      return NextResponse.json(
        { error: 'Business partner not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateData: any = {}
    if (body.partner_name !== undefined) updateData.partner_name = body.partner_name
    if (body.legal_name !== undefined) updateData.legal_name = body.legal_name
    if (body.display_name !== undefined) updateData.display_name = body.display_name
    if (body.partner_type !== undefined) updateData.partner_type = body.partner_type
    if (body.tax_id !== undefined) updateData.tax_id = body.tax_id
    if (body.registration_number !== undefined) updateData.registration_number = body.registration_number
    if (body.contact_person !== undefined) updateData.contact_person = body.contact_person
    if (body.email !== undefined) updateData.email = body.email
    if (body.phone !== undefined) updateData.phone = body.phone
    if (body.mobile !== undefined) updateData.mobile = body.mobile
    if (body.website !== undefined) updateData.website = body.website
    if (body.address_line1 !== undefined) updateData.address_line1 = body.address_line1
    if (body.address_line2 !== undefined) updateData.address_line2 = body.address_line2
    if (body.city !== undefined) updateData.city = body.city
    if (body.state_province !== undefined) updateData.state_province = body.state_province
    if (body.postal_code !== undefined) updateData.postal_code = body.postal_code
    if (body.country !== undefined) updateData.country = body.country
    if (body.bank_account_number !== undefined) updateData.bank_account_number = body.bank_account_number
    if (body.bank_name !== undefined) updateData.bank_name = body.bank_name
    if (body.bank_branch !== undefined) updateData.bank_branch = body.bank_branch
    if (body.bank_swift_code !== undefined) updateData.bank_swift_code = body.bank_swift_code
    if (body.notes !== undefined) updateData.notes = body.notes
    if (body.tags !== undefined) updateData.tags = body.tags
    if (body.is_active !== undefined) updateData.is_active = body.is_active

    // Update partner
    const { data: updatedPartner, error: updateError } = await supabase
      .from('business_partners')
      .update(updateData)
      .eq('partner_id', partnerId)
      .select()
      .single()

    if (updateError) {
      console.error('Error updating business partner:', updateError)
      return NextResponse.json(
        { error: updateError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      data: updatedPartner,
      message: 'Business partner updated successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update business partner',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

// ==============================================================================
// DELETE - Delete business partner
// ==============================================================================

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = createSupabaseServerClient()
    const partnerId = parseInt(params.id, 10)

    if (isNaN(partnerId)) {
      return NextResponse.json(
        { error: 'Invalid business partner ID' },
        { status: 400 }
      )
    }

    // Check if partner is referenced by any loans
    const { count: loansCount } = await supabase
      .from('loan_disbursement')
      .select('*', { count: 'exact', head: true })
      .eq('partner_id', partnerId)

    if (loansCount && loansCount > 0) {
      return NextResponse.json(
        {
          error: 'Cannot delete business partner with existing loans',
          message: `This partner has ${loansCount} loan(s). Please reassign or delete the loans first.`,
          loans_count: loansCount,
        },
        { status: 400 }
      )
    }

    // Delete partner
    const { error: deleteError } = await supabase
      .from('business_partners')
      .delete()
      .eq('partner_id', partnerId)

    if (deleteError) {
      console.error('Error deleting business partner:', deleteError)
      return NextResponse.json(
        { error: deleteError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Business partner deleted successfully',
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      {
        error: 'Failed to delete business partner',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
