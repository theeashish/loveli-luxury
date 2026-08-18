import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { SignupForm } from '@/components/auth/SignupForm'
import { AccountProtectionNotice } from '@/components/auth/AccountProtectionNotice'
import { safeNext } from '@/lib/auth/safe-next'

export const metadata = { title: 'Create account', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function SignupPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>
}) {
  const query = await searchParams
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const next = safeNext(query.next)
  if (session?.user) redirect(next || '/post-login')

  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : '/login'
  const isJoinFlow = next.startsWith('/partners/signup')

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50% 70% at 80% 30%, hsl(47.22 95.58% 55.69% / 0.18) 0%, transparent 60%), radial-gradient(40% 60% at 20% 80%, hsl(0 0% 90.2% / 0.10) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-7xl items-center justify-center px-6 py-16 lg:py-24">
        <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm md:p-12">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.35em] text-[hsl(var(--brand-gold))]">
            Loveli Luxury
          </p>
          <h1 className="mt-5 text-center font-serif text-5xl italic tracking-tight md:text-6xl">
            Create your account
          </h1>
          <p className="mt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            {isJoinFlow
              ? 'Create your account, then complete your partner registration.'
              : 'Shop hand-crafted Eau de Parfum. Track your orders. Five seconds.'}
          </p>
          <div className="mt-10">
            <SignupForm next={next} />
          <AccountProtectionNotice />
          </div>
          <div className="mt-8 space-y-2 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>
              Already have an account?{' '}
              <Link
                href={loginHref}
                className="font-medium text-[hsl(var(--brand-gold))] underline-offset-4 hover:underline"
              >
                Sign in
              </Link>
            </p>
            <p>
              Want to build a luxury fragrance business instead?{' '}
              <Link
                href="/partners/signup"
                className="font-medium text-[hsl(var(--brand-gold))] underline-offset-4 hover:underline"
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
