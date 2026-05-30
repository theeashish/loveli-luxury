import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { LoginForm } from '@/components/auth/LoginForm'
import { safeNext } from '@/lib/auth/safe-next'

export const metadata = { title: 'Sign in', robots: { index: false } }
export const dynamic = 'force-dynamic'

/**
 * Pick the right audience-specific subtitle from the `next` value.
 * Heading and eyebrow stay constant for brand consistency.
 */
function subtitleFor(next: string): string {
  if (next.startsWith('/admin')) return 'Admin sign-in.'
  if (
    next.startsWith('/partners/signup') ||
    next.startsWith('/account/partner')
  ) {
    return 'Sign in to continue your partner registration.'
  }
  return 'Sign in to your account.'
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const next = safeNext(searchParams.next)
  if (session?.user) {
    // If they're already signed in, honour `next` when explicit, else
    // smart-route via /post-login.
    redirect(next || '/post-login')
  }

  const signupHref = next
    ? `/signup?next=${encodeURIComponent(next)}`
    : '/signup'

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50% 70% at 80% 30%, hsl(38 40% 60% / 0.12) 0%, transparent 60%), radial-gradient(40% 60% at 20% 80%, hsl(19 35% 45% / 0.10) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-7xl items-center justify-center px-6 py-16 lg:py-24">
        <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm md:p-12">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.35em] text-[hsl(var(--primary))]">
            Loveli Luxury
          </p>
          <h1 className="mt-5 text-center font-serif text-5xl italic tracking-tight md:text-6xl">
            Welcome Back
          </h1>
          <p className="mt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {subtitleFor(next)}
          </p>
          <div className="mt-10">
            <LoginForm next={next} />
          </div>
          <div className="mt-5 text-center">
            <Link
              href="/forgot-password"
              className="text-xs uppercase tracking-[0.25em] text-[hsl(var(--muted-foreground))] underline-offset-4 transition hover:text-[hsl(var(--primary))] hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <div className="mt-8 space-y-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>
              New here?{' '}
              <Link
                href={signupHref}
                className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
              >
                Create a buyer account
              </Link>
            </p>
            <p>
              Building a luxury fragrance business?{' '}
              <Link
                href="/partners/signup"
                className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
              >
                Join the partner program →
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
