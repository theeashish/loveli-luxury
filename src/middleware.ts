import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from './lib/env'
import { getDefaultSponsorCode } from './lib/distributors/default-sponsor'
import type { Database } from './types/database'

type CookieToSet = { name: string; value: string; options: CookieOptions }

const SPONSOR_COOKIE = 'll_sponsor'
const SPONSOR_COOKIE_MAX_AGE = 60 * 60 * 24 * 30 // 30 days
// Matches the shape produced by public.generate_sponsor_code() in the DB:
// LL-XX-XXXX. The DB alphabet excludes 0/O/1/I; we accept any A-Z + 2-9 here.
const SPONSOR_CODE_RE = /^LL-[A-Z2-9]{2}-[A-Z2-9]{4}$/

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

  // Sponsor capture: first-touch attribution. If `?ref=LL-XX-XXXX` is in the
  // URL and the visitor has no sponsor cookie yet, persist it for 30 days.
  // Existing cookies are NOT overwritten — once attributed, always attributed.
  //
  // Two subtle correctness invariants this block must preserve, because we
  // discovered both as live bugs (caught by tests/e2e/smoke.spec.ts):
  //
  // 1. The Supabase server client's setAll() below REBUILDS `response =
  //    NextResponse.next(...)` when refreshing the auth session. That wipes
  //    any cookies we set on the prior `response` object. So we also set the
  //    sponsor cookie on `request.cookies` here — `NextResponse.next({ request })`
  //    propagates from the request, so the rebuilt response still carries it.
  // 2. The default-sponsor block below checks `request.cookies` to decide
  //    whether to overwrite. Setting on `request.cookies` here makes the
  //    default-sponsor branch correctly treat the visitor as already
  //    attributed, so the referral wins.
  //
  // Before this fix, every visit with ?ref= was overwritten by the default
  // sponsor — meaning commissions routed to the wrong distributor.
  const ref = request.nextUrl.searchParams.get('ref')
  if (ref && SPONSOR_CODE_RE.test(ref) && !request.cookies.get(SPONSOR_COOKIE)) {
    request.cookies.set(SPONSOR_COOKIE, ref)
    response = NextResponse.next({ request })
    response.cookies.set(SPONSOR_COOKIE, ref, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SPONSOR_COOKIE_MAX_AGE,
    })
  }

  const supabase = createServerClient<Database>(
    publicEnv.NEXT_PUBLIC_SUPABASE_URL,
    publicEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          )
        },
      },
    },
  )

  // IMPORTANT: refreshes auth session, do not remove
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname

  // Default-sponsor attribution: every visitor without a sponsor cookie
  // (and not arriving via ?ref= — handled above) gets credited to the
  // founding distributor. Skip admin and API routes — they don't need
  // attribution and we want to keep them light.
  //
  // The founder is auto-discovered via public.default_sponsor_code()
  // (migration 021). Returns null in the pre-bootstrap state, in which
  // case we leave the cookie unset and the orphan-allowed transitional
  // behaviour kicks in.
  const isPublicSurface =
    !path.startsWith('/admin') &&
    !path.startsWith('/api') &&
    !path.startsWith('/_next')
  if (isPublicSurface && !request.cookies.get(SPONSOR_COOKIE)) {
    const defaultCode = await getDefaultSponsorCode(supabase)
    if (defaultCode) {
      request.cookies.set(SPONSOR_COOKIE, defaultCode)
      response = NextResponse.next({ request })
      response.cookies.set(SPONSOR_COOKIE, defaultCode, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: SPONSOR_COOKIE_MAX_AGE,
      })
    }
  }

  // Auth-required public routes — gate them in middleware rather than the
  // page so the redirect fires BEFORE any layout streams. Doing this in
  // a Server Component leaves the user staring at a half-rendered shell
  // while Chrome follows the 307.
  const AUTH_REQUIRED_PREFIXES = [
    '/partners/signup',
    '/account',
    '/checkout',
  ] as const
  const needsAuth = AUTH_REQUIRED_PREFIXES.some(
    (p) => path === p || path.startsWith(`${p}/`),
  )
  if (needsAuth && !user) {
    const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)
    return redirectTo(request, `/login?next=${next}`)
  }

  // Already signed in and hitting /login or /signup — skip the form.
  if ((path === '/login' || path === '/signup') && user) {
    const rawNext = request.nextUrl.searchParams.get('next') ?? ''
    const safe =
      rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : '/'
    return redirectTo(request, safe)
  }

  // Already a distributor and hitting /partners/signup — send them to
  // their portal before any layout streams (a page-level redirect leaves
  // the chrome flashing). RLS distributors_self_read lets the anon client
  // see their own row.
  if (path === '/partners/signup' && user) {
    const dist = await supabase
      .from('distributors')
      .select('id')
      .eq('user_id', user.id)
      .maybeSingle()
    if (dist.data) return redirectTo(request, '/account/partner')
  }

  // Gate /admin/* — only admin and superadmin may enter.
  if (path.startsWith('/admin')) {
    if (!user) {
      const next = encodeURIComponent(request.nextUrl.pathname + request.nextUrl.search)
      return redirectTo(request, `/login?next=${next}`)
    }

    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .is('revoked_at', null)
    const roles = (rolesData ?? []) as Array<{ role: Database['public']['Enums']['user_role'] }>
    const granted = new Set(roles.map((r) => r.role))
    if (!granted.has('admin') && !granted.has('superadmin')) {
      return redirectTo(request, '/?reason=forbidden')
    }
  }

  return response
}

function redirectTo(request: NextRequest, target: string): NextResponse {
  const url = request.nextUrl.clone()
  const qIdx = target.indexOf('?')
  if (qIdx === -1) {
    url.pathname = target
    url.search = ''
  } else {
    url.pathname = target.slice(0, qIdx)
    url.search = target.slice(qIdx)
  }
  return NextResponse.redirect(url)
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
}
