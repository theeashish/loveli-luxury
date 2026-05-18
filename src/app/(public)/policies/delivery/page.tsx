import Link from 'next/link'

export const metadata = {
  title: 'Delivery — Loveli Luxury',
  description:
    'How long fragrances take to reach you in Kenya, by region. Tracking and rider details.',
}

/**
 * Delivery zones + realistic times. Kenya-specific. Numbers are
 * conservative defaults — refine in the file or have the owner edit.
 */

const ZONES: ReadonlyArray<{ label: string; window: string }> = [
  { label: 'Nairobi metro (CBD, Westlands, Kilimani, Kileleshwa, Karen, Lavington, Eastlands)', window: '24–48 hours' },
  { label: 'Kiambu, Machakos, Kajiado (peri-Nairobi)', window: '24–72 hours' },
  { label: 'Mombasa, Kisumu, Nakuru, Eldoret (major cities)', window: '2–3 business days' },
  { label: 'Western Kenya: Kakamega, Kisii, Bungoma, Busia', window: '2–4 business days' },
  { label: 'Coastal towns, Mt. Kenya region, Rift Valley counties', window: '3–5 business days' },
  { label: 'Far-flung counties (Lodwar, Mandera, Lamu, Marsabit)', window: '4–7 business days' },
]

export default function DeliveryPolicy() {
  return (
    <>
      <h2 className="font-serif text-3xl tracking-tight md:text-4xl">
        Honest timelines, real couriers.
      </h2>

      <p className="mt-6 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        We dispatch from Nairobi the same day if your order is paid and confirmed
        before 14:00 EAT, the next morning otherwise. From there, time depends on
        where you are. The table below reflects what we actually see — not the
        marketing version.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        By region
      </h3>
      <div className="mt-4 overflow-hidden rounded-lg border border-[hsl(var(--border))]/60">
        <table className="min-w-full divide-y divide-[hsl(var(--border))]/40 text-sm">
          <thead className="bg-[hsl(var(--muted))]/40 text-left text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
            <tr>
              <th className="px-5 py-3">Where you are</th>
              <th className="px-5 py-3">Expect</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[hsl(var(--border))]/30">
            {ZONES.map((z) => (
              <tr key={z.label}>
                <td className="px-5 py-3 text-[hsl(var(--foreground))]">{z.label}</td>
                <td className="px-5 py-3 text-[hsl(var(--muted-foreground))]">{z.window}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        Couriers we use
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Within Nairobi metro: motorcycle riders, contactless drop, signed receipt.
        Across counties: G4S Courier or Wells Fargo. Far-flung addresses:
        Posta EMS with G4S last-mile where available. We pick the route that
        actually delivers — not the cheapest one — and absorb the difference.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        Tracking
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Every order gets a unique order number (looks like{' '}
        <span className="font-mono text-[hsl(var(--foreground))]">LL-2026-000123</span>).
        Visit{' '}
        <Link
          href="/track"
          className="text-[hsl(var(--primary))] underline-offset-4 hover:underline"
        >
          loveli-luxury.vercel.app/track/&lt;your-order-number&gt;
        </Link>{' '}
        any time to see status, courier reference, and expected delivery. No
        login required — the order number is enough.
      </p>

      <h3 className="mt-10 font-serif text-2xl italic text-[hsl(var(--foreground))]">
        If a delivery is late
      </h3>
      <p className="mt-3 text-base leading-relaxed text-[hsl(var(--muted-foreground))]">
        Ping our <span className="text-[hsl(var(--foreground))]">Concierge</span>{' '}
        on WhatsApp with the order number. We chase the courier and reroute on
        our side; you don't sit on hold. If your delivery is more than 48 hours
        beyond the window above, we waive the next dispatch fee on your next
        order.
      </p>
    </>
  )
}
