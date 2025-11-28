import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const locales = ['en', 'vi']
const defaultLocale = 'en'

function getLocaleFromRequest(request: NextRequest): string {
  // Check cookie first
  const localeCookie = request.cookies.get('NEXT_LOCALE')?.value
  if (localeCookie && locales.includes(localeCookie)) {
    return localeCookie
  }

  // Then check Accept-Language header
  const acceptLanguage = request.headers.get('accept-language')
  if (acceptLanguage) {
    const preferredLocale = acceptLanguage
      .split(',')
      .map((lang) => lang.split(';')[0].trim().substring(0, 2))
      .find((lang) => locales.includes(lang))

    if (preferredLocale) {
      return preferredLocale
    }
  }

  return defaultLocale
}

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Set locale cookie if not present
  const locale = getLocaleFromRequest(request)
  if (!request.cookies.get('NEXT_LOCALE')) {
    response.cookies.set('NEXT_LOCALE', locale, {
      path: '/',
      maxAge: 60 * 60 * 24 * 365, // 1 year
    })
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  // Public routes that don't require authentication
  // Note: /api/mobile routes handle their own JWT Bearer token auth
  const publicRoutes = ['/signin', '/signup', '/auth', '/api/mobile']
  const isPublicRoute = publicRoutes.some(route => request.nextUrl.pathname.startsWith(route))

  // Root path redirect logic
  if (request.nextUrl.pathname === '/') {
    if (user) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    } else {
      return NextResponse.redirect(new URL('/signin', request.url))
    }
  }

  // If user is not authenticated and trying to access protected route
  if (!user && !isPublicRoute) {
    return NextResponse.redirect(new URL('/signin', request.url))
  }

  // If user is authenticated and trying to access signin/signup, redirect to dashboard
  if (user && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
