import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { publicEnv } from './lib/env'
import type { Database } from './types/database'

type CookieToSet = { name: string; value: string; options: CookieOptions }

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({ request })

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
