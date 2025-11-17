import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'

// POST /api/contracts/[id]/amendments/[amendmentId]/revert - Revert amendment from instances
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string; amendmentId: string } }
) {
  const supabase = createSupabaseServerClient()
  const amendmentId = parseInt(params.amendmentId)

  if (isNaN(amendmentId)) {
    return NextResponse.json(
      { error: 'Invalid amendment ID' },
      { status: 400 }
    )
  }

  try {
    // Verify amendment exists
    const { data: amendment, error: amendmentError } = await supabase
      .from('contract_amendments')
      .select('*')
      .eq('amendment_id', amendmentId)
      .single()

    if (!amendment) {
      return NextResponse.json(
        { error: 'Amendment not found' },
        { status: 404 }
      )
    }

    // Revert amendment using database function
    const { data: result, error: revertError } = await supabase
      .rpc('revert_amendment_from_instances', { p_amendment_id: amendmentId })

    if (revertError) {
      console.error('Error reverting amendment:', revertError)
      return NextResponse.json(
        { error: 'Failed to revert amendment', details: revertError.message },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: 'Amendment reverted successfully',
      data: {
        instances_reverted: result
      }
    })

  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
