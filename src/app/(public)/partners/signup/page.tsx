/**
 * /partners/signup — distributor onboarding entry.
 *
 * Middleware enforces:
 *   - signed-in (else 307 to /login)
 *   - not already a distributor (else 307 to /account/partner)
 *
 * This file is render-only. It does NOT redirect — a redirect after the
 * layout has streamed leaves the user staring at the empty public chrome
 * while the browser follows the 307. Every "edge case" branches into an
 * inline empty-state card instead.
 */

import Link from 'next/link'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  DistributorSignupForm,
  type StarterBundleOption,
  type SignupAddress,
} from '@/components/distributors/SignupForm'

export const metadata = {
  title: 'Join the partner program',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

type ProfileRow = {
  id: string
  email: string
  full_name: string
  phone: string | null
  national_id: string | null
  date_of_birth: string | null
}

type AddressRow = {
  id: number
  label: string | null
  recipient_name: string
  phone: string
  street_line_1: string
  street_line_2: string | null
  city: string
  region: string | null
  postal_code: string | null
  country_code: string
  is_default: boolean
}

type BundleRow = {
  id: number
  slug: string
  name: string
  description: string | null
  retail_price_minor: string | number
  starter_package_code: string | null
}

type JoiningFeeRow = {
  bundle_id: number
  joining_fee_minor: string | number
}

function Shell({ children }: { children: React.ReactNode }) {
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
      <div className="mx-auto flex min-h-[calc(100vh-200px)] max-w-3xl items-center justify-center px-6 py-16 lg:py-24">
        <div className="w-full rounded-2xl border border-[hsl(var(--primary))]/25 bg-[hsl(var(--muted))]/40 p-8 shadow-[0_30px_80px_-30px_rgba(0,0,0,0.6)] backdrop-blur-sm md:p-12">
          {children}
        </div>
      </div>
    </div>
  )
}

function BrandHeading({ subtitle }: { subtitle: string }) {
  return (
    <header className="text-center">
      <p className="text-[11px] font-medium uppercase tracking-[0.35em] text-[hsl(var(--primary))]">
        Loveli Luxury · Partner Program
      </p>
      <h1 className="mt-5 font-serif text-5xl italic tracking-tight md:text-6xl">
        Begin your partnership
      </h1>
      <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">
        {subtitle}
      </p>
    </header>
  )
}

