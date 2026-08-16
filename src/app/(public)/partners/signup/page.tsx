/**
 * /partners/signup ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â distributor onboarding entry.
 *
 * Middleware enforces:
 *   - signed-in (else 307 to /login)
 *   - not already a distributor (else 307 to /account/partner)
 *
 * This file is render-only. It does NOT redirect ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â a redirect after the
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
  type SignupVariantOption,
  type SignupAddress,
} from '@/components/distributors/SignupForm'
import { paymentProviderAvailability } from '@/lib/payments/availability'
import { AccountProtectionNotice } from '@/components/auth/AccountProtectionNotice'

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

type SignupVariantRow = {
  id: number
  product_id: number
  size_ml: number
  retail_price_minor: string | number
  products?: { name: string } | null
}
type JoiningFeeRow = {
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
        Loveli Luxury ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â· Partner Program
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

export default async function DistributorSignupPage({ searchParams }: { searchParams?: Promise<{ activation?: string }> }) {
  const query = searchParams ? await searchParams : undefined
  // Middleware guarantees user is signed in and not already a distributor.
  // We still need their id for the DB reads.
  const supabase = await createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user

  if (!user) {
    // Defensive ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â middleware should have caught this. Render an inline
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

  const [profileRes, addressesRes] = await Promise.all([
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
  ])
  const variantsRes = await service
.from('product_variants')
.select('id, product_id, size_ml, retail_price_minor, is_active, products(name)')
.eq('is_active', true)
.order('product_id', { ascending: true })
.order('size_ml', { ascending: true })
  const feeRes = await service
.from('config_starter_packages')
.select('joining_fee_minor')
.is('effective_until', null)
.order('id', { ascending: false })
.limit(1)
.maybeSingle()

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

  const variantRows = (variantsRes.data ?? []) as SignupVariantRow[]
  const variants: SignupVariantOption[] = variantRows.map((v) => ({
    id: v.id,
    productId: v.product_id,
    sizeMl: v.size_ml,
    name: v.products?.name ?? `Perfume ${v.product_id}`,
    retailPriceMinor: v.retail_price_minor,
  }))
  const joiningFeeMinor = String((feeRes.data as JoiningFeeRow | null)?.joining_fee_minor ?? '0')

  const sponsorCookie = (await cookies()).get('ll_sponsor')?.value ?? ''
  const activationMode = query?.activation === '1'

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
      <BrandHeading subtitle="Choose at least five perfumes, add your ID, date of birth, and phone number, then pay by M-Pesa. Your partner account starts when payment is confirmed." />
      <div className="mt-10">
        <AccountProtectionNotice />
        {(() => {
          const availability = paymentProviderAvailability()
          if (!availability.ok) {
            return (
              <div className="rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--muted))]/50 p-8 text-center">
                <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
                  Just a moment
                </p>
                <h2 className="mt-3 font-serif text-2xl tracking-tight">
                  Payments are briefly being upgraded
                </h2>
                <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
                  {availability.customerMessage}
                </p>
              </div>
            )
          }
          return (
            <DistributorSignupForm
              defaultPhone={profile.phone ?? ''}
              defaultNationalId={profile.national_id ?? ''}
              defaultDateOfBirth={profile.date_of_birth ?? ''}
              addresses={addresses}
              variants={variants}
              joiningFeeMinor={joiningFeeMinor}
              sponsorCookie={sponsorCookie}
              activationMode={activationMode}
            />
          )
        })()}
      </div>
      <p className="mt-8 text-center text-sm text-[hsl(var(--muted-foreground))]">
        Just want to shop?{' '}
        <Link
          href="/signup"
          className="font-medium text-[hsl(var(--primary))] underline-offset-4 hover:underline"
        >
          Create a buyer account ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã‚Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢
        </Link>
      </p>
    </Shell>
  )
}