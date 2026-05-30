/**
 * /account/profile — customer self-service profile editor.
 *
 * Editable: full_name, phone, preferred_language, preferred_currency,
 * marketing_consent.
 * Read-only: email (auth-bound), national_id + date_of_birth (KYC).
 */

import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { updateProfile, requestEmailChange } from './actions'

export const metadata = {
  title: 'My profile',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type ProfileRow = {
  id: string
  email: string
  phone: string | null
  full_name: string
  national_id: string | null
  date_of_birth: string | null
  preferred_language: string
  preferred_currency: string
  marketing_consent_at: string | null
}

export default async function ProfilePage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?next=/account/profile')

  const r = await supabase
    .from('profiles')
    .select(
      'id, email, phone, full_name, national_id, date_of_birth, preferred_language, preferred_currency, marketing_consent_at',
    )
    .eq('id', user.id)
    .single()
  const profile = (r.data as ProfileRow | null) ?? null
  if (!profile) redirect('/login?next=/account/profile')

  return (
    <div className="mx-auto max-w-2xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          Account
        </p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">My profile</h1>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Update your personal details and preferences.
        </p>
      </header>

      <form action={updateProfile} className="space-y-8">
        <section>
          <h2 className="mb-1 text-base font-medium">Identity</h2>
          <p className="mb-5 text-xs text-[hsl(var(--muted-foreground))]">
            Your email is currently <span className="font-mono">{profile.email}</span>.
            Use the change-email form below to switch. We'll send a
            confirmation link to the new address.
          </p>
          <Field label="Full name" required>
            <input
              type="text"
              name="fullName"
              required
              minLength={2}
              maxLength={120}
              defaultValue={profile.full_name}
              className={inputCls}
            />
          </Field>
          <Field label="Phone (E.164)">
            <input
              type="tel"
              name="phone"
              pattern="^\+\d{8,15}$"
              placeholder="+254712345678"
              defaultValue={profile.phone ?? ''}
              className={inputCls}
            />
          </Field>
          {profile.national_id || profile.date_of_birth ? (
            <p className="mt-2 text-[10px] text-[hsl(var(--muted-foreground))]">
              KYC details on file: ID {profile.national_id ?? '-'} · DOB{' '}
              {profile.date_of_birth ?? '-'} · contact support to update.
            </p>
          ) : null}
        </section>

        <section>
          <h2 className="mb-1 text-base font-medium">Preferences</h2>
          <p className="mb-5 text-xs text-[hsl(var(--muted-foreground))]">
            Language and currency we use when contacting you.
          </p>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="Preferred language">
              <select
                name="preferredLanguage"
                defaultValue={profile.preferred_language}
                className={inputCls}
              >
                <option value="en">English</option>
                <option value="sw">Kiswahili</option>
              </select>
            </Field>
            <Field label="Preferred currency">
              <select
                name="preferredCurrency"
                defaultValue={profile.preferred_currency}
                className={inputCls}
              >
                <option value="KES">KES</option>
                <option value="USD">USD</option>
              </select>
            </Field>
          </div>
        </section>

        <section>
          <h2 className="mb-1 text-base font-medium">Marketing</h2>
          <p className="mb-5 text-xs text-[hsl(var(--muted-foreground))]">
            Promotional emails, launches, and exclusive offers.
          </p>
          <label className="flex items-start gap-3 text-sm">
            <input
              type="checkbox"
              name="marketingConsent"
              value="true"
              defaultChecked={!!profile.marketing_consent_at}
              className="mt-1"
            />
            <span>
              I agree to receive marketing communications from Loveli Luxury
              International. Withdraw at any time by unchecking and saving.
            </span>
          </label>
        </section>

        <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-6">
          <Link
            href="/account/orders"
            className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
          >
            ← Back to orders
          </Link>
          <button
            type="submit"
            className="rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-xs uppercase tracking-[0.15em] text-[hsl(var(--background))]"
          >
            Save changes
          </button>
        </div>
      </form>

      <section className="mt-12 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6">
        <h2 className="text-base font-medium">Change email</h2>
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          We'll send a confirmation link to the new address. Your old
          email stays active until you click it.
        </p>
        <form
          action={requestEmailChange}
          className="mt-5 flex flex-wrap items-end gap-3"
        >
          <label className="flex flex-1 min-w-[18rem] flex-col">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
              New email
            </span>
            <input
              type="email"
              name="newEmail"
              required
              autoComplete="email"
              placeholder="you@new-domain.com"
              className={inputCls}
            />
          </label>
          <button
            type="submit"
            className="rounded-md border border-[hsl(var(--primary))] px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-[hsl(var(--primary))] transition hover:bg-[hsl(var(--primary))] hover:text-[hsl(var(--primary-foreground))]"
          >
            Send confirmation
          </button>
        </form>
      </section>
    </div>
  )
}

const inputCls =
  'w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:border-[hsl(var(--primary))] focus:outline-none'

function Field({
  label,
  required,
  children,
}: {
  label: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label className="mt-4 block first:mt-0">
      <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}
