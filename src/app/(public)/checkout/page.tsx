import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { CheckoutForm, type CheckoutAddress } from '@/components/checkout/CheckoutForm'

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
    data: { user },
  } = await supabase.auth.getUser()
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
    <div className="mx-auto max-w-4xl px-6 py-12 lg:py-16">
      <header className="mb-10">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Secure</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">Checkout</h1>
        <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
          Confirm your shipping details. Payment is handled by Flutterwave.
        </p>
      </header>

      <CheckoutForm defaultPhone={profile.phone ?? ''} addresses={addresses} />
    </div>
  )
}