export default async function DistributorSignupPage() {
  // Middleware guarantees user is signed in and not already a distributor.
  // We still need their id for the DB reads.
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) {
    // Defensive — middleware should have caught this. Render an inline
    // sign-in prompt instead of redirecting (no more chrome-flash).
    return (
      <Shell>
        <BrandHeading subtitle="Sign in to continue your partner application." />
        <div className="mt-10 text-center">
          <Link
            href="/login?next=/partners/signup"
            className="inline-flex w-full justify-center rounded-md bg-[hsl(var(--foreground))] px-6 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90"
          >
            Sign in
          </Link>
        </div>
      </Shell>
    )
  }

  const service = createServiceClient()

  const [profileRes, addressesRes, bundlesRes] = await Promise.all([
    service
      .from('profiles')
      .select('id, email, full_name, phone, national_id, date_of_birth')
      .eq('id', user.id)
      .maybeSingle(),
    service
      .from('addresses')
      .select(
        'id, label, recipient_name, phone, street_line_1, street_line_2, city, region, postal_code, country_code, is_default',
      )
      .eq('user_id', user.id)
      .order('is_default', { ascending: false }),
    service
      .from('bundles')
      .select(
        'id, slug, name, description, retail_price_minor, starter_package_code',
      )
      .eq('is_starter_package', true)
      .eq('is_active', true)
      .order('retail_price_minor', { ascending: true }),
  ])

  // If profile row missing, lazy-create from the auth user. The DB trigger
  // SHOULD have done this on signup but during the early operational
  // period it sometimes doesn't fire (e.g. social-auth providers). Insert
  // and continue rather than bouncing the user.
  let profile = profileRes.data as ProfileRow | null
  if (!profile) {
    const ins = await service
      .from('profiles')
      .insert({
        id: user.id,
        email: user.email ?? '',
        full_name:
          (user.user_metadata?.full_name as string | undefined) ?? '',
      })
      .select('id, email, full_name, phone, national_id, date_of_birth')
      .single()
    profile = (ins.data as ProfileRow | null) ?? null
  }

  if (!profile) {
    return (
      <Shell>
        <BrandHeading subtitle="We couldn't load your profile." />
        <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          Please contact{' '}
          <a
            href="mailto:support@lovelilux.com"
            className="text-[hsl(var(--primary))] underline-offset-4 hover:underline"
          >
            support@lovelilux.com
          </a>{' '}
          and reference your sign-in email.
        </p>
      </Shell>
    )
  }

  const bundleRows = (bundlesRes.data ?? []) as BundleRow[]

  // Look up the currently-effective joining fee for each starter bundle.
  // The server-side init route uses this same `config_starter_packages`
  // table to compute the order total, so the form's summary MUST include
  // it too — otherwise the customer sees a price that doesn't match what
  // we charge. (Source of the "Ksh 1 form, Ksh 2 charged" mismatch fixed
  // 2026-05-18.)
  const bundleIds = bundleRows.map((b) => b.id)
  const joiningFeesRes = bundleIds.length
    ? await service
        .from('config_starter_packages')
        .select('bundle_id, joining_fee_minor')
        .in('bundle_id', bundleIds)
        .is('effective_until', null)
    : { data: [] as JoiningFeeRow[] }
  const joiningFeeByBundle = new Map<number, string>(
    ((joiningFeesRes.data ?? []) as JoiningFeeRow[]).map((j) => [
      j.bundle_id,
      String(j.joining_fee_minor),
    ]),
  )

  const bundles: StarterBundleOption[] = bundleRows.map((b) => ({
    id: b.id,
    slug: b.slug,
    name: b.name,
    description: b.description,
    retailPriceMinor: b.retail_price_minor,
    joiningFeeMinor: joiningFeeByBundle.get(b.id) ?? '0',
    starterCode: b.starter_package_code,
  }))

  if (bundles.length === 0) {
    return (
      <Shell>
        <BrandHeading subtitle="Starter packages aren't available yet." />
        <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
          We're loading the season's starter bundles. Check back shortly,
          or reach{' '}
          <a
            href="mailto:support@lovelilux.com"
            className="text-[hsl(var(--primary))] underline-offset-4 hover:underline"
          >
            support@lovelilux.com
          </a>{' '}
          if this persists.
        </p>
      </Shell>
    )
  }

  const sponsorCookie = cookies().get('ll_sponsor')?.value ?? ''

  const addresses: SignupAddress[] = ((addressesRes.data ?? []) as AddressRow[]).map(
    (a) => ({
      id: a.id,
      label: a.label,
      recipientName: a.recipient_name,
      phone: a.phone,
      streetLine1: a.street_line_1,
      streetLine2: a.street_line_2,
      city: a.city,
      region: a.region,
      postalCode: a.postal_code,
      countryCode: a.country_code,
      isDefault: a.is_default,
    }),
  )

  return (
    <Shell>
      <BrandHeading subtitle="Pick your onboarding kit, complete KYC, pay via M-Pesa. Your partner account activates the moment payment confirms." />
      <div className="mt-10">
        <DistributorSignupForm
          defaultPhone={profile.phone ?? ''}
          defaultNationalId={profile.national_id ?? ''}
          defaultDateOfBirth={profile.date_of_birth ?? ''}
          addresses={addresses}
          bundles={bundles}
          sponsorCookie={sponsorCookie}
        />
      </div>
      <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Just want to shop?{' '}
        <Link
          href="/signup"
          className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
        >
          Create a buyer account →
        </Link>
      </p>
    </Shell>
  )
}
