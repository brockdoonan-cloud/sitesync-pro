import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()
function rateLimit(ip: string, limit: number, windowMs: number): boolean {
  const now = Date.now(); const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) { rateLimitMap.set(ip, { count: 1, resetAt: now + windowMs }); return true }
  if (entry.count >= limit) return false; entry.count++; return true
}
export async function middleware(request: NextRequest) {
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown'
  const path = request.nextUrl.pathname
  if (path.startsWith('/auth/') && request.method === 'POST' && !rateLimit(ip, 10, 60_000))
    return new NextResponse('Too many requests.', { status: 429, headers: { 'Retry-After': '60' } })
  if (path.startsWith('/api/') && !rateLimit(ip, 60, 60_000))
    return NextResponse.json({ error: 'Rate limit exceeded' }, { status: 429 })
  const ua = request.headers.get('user-agent') || ''
  const botPat = /curl|wget|python-requests|go-http|bot(?!.*chrome)|spider|crawl/i
  if (botPat.test(ua) && (path.startsWith('/auth/') || path.startsWith('/dashboard/')))
    return new NextResponse('Forbidden', { status: 403 })
  let supabaseResponse = NextResponse.next({ request })
  const supabase = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!,process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,{cookies:{getAll(){return request.cookies.getAll()},setAll(cookiesToSet:{name:string;value:string;options?:CookieOptions}[]){cookiesToSet.forEach(({name,value})=>request.cookies.set(name,value));supabaseResponse=NextResponse.next({request});cookiesToSet.forEach(({name,value,options})=>supabaseResponse.cookies.set(name,value,options))}}})
  const { data: { user } } = await supabase.auth.getUser()
  if (!user && request.nextUrl.pathname.startsWith('/dashboard')) {
    const url = request.nextUrl.clone(); url.pathname = '/auth/login'; return NextResponse.redirect(url)
  }
  if (user && request.nextUrl.pathname.startsWith('/auth') && !request.nextUrl.pathname.includes('/callback')) {
    const url = request.nextUrl.clone(); url.pathname = '/dashboard'; return NextResponse.redirect(url)
  }
  return supabaseResponse
  }
export const config = { matcher: ['/dashboard/:path+', '/auth/:path+', '/api/:path*'] }
