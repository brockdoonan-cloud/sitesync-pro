import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function rateLimit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }

  if (entry.count >= limit) return false
  entry.count++
  return true
}

function rateLimitResponse() {
  return NextResponse.json(
    { error: 'Too many requests. Please try again in a minute.' },
    { status: 429, headers: { 'Retry-After': '60' } }
  )
}

export async function proxy(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const path = request.nextUrl.pathname

  if ((path.startsWith('/api/auth/') || path.startsWith('/auth/')) && request.method === 'POST' && !rateLimit(`auth:${ip}`, 5, 60_000)) {
    return rateLimitResponse()
  }

  if (path.startsWith('/api/customer/') && !rateLimit(`customer:${ip}`, 30, 60_000)) {
    return rateLimitResponse()
  }

  if (path.startsWith('/api/operator/') && !rateLimit(`operator:${ip}`, 120, 60_000)) {
    return rateLimitResponse()
  }

  if (path.startsWith('/api/') && !rateLimit(`api:${ip}`, 60, 60_000)) {
    return rateLimitResponse()
  }

  const ua = request.headers.get('user-agent') || ''
  const botPat = /curl|wget|python-requests|go-http|bot(?!.*chrome)|spider|crawl/i
  if (botPat.test(ua) && (path.startsWith('/auth/') || path === '/dashboard' || path.startsWith('/dashboard/'))) {
    return new NextResponse('Forbidden', { status: 403 })
  }

  let supabaseResponse = NextResponse.next({ request })

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    if (path.startsWith('/dashboard')) {
      const url = request.nextUrl.clone()
      url.pathname = '/auth/login'
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: { name: string; value: string; options?: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) => supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone()
    url.pathname = '/auth/login'
    return NextResponse.redirect(url)
  }

  if (user && request.nextUrl.pathname.startsWith('/auth') && !request.nextUrl.pathname.includes('/callback')) {
    const url = request.nextUrl.clone()
    const portalPreference = request.nextUrl.searchParams.get('portal') || request.cookies.get('sitesync-portal-mode')?.value
    url.pathname = portalPreference === 'customer' ? '/dashboard/customer' : '/dashboard'
    url.search = ''
    return NextResponse.redirect(url)
  }

  return supabaseResponse
}

export const config = { matcher: ['/dashboard/:path*', '/auth/:path*', '/api/:path*'] }
