import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckoutForm, type CheckoutAddress } from '@/components/checkout/CheckoutForm'
import { SponsorStrip } from '@/components/sponsor/SponsorStrip'
import { paymentProviderAvailability } from '@/lib/payments/availability'

export const metadata = {
  title: 'Checkout',
  robots: { index: false, follow: false },
}

export const dynamic = 'force-dynamic'

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

type ProfileRow = {
  id: string
  email: string
  full_name: string
  phone: string | null
}

export default async function CheckoutPage() {
  const supabase = createClient()
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) redirect('/login?next=/checkout')

  const [profileRes, addressesRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, email, full_name, phone')
      .eq('id', user.id)
      .single(),
    supabase
      .from('addresses')
      .select(
        'id, label, recipient_name, phone, street_line_1, street_line_2, city, region, postal_code, country_code, is_default',
      )
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const profile = profileRes.data as ProfileRow | null
  if (!profile) redirect('/login?next=/checkout')

  const rows = (addressesRes.data ?? []) as AddressRow[]
  const addresses: CheckoutAddress[] = rows.map((a) => ({
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
  }))

  return (
    <>
      <SponsorStrip />
      <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Secure</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">Checkout</h1>
        <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
          Confirm your shipping details. Payment is handled via M-Pesa.
        </p>
      </header>

      {(() => {
        const availability = paymentProviderAvailability()
        if (!availability.ok) {
          // Payment provider env not yet wired — render the customer-safe
          // banner instead of letting CheckoutForm fire /api/checkout/init
          // and 502. This is the deploy-safety guard for the IntaSend
          // cutover window: ops set INTASEND_* in Vercel, redeploy, and
          // checkout becomes usable.
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
        return <CheckoutForm defaultPhone={profile.phone ?? ''} addresses={addresses} />
      })()}
      </div>
    </>
  )
}
