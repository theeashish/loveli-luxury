import { Suspense } from 'react'
import Link from 'next/link'
import { SignupForm } from '@/components/auth/SignupForm'

export const metadata = { title: 'Create account', robots: { index: false } }

export default function SignupPage({
  searchParams,
}: {
  searchParams: { next?: string }
}) {
  const next = typeof searchParams.next === 'string' ? searchParams.next : ''
  const loginHref = next
    ? `/login?next=${encodeURIComponent(next)}`
    : '/login'

  const isJoinFlow = next.startsWith('/distributors/signup')

  return (
    <div className="mx-auto flex min-h-screen max-w-sm items-center px-6 py-16">
      <div className="w-full">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          Loveli Luxury
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-tight">Create account</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          {isJoinFlow
            ? 'Start by creating an account. Your Boss Scents registration continues right after.'
            : 'Set up your Loveli Luxury account.'}
        </p>
        <div className="mt-8">
          <Suspense fallback={null}>
            <SignupForm />
          </Suspense>
        </div>
        <p className="mt-6 text-sm text-[hsl(var(--muted-foreground))]">
          Already have one?{' '}
          <Link
            href={loginHref}
            className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
          >
            Sign in
          </Link>
          .
        </p>
      </div>
    </div>
  )
}
