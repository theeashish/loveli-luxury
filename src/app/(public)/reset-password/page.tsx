import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { ResetPasswordForm } from '@/components/auth/ResetPasswordForm'

export const metadata = { title: 'Set a new password', robots: { index: false } }
export const dynamic = 'force-dynamic'

export default async function ResetPasswordPage() {
  // Must be signed in via the recovery link. If the user lands here
  // without a session (link expired or accessed directly), bounce them
  // to /forgot-password so they can request a fresh link.
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  if (!session?.user) {
    redirect('/forgot-password?expired=1')
  }

  return (
    <div className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          background:
            'radial-gradient(50% 70% at 80% 30%, hsl(38 56% 60% / 0.12) 0%, transparent 60%), radial-gradient(40% 60% at 20% 80%, hsl(0 55% 45% / 0.10) 0%, transparent 60%)',
        }}
      />
      <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-7xl items-center justify-center px-6 py-16 lg:py-24">
        <div className="w-full max-w-md rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm md:p-12">
          <p className="text-center text-[11px] font-medium uppercase tracking-[0.35em] text-[hsl(var(--primary))]">
            Boss Scents International
          </p>
          <h1 className="mt-5 text-center font-serif text-5xl italic tracking-tight md:text-6xl">
            New Password
          </h1>
          <p className="mt-4 text-center text-sm text-[hsl(var(--muted-foreground))]">
            Choose a strong password — at least 8 characters.
          </p>
          <div className="mt-10">
            <ResetPasswordForm />
          </div>
          <div className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
            <p>
              Changed your mind?{' '}
              <Link
                href="/login"
                className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
              >
                Back to sign in
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
