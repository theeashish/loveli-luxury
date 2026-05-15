import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from './lib/env'
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
  const ref = request.nextUrl.searchParams.get('ref')
  if (ref && SPONSOR_CODE_RE.test(ref) && !request.cookies.get(SPONSOR_COOKIE)) {
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

  // Gate /admin/* — only admin and superadmin may enter.
  if (request.nextUrl.pathname.startsWith('/admin')) {
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
