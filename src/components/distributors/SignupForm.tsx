'use client'

import Link from 'next/link'
import { useMemo, useState } from 'react'
import { formatKes } from '@/lib/money'
import { computeProcessingFeeMinor } from '@/lib/payments/fees'
import { StkPushPanel } from '@/components/checkout/StkPushPanel'

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

export type SignupVariantOption = {
  id: number
  productId: number
  sizeMl: number
  name: string
  retailPriceMinor: string | number
}


type Props = {
  defaultPhone: string
  defaultNationalId: string
  defaultDateOfBirth: string
  addresses: SignupAddress[]
  variants: SignupVariantOption[]
  joiningFeeMinor: string | number
  sponsorCookie: string
  activationMode?: boolean
}

const NEW_ADDRESS_KEY = '__new__'
const SPONSOR_RE = /^LL-[A-Z2-9]{2}-[A-Z2-9]{4}$/

export function DistributorSignupForm({
  defaultPhone,
  defaultNationalId,
  defaultDateOfBirth,
  addresses,
  variants,
  joiningFeeMinor,
  sponsorCookie,
  activationMode = false,
}: Props) {
  const initialAddressKey = useMemo(() => {
    if (addresses.length === 0) return NEW_ADDRESS_KEY
    const def = addresses.find((a) => a.isDefault)
    return String((def ?? addresses[0]!).id)
  }, [addresses])

  const [variantQuantities, setVariantQuantities] = useState<Record<number, number>>({})
  const selectedLines = useMemo(
    () => variants.map((v) => ({ id: v.id, qty: Math.max(0, variantQuantities[v.id] ?? 0) })).filter((line) => line.qty > 0),
    [variants, variantQuantities],
  )
  const bottleCount = selectedLines.reduce((sum, line) => sum + line.qty, 0)
  const subtotalMinor = selectedLines.reduce((sum, line) => {
    const variant = variants.find((v) => v.id === line.id)
    return sum + (variant ? BigInt(variant.retailPriceMinor) * BigInt(line.qty) : 0n)
  }, 0n)
  const membershipMinor = BigInt(joiningFeeMinor)
  const signupSubtotalMinor = subtotalMinor + membershipMinor
  const totalMinor = signupSubtotalMinor + computeProcessingFeeMinor(signupSubtotalMinor)
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
  // When the provider initiates an STK push, we stash the orderNumber and
  // hand off to StkPushPanel. The form is hidden while the panel polls.
  const [stkOrderNumber, setStkOrderNumber] = useState<string | null>(null)

  const usingNew = addressKey === NEW_ADDRESS_KEY
  if (variants.length === 0) {
    return <div className="rounded-lg border border-[hsl(var(--border))] p-6 text-sm">No perfumes are available yet.</div>
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!activationMode && !SPONSOR_RE.test(sponsorCode)) {
      setError('Your invitation code should look like LL-XX-XXXX.')
      return
    }
    if (!agreed) {
      setError('Please accept the partner agreement to continue.')
      return
    }
    if (bottleCount < 5) {
      setError('Choose at least five bottles to become a verified distributor.')
      return
    }

    setSubmitting(true)
    const body = {
      variantLines: selectedLines.map((line) => ({ variantId: line.id, qty: line.qty })),
      activationMode,
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
      const res = await fetch('/api/partner-signup/init', {
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
        const base = json?.error ?? 'Signup failed.'
        const detail = typeof json?.detail === 'string' ? ` (${json.detail})` : ''
        setError(`${base}${detail}`)
        setSubmitting(false)
        return
      }

      // Server fired an STK push to the customer's phone (via whichever
      // provider is active). Switch UI to the polling panel
      // is now hidden.
      if (json.orderNumber) {
        setStkOrderNumber(json.orderNumber as string)
        return
      }

      setError('Payment provider did not return a usable response.')
      setSubmitting(false)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  // When the STK push is in flight, render only the polling panel.
  // The panel owns retry behaviour
  // against the SAME order_number, so no duplicate orders or provider
  // wallet fees can ever come from "Try again".
  if (stkOrderNumber) {
    return (
      <StkPushPanel
        orderNumber={stkOrderNumber}
        successRedirectUrl={`/checkout/return?ref=${encodeURIComponent(stkOrderNumber)}`}
        amountLabel={formatKes(totalMinor)}
      />
    )
  }

  return (
    <form onSubmit={onSubmit} className="space-y-10">
      <div className="space-y-10">
        <Section
          title="Invitation code"
          subtitle="You need an invitation code to join. Enter the code you received from the person who invited you."
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

        <Section title="Your perfumes" subtitle="Select at least five bottles. You can mix fragrances or repeat one variant.">
          <div className="space-y-3">
            {variants.map((variant) => (
              <div key={variant.id} className="flex items-center justify-between gap-4 rounded-lg border border-[hsl(var(--border))] px-4 py-3">
                <div>
                  <p className="font-medium">{variant.name} - {variant.sizeMl}ml</p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">{formatKes(BigInt(variant.retailPriceMinor))} each</p>
                </div>
                <label className="flex items-center gap-2 text-xs uppercase tracking-[0.15em]">
                  Qty
                  <input
                    type="number"
                    min={0}
                    max={99}
                    value={variantQuantities[variant.id] ?? 0}
                    onChange={(e) => {
                      const next = Number.parseInt(e.target.value, 10)
                      setVariantQuantities((current) => ({ ...current, [variant.id]: Number.isFinite(next) ? Math.max(0, Math.min(99, next)) : 0 }))
                    }}
                    className="w-20 rounded-md border border-[hsl(var(--primary))]/30 bg-transparent px-3 py-2 text-center text-sm"
                  />
                </label>
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-[hsl(var(--muted-foreground))]">{bottleCount} bottles selected. At least 5 bottles are required.</p>
        </Section>

        <Section title="ID details" subtitle="Your ID helps us check your account before we send payments.">
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
            <Field label="M-Pesa payout number (+254712345678)" required>
              <input
                type="tel"
                required
                pattern="^\+254[17]\d{8}$"
                placeholder="+254712345678"
                value={payoutMsisdn}
                onChange={(e) => setPayoutMsisdn(e.target.value)}
                className={inputCls}
              />
            </Field>
            <Field label="Contact phone (+254712345678)" required>
              <input
                type="tel"
                required
                pattern="^\+254[17]\d{8}$"
                placeholder="+254712345678"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={inputCls}
              />
            </Field>
          </div>
        </Section>

        <Section title="Shipping" subtitle="Where should we send your perfumes?">
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
                  pattern="^\+254[17]\d{8}$"
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
            I have read and accept the{' '}
            <Link href="/partners/agreement" target="_blank" className="font-medium text-[hsl(var(--foreground))] underline underline-offset-4">
              Loveli Luxury Partner Agreement
            </Link>{' '}
            including the compensation plan and code of conduct.
          </span>
        </label>
      </div>

      <aside className="rounded-lg border border-[hsl(var(--primary))]/25 bg-[hsl(var(--background))]/40 p-6">
        <p className="mb-5 text-[11px] font-medium uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
          Summary
        </p>
        {bottleCount > 0 ? (
          <dl className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Perfumes</dt>
              <dd>{bottleCount} bottles</dd>
            </div>
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Perfume total</dt>
              <dd>{formatKes(subtotalMinor)}</dd>
            </div>
            {membershipMinor > 0n ? (
              <div className="flex items-center justify-between">
                <dt className="text-[hsl(var(--muted-foreground))]">Membership</dt>
                <dd>{formatKes(membershipMinor)}</dd>
              </div>
            ) : null}
            <div className="flex items-center justify-between">
              <dt className="text-[hsl(var(--muted-foreground))]">Shipping</dt>
              <dd>Free</dd>
            </div>
            <div className="mt-4 flex items-center justify-between border-t border-[hsl(var(--border))] pt-4">
              <dt className="font-medium">Total</dt>
              <dd className="text-xl font-medium tabular-nums">{formatKes(totalMinor)}</dd>
            </div>
          </dl>
        ) : (
          <p className="text-sm text-[hsl(var(--muted-foreground))]">
            Choose at least five bottles to see the total.
          </p>
        )}

        {error ? (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </p>
        ) : null}

        <button
          type="submit"
          disabled={submitting || bottleCount < 5}
          className="mt-6 w-full rounded-md bg-[hsl(var(--foreground))] px-6 py-4 text-xs font-semibold uppercase tracking-[0.25em] text-[hsl(var(--background))] transition hover:opacity-90 disabled:opacity-50"
        >
          {submitting ? 'Redirecting...' : 'Create my account'}
        </button>
      </aside>
    </form>
  )
}

const inputCls =
  'w-full rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))]/60 px-4 py-3 text-sm outline-none transition focus:border-[hsl(var(--primary))] focus:ring-2 focus:ring-[hsl(var(--primary))]/30'

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
      <p className="text-[11px] font-medium uppercase tracking-[0.3em] text-[hsl(var(--primary))]">
        {title}
      </p>
      {subtitle ? (
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
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
      <span className="mb-2 block text-[11px] font-medium uppercase tracking-[0.25em] text-[hsl(var(--foreground))]">
        {label}
        {required ? ' *' : ''}
      </span>
      {children}
    </label>
  )
}
