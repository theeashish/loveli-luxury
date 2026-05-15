'use client'

import { useMemo, useState } from 'react'
import { formatKes } from '@/lib/money'

export type SignupAddress = {
  id: number
  label: string | null
  recipientName: string
  phone: string
  streetLine1: string
  streetLine2: string | null
  city: string
  region: string | null
  postalCode: string | null
  countryCode: string
  isDefault: boolean
}

export type StarterBundleOption = {
  id: number
  slug: string
  name: string
  description: string | null
  retailPriceMinor: string
  starterCode: string | null
}

type Props = {
  defaultPhone: string
  defaultNationalId: string
  defaultDateOfBirth: string
  addresses: SignupAddress[]
  bundles: StarterBundleOption[]
  sponsorCookie: string
}

const NEW_ADDRESS_KEY = '__new__'
const SPONSOR_RE = /^LL-[A-Z2-9]{2}-[A-Z2-9]{4}$/

export function DistributorSignupForm({
  defaultPhone,
  defaultNationalId,
  defaultDateOfBirth,
  addresses,
  bundles,
  sponsorCookie,
}: Props) {
  const initialAddressKey = useMemo(() => {
    if (addresses.length === 0) return NEW_ADDRESS_KEY
    const def = addresses.find((a) => a.isDefault)
    return String((def ?? addresses[0]!).id)
  }, [addresses])

  const [bundleId, setBundleId] = useState<number | null>(
    bundles[0]?.id ?? null,
  )
  const [sponsorCode, setSponsorCode] = useState(sponsorCookie)
  const [nationalId, setNationalId] = useState(defaultNationalId)
  const [dob, setDob] = useState(defaultDateOfBirth)
  const [payoutMsisdn, setPayoutMsisdn] = useState(defaultPhone)
  const [phone, setPhone] = useState(defaultPhone)
  const [agreed, setAgreed] = useState(false)

  const [addressKey, setAddressKey] = useState<string>(initialAddressKey)
  const [recipientName, setRecipientName] = useState('')
  const [newPhone, setNewPhone] = useState(defaultPhone)
  const [streetLine1, setStreetLine1] = useState('')
  const [streetLine2, setStreetLine2] = useState('')
  const [city, setCity] = useState('')
  const [region, setRegion] = useState('')
  const [postalCode, setPostalCode] = useState('')
  const [countryCode, setCountryCode] = useState('KE')
  const [saveAsDefault, setSaveAsDefault] = useState(addresses.length === 0)

  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const usingNew = addressKey === NEW_ADDRESS_KEY
  const selectedBundle =
    bundleId !== null ? bundles.find((b) => b.id === bundleId) ?? null : null

  if (bundles.length === 0) {
    return (
      <div className="rounded-lg border border-amber-300 bg-amber-50 px-6 py-8 text-sm text-amber-900">
        No starter packages are configured yet. An admin must create at least
        one bundle with <code className="font-mono">is_starter_package = true</code>{' '}
        before signups can proceed.
      </div>
    )
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!SPONSOR_RE.test(sponsorCode)) {
      setError('Sponsor code must look like LL-XX-XXXX.')
      return
    }
    if (!agreed) {
      setError('Please accept the distributor terms to continue.')
      return
    }
    if (bundleId === null) {
      setError('Pick a starter package.')
      return
    }

    setSubmitting(true)
    const body = {
      starterBundleId: bundleId,
      sponsorCode,
      nationalId,
      dateOfBirth: dob,
      payoutMsisdn,
      agreedToTerms: true,
      shippingAddressId: usingNew ? null : Number(addressKey),
      newAddress: usingNew
        ? {
            recipientName,
            phone: newPhone,
            streetLine1,
            streetLine2: streetLine2 || null,
            city,
            region: region || null,
            postalCode: postalCode || null,
            countryCode,
            saveAsDefault,
          }
        : null,
      customerPhone: phone,
    }

    try {
      const res = await fetch('/api/distributor-signup/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        if (json?.redirect && typeof json.redirect === 'string') {
          window.location.href = json.redirect
          return
        }
        setError(json?.error ?? 'Signup failed.')
        setSubmitting(false)
        return
      }
      window.location.href = json.redirectUrl
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]"
    >
      <div className="space-y-10">
        <Section
          title="Sponsor"
          subtitle="Distributor signup is invite-only. Enter the code from your sponsor."
        >
          <div className="max-w-sm">
            <input
              type="text"
              required
              autoComplete="off"
              placeholder="LL-XX-XXXX"
              value={sponsorCode}
              onChange={(e) => setSponsorCode(e.target.value.toUpperCase())}
              className={inputCls}
            />
            {sponsorCookie && sponsorCookie === sponsorCode ? (
              <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
                Pre-filled from your invite link.
              </p>
            ) : null}
          </div>
        </Section>

        <Section title="Starter package" subtitle="Pick the kit you'll be selling.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {bundles.map((b) => (
              <label
                key={b.id}
                className={`flex cursor-pointer flex-col rounded-lg border px-5 py-4 text-sm transition ${
                  bundleId === b.id
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--muted))]'
                    : 'border-[hsl(var(--border))]'
                }`}
              >
                <input
                  type="radio"
                  name="bundle"
                  value={b.id}
                  checked={bundleId === b.id}
                  onChange={() => setBundleId(b.id)}
                  className="sr-only"
                />
                <div className="flex items-baseline justify-between">
                  <span className="font-medium">{b.name}</span>
                  {b.starterCode ? (
                    <span className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                      Pkg {b.starterCode}
                    </span>
                  ) : null}
                </div>
                {b.description ? (
                  <p className="mt-2 text-xs leading-relaxed text-[hsl(var(--muted-foreground))]">
                    {b.description}
                  </p>
                ) : null}
                <p className="mt-3 font-medium tabular-nums">
                  {formatKes(BigInt(b.retailPriceMinor))}
                </p>
              </label>
            ))}
          </div>
        </Section>

        <Section title="KYC" subtitle="Required by the regulator for distributor payouts.">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <Field label="National ID" required>
              <input
                type="text"
                required
                autoComplete="off"
                value={nationalId}
                onChange={(e) => setNationalId(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Date of birth" required>
              <input
                type="date"
                required
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="M-Pesa payout number (E.164)" required>
              <input
                type="tel"
                required
                pattern="^\+\d{8,15}$"
                placeholder="+254712345678"
                value={payoutMsisdn}
                onChange={(e) => setPayoutMsisdn(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Contact phone (E.164)" required>
              <input
                type="tel"
                required
                pattern="^\+\d{8,15}$"
                placeholder="+254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <Section title="Shipping" subtitle="Where should we send your starter package?">
          {addresses.length > 0 ? (
            <div className="space-y-3">
              {addresses.map((a) => (
                <label
                  key={a.id}
                  className={`flex cursor-pointer gap-4 rounded-lg border px-4 py-4 text-sm transition ${
                    addressKey === String(a.id)
                      ? 'border-[hsl(var(--primary))] bg-[hsl(var(--muted))]'
                      : 'border-[hsl(var(--border))]'
                  }`}
                >
                  <input
                    type="radio"
                    name="address"
                    value={String(a.id)}
                    checked={addressKey === String(a.id)}
                    onChange={() => setAddressKey(String(a.id))}
                    className="mt-1"
                  />
                  <span className="flex-1">
                    <span className="block font-medium">{a.recipientName}</span>
                    <span className="mt-1 block text-[hsl(var(--muted-foreground))]">
                      {a.streetLine1}
                      {a.streetLine2 ? `, ${a.streetLine2}` : ''}
                      {', '}
                      {a.city}
                    </span>
                  </span>
                </label>
              ))}
              <label
                className={`flex cursor-pointer gap-4 rounded-lg border px-4 py-4 text-sm transition ${
                  usingNew
                    ? 'border-[hsl(var(--primary))] bg-[hsl(var(--muted))]'
                    : 'border-[hsl(var(--border))]'
                }`}
              >
                <input
                  type="radio"
                  name="address"
                  value={NEW_ADDRESS_KEY}
                  checked={usingNew}
                  onChange={() => setAddressKey(NEW_ADDRESS_KEY)}
                  className="mt-1"
                />
                <span className="font-medium">Use a new address</span>
              </label>
            </div>
          ) : null}

          {usingNew ? (
            <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Recipient name" required>
                <input
                  type="text"
                  required={usingNew}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone (E.164)" required>
                <input
                  type="tel"
                  required={usingNew}
                  pattern="^\+\d{8,15}$"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Street line 1" required>
                <input
                  type="text"
                  required={usingNew}
                  value={streetLine1}
                  onChange={(e) => setStreetLine1(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Street line 2">
                <input
                  type="text"
                  value={streetLine2}
                  onChange={(e) => setStreetLine2(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="City" required>
                <input
                  type="text"
                  required={usingNew}
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="County / region">
                <input
                  type="text"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Postal code">
                <input
                  type="text"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Country (2-letter)">
                <input
                  type="text"
                  required={usingNew}
                  maxLength={2}
                  value={countryCode}
                  onChange={(e) => setCountryCode(e.target.value.toUpperCase())}
                  className={inputCls}
                />
              </Field>
              <label className="flex items-center gap-2 text-sm md:col-span-2">
                <input
                  type="checkbox"
                  checked={saveAsDefault}
                  onChange={(e) => setSaveAsDefault(e.target.checked)}
                />
                Save as default address
              </label>
            </div>
          ) : null}
        </Section>

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            className="mt-1"
          />
          <span>
            I have read and accept the Loveli Luxury Distributor Agreement,
            including the compensation plan and code of conduct.
          </span>
        </label>
      </div>

      <aside className="self-start rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6">
        <h2 className="mb-5 text-base font-medium">Summary</h2>
        {selectedBundle ? (
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">
                Starter package
              </dt>
              <dd className="font-medium">{selectedBundle.name}</dd>
            </div>
            <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">
              <dt>Shipping</dt>
              <dd>Free</dd>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4">
              <span className="text-sm font-medium">Total</span>
              <span className="text-xl font-medium tabular-nums">
                {formatKes(BigInt(selectedBundle.retailPriceMinor))}
              </span>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Pick a starter package to see the total.
          </p>
        )}

        {error ? (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || bundleId === null}
          className="mt-6 w-full rounded-md bg-[hsl(var(--primary))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))] disabled:opacity-50"
        >
          {submitting ? 'Redirecting…' : 'Pay & activate distributor'}
        </button>
        <p className="mt-3 text-center text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
          Card · M-Pesa · Mobile money
        </p>
      </aside>
    </form>
  )
}

const inputCls =
  'w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-sm focus:border-[hsl(var(--primary))] focus:outline-none'

function Section({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section>
      <h2 className="text-base font-medium">{title}</h2>
      {subtitle ? (
        <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
          {subtitle}
        </p>
      ) : null}
      <div className="mt-5">{children}</div>
    </section>
  )
}

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
    <label className="block">
      <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}
