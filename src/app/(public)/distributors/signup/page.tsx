/**
 * /distributors/signup — distributor onboarding entry.
 *
 * Login-gated. If the user is already a distributor we redirect them to
 * their portal instead of showing a form they can't submit. Sponsor code is
 * captured from the `ll_sponsor` cookie set by middleware (?ref=...) and
 * pre-filled into the form, but is editable. Submission requires a code
 * regardless of cookie state — invite-only is the rule.
 */

import { redirect } from 'next/navigation'
import { cookies } from 'next/headers'
import { createClient } from '@/lib/supabase/server'
import { createServiceClient } from '@/lib/supabase/service'
import {
  DistributorSignupForm,
  type StarterBundleOption,
  type SignupAddress,
} from '@/components/distributors/SignupForm'

export const metadata = {
  title: 'Become a distributor',
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
  retail_price_minor: string
  starter_package_code: string | null
}

export default async function DistributorSignupPage() {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=/distributors/signup')

  const service = createServiceClient()

  // If they already are a distributor, send them to the portal.
  const existing = await service
    .from('distributors')
    .select('id')
    .eq('user_id', user.id)
    .maybeSingle()
  if (existing.data) redirect('/account/distributor')

  const [profileRes, addressesRes, bundlesRes] = await Promise.all([
    service
      .from('profiles')
      .select('id, email, full_name, phone, national_id, date_of_birth')
      .eq('id', user.id)
      .single(),
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

  const profile = profileRes.data as ProfileRow | null
  if (!profile) redirect('/login?next=/distributors/signup')

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

  const bundles: StarterBundleOption[] = ((bundlesRes.data ?? []) as BundleRow[]).map(
    (b) => ({
      id: b.id,
      slug: b.slug,
      name: b.name,
      description: b.description,
      retailPriceMinor: b.retail_price_minor,
      starterCode: b.starter_package_code,
    }),
  )

  return (
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          Invite-only
        </p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">
          Become a Loveli distributor
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-[hsl(var(--muted-foreground))]">
          You'll need a sponsor code from an existing distributor. Choose a
          starter package, complete KYC, pay via M-Pesa or card, and your
          distributor account is provisioned the moment payment confirms.
        </p>
      </header>

      <DistributorSignupForm
        defaultPhone={profile.phone ?? ''}
        defaultNationalId={profile.national_id ?? ''}
        defaultDateOfBirth={profile.date_of_birth ?? ''}
        addresses={addresses}
        bundles={bundles}
        sponsorCookie={sponsorCookie}
      />
    </div>
  )
}
