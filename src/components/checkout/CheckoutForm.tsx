'use client'

import Link from 'next/link'
import { useEffect, useMemo, useState } from 'react'
import { formatKes } from '@/lib/money'
import { useCartStore } from '@/lib/cart/store'
import { isEmpty, subtotalMinor, totalQty } from '@/lib/cart/selectors'
import { computeProcessingFeeMinor } from '@/lib/payments/fees'
import { StkPushPanel } from '@/components/checkout/StkPushPanel'

export type CheckoutAddress = {
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

type Props = {
  defaultPhone: string
  addresses: CheckoutAddress[]
}

const NEW_ADDRESS_KEY = '__new__'

export function CheckoutForm({ defaultPhone, addresses }: Props) {
  const hasHydrated = useCartStore((s) => s.hasHydrated)
  const lines = useCartStore((s) => s.lines)
  const cartId = useCartStore((s) => s.cartId)

  const initialAddressKey = useMemo(() => {
    if (addresses.length === 0) return NEW_ADDRESS_KEY
    const def = addresses.find((a) => a.isDefault)
    return String((def ?? addresses[0]!).id)
  }, [addresses])

  const [addressKey, setAddressKey] = useState<string>(initialAddressKey)
  const [phone, setPhone] = useState(defaultPhone)

  // New-address form state
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
  // When the provider initiates an STK push, switch to polling-panel mode.
  const [stkOrderNumber, setStkOrderNumber] = useState<string | null>(null)

  // Once hydrated, if the cart is empty there is nothing to check out for.
  useEffect(() => {
    if (hasHydrated && isEmpty({ lines })) setError(null)
  }, [hasHydrated, lines])

  if (!hasHydrated) {
    return <p className="text-sm text-[hsl(var(--muted-foreground))]">Loading…</p>
  }

  if (isEmpty({ lines })) {
    return (
      <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] px-8 py-16 text-center">
        <p className="text-sm text-[hsl(var(--muted-foreground))]">
          Your cart is empty.
        </p>
        <Link
          href="/shop"
          className="mt-6 inline-block rounded-md border border-[hsl(var(--border))] px-6 py-3 text-xs uppercase tracking-[0.15em]"
        >
          Browse the collection
        </Link>
      </div>
    )
  }

  const subtotal = subtotalMinor({ lines })
  const qty = totalQty({ lines })

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    const usingNew = addressKey === NEW_ADDRESS_KEY
    const body = {
      cartId,
      lines: lines.map((l) =>
        l.kind === 'variant'
          ? {
              kind: 'variant' as const,
              variantId: l.variantId,
              unitPriceMinor: l.unitPriceMinor,
              qty: l.qty,
            }
          : {
              kind: 'bundle' as const,
              bundleId: l.bundleId,
              unitPriceMinor: l.unitPriceMinor,
              qty: l.qty,
            },
      ),
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
      const res = await fetch('/api/checkout/init', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) {
        const base = json?.error ?? 'Checkout failed.'
        const detail = typeof json?.detail === 'string' ? ` (${json.detail})` : ''
        setError(`${base}${detail}`)
        setSubmitting(false)
        return
      }

      // STK push fired, switch to polling panel. `provider` is whichever
      // gateway the init route used (intasend post-2026-06-03 migration);
      // we don't gate on the value — any provider that returns an
      // orderNumber the polling endpoint can resolve is fine.
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

  // STK polling — render the panel exclusively while the payment is
  // pending so the user isn't tempted to re-submit the form. The
  // panel itself owns retry behaviour via /api/intasend/retry-stk —
  // no duplicate orders can be created from "Try again".
  if (stkOrderNumber) {
    return (
      <StkPushPanel
        orderNumber={stkOrderNumber}
        successRedirectUrl={`/checkout/return?ref=${encodeURIComponent(stkOrderNumber)}`}
        amountLabel={formatKes(subtotal + computeProcessingFeeMinor(subtotal))}
      />
    )
  }

  const usingNew = addressKey === NEW_ADDRESS_KEY

  return (
    <form
      onSubmit={onSubmit}
      className="grid grid-cols-1 gap-12 lg:grid-cols-[1fr_22rem]"
    >
      <div className="space-y-10">
        <section>
          <h2 className="text-base font-medium">Shipping address</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Where should we send your order?
          </p>

          {addresses.length > 0 ? (
            <div className="mt-6 space-y-3">
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
                    <span className="block font-medium">
                      {a.recipientName}
                      {a.label ? (
                        <span className="ml-2 text-xs uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                          {a.label}
                        </span>
                      ) : null}
                    </span>
                    <span className="mt-1 block text-[hsl(var(--muted-foreground))]">
                      {a.streetLine1}
                      {a.streetLine2 ? `, ${a.streetLine2}` : ''}
                      {', '}
                      {a.city}
                      {a.region ? `, ${a.region}` : ''} {a.postalCode ?? ''}
                    </span>
                    <span className="mt-1 block text-xs text-[hsl(var(--muted-foreground))]">
                      {a.phone} · {a.countryCode}
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
            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <Field label="Recipient name" required>
                <input
                  type="text"
                  required={usingNew}
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  className={inputCls}
                />
              </Field>
              <Field label="Phone (E.164, e.g. +254712345678)" required>
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
        </section>

        <section>
          <h2 className="text-base font-medium">Contact phone</h2>
          <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
            Used for delivery updates. Override if different from your account.
          </p>
          <div className="mt-4 max-w-sm">
            <input
              type="tel"
              required
              pattern="^\+\d{8,15}$"
              placeholder="+254712345678"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className={inputCls}
            />
          </div>
        </section>
      </div>

      <aside className="self-start rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-6">
        <h2 className="mb-5 text-base font-medium">Order summary</h2>
        <dl className="space-y-3 text-sm">
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Items</dt>
            <dd className="tabular-nums">{qty}</dd>
          </div>
          <div className="flex items-center justify-between">
            <dt className="text-[hsl(var(--muted-foreground))]">Subtotal</dt>
            <dd className="tabular-nums">{formatKes(subtotal)}</dd>
          </div>
          <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">
            <dt>Shipping</dt>
            <dd>Free</dd>
          </div>
          <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">
            <dt>Processing fee</dt>
            <dd className="tabular-nums">
              {formatKes(computeProcessingFeeMinor(subtotal))}
            </dd>
          </div>
        </dl>
        <div className="mt-5 border-t border-[hsl(var(--border))] pt-5">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Total</span>
            <span className="text-xl font-medium tabular-nums">
              {formatKes(subtotal + computeProcessingFeeMinor(subtotal))}
            </span>
          </div>
        </div>
        {error ? (
          <p className="mt-4 rounded-md border border-red-500/40 bg-red-500/10 p-3 text-sm text-red-500">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded-md bg-[hsl(var(--foreground))] px-6 py-3 text-sm font-medium uppercase tracking-[0.15em] text-[hsl(var(--background))] disabled:opacity-50"
        >
          {submitting ? 'Sending M-Pesa prompt…' : 'Pay with M-Pesa'}
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
