import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'

export async function GET(request: Request) {
  try {
    const requestUrl = new URL(request.url)
    const code = requestUrl.searchParams.get('code')
    const origin = requestUrl.origin

    console.error('=== OAUTH CALLBACK START ===')
    console.error('Code present:', !!code)
    console.error('Full URL:', requestUrl.toString())

    if (!code) {
      console.log('No code found, redirecting to signin')
      return NextResponse.redirect(`${origin}/signin`)
    }

    const cookieStore = await cookies()
    const response = NextResponse.redirect(`${origin}/dashboard`)

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options) {
            try {
              cookieStore.set({ name, value, ...options })
              response.cookies.set({ name, value, ...options })
            } catch (err) {
              // Ignore cookie errors during streaming
            }
          },
          remove(name: string, options) {
            try {
              cookieStore.set({ name, value: '', ...options })
              response.cookies.set({ name, value: '', ...options })
            } catch (err) {
              // Ignore cookie errors during streaming
            }
          },
        },
      }
    )

    console.log('Exchanging code for session...')
    const { data, error } = await supabase.auth.exchangeCodeForSession(code)

    if (error) {
      console.error('Exchange error:', error)
      return NextResponse.redirect(`${origin}/signin?error=${encodeURIComponent(error.message)}`)
    }

    if (data.session) {
      console.log('✅ SUCCESS! User:', data.user?.email)
      console.log('Session created:', !!data.session)
      return response
    }

    console.log('❌ No session in response')
    return NextResponse.redirect(`${origin}/signin`)
  } catch (err) {
    console.error('=== CALLBACK ERROR ===', err)
    return NextResponse.redirect(`${request.url.split('/auth')[0]}/signin`)
  }
}
