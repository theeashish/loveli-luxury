/**
 * /account/distributor/settings/verify — enter the SMS code to confirm a
 * proposed payout MSISDN change. The code TTL is 15 minutes; after 5
 * failed attempts the row locks and the distributor must request a
 * fresh code from the settings page.
 */

import Link from 'next/link'
import { redirect } from 'next/navigation'
import { getCurrentDistributor } from '@/lib/distributors/current'
import { createServiceClient } from '@/lib/supabase/service'
import { confirmMsisdnCode } from '../actions'

export const dynamic = 'force-dynamic'

type VerifyRow = {
  msisdn: string
  expires_at: string
  attempts: number
}

export default async function VerifyMsisdnPage() {
  const me = await getCurrentDistributor()
  if (!me) return null

  const service = createServiceClient()
  const r = await service
    .from('msisdn_verifications')
    .select('msisdn, expires_at, attempts')
    .eq('distributor_id', me.id)
    .is('used_at', null)
    .maybeSingle()
  const ver = (r.data as VerifyRow | null) ?? null

  // If there's no pending verification at all, send them back to settings.
  if (!ver) redirect('/account/distributor/settings')

  const expired = new Date(ver.expires_at).getTime() <= Date.now()

  return (
    <div className="max-w-md">
      <h2 className="text-base font-medium">Verify your M-Pesa number</h2>
      <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
        We sent a 6-digit code to{' '}
        <span className="font-mono">{ver.msisdn}</span>. Enter it below to
        switch your payout number.
      </p>

      {expired ? (
        <div className="mt-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          The code has expired. Go back to{' '}
          <Link
            href="/account/distributor/settings"
            className="font-medium underline"
          >
            settings
          </Link>{' '}
          and request a new one.
        </div>
      ) : (
        <form action={confirmMsisdnCode} className="mt-6 space-y-3">
          <label className="block">
            <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
              6-digit code
            </span>
            <input
              type="text"
              name="code"
              required
              inputMode="numeric"
              pattern="\d{6}"
              maxLength={6}
              placeholder="000000"
              className="w-full rounded-md border border-[hsl(var(--border))] bg-transparent px-3 py-2 text-center font-mono text-lg tracking-[0.4em] focus:border-[hsl(var(--primary))] focus:outline-none"
            />
          </label>
          <button
            type="submit"
            className="rounded-md bg-[hsl(var(--primary))] px-5 py-2.5 text-xs uppercase tracking-[0.15em] text-[hsl(var(--primary-foreground))]"
          >
            Verify
          </button>
          <p className="text-[10px] text-[hsl(var(--muted-foreground))]">
            Attempts used: {ver.attempts} / 5
          </p>
        </form>
      )}

      <Link
        href="/account/distributor/settings"
        className="mt-6 inline-block text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))] hover:text-[hsl(var(--primary))]"
      >
        ← Back to settings
      </Link>
    </div>
  )
}
