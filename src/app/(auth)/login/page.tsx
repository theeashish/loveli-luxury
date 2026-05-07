import { Suspense } from 'react'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata = { title: 'Sign in', robots: { index: false } }

export default function LoginPage() {
  return (
    <div className="mx-auto flex min-h-screen max-w-sm items-center px-6 py-16">
      <div className="w-full">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          Loveli Luxury
        </p>
        <h1 className="mt-2 text-3xl font-light tracking-tight">Sign in</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Admin access only. Customers don't need an account to shop.
        </p>
        <div className="mt-8">
          <Suspense fallback={null}>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  )
}
