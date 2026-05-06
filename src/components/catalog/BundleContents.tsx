import Link from 'next/link'
import { formatKes } from '@/lib/money'
import type { BundleDto } from '@/lib/catalog/types'

export function BundleContents({ bundle }: { bundle: BundleDto }) {
  const retail = BigInt(bundle.retailPriceMinor)
  const ala = BigInt(bundle.alaCarteTotalMinor)
  const savings = ala > retail ? ala - retail : 0n

  return (
    <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]">
      <header className="border-b border-[hsl(var(--border))] px-6 py-5">
        <h2 className="text-lg font-medium text-[hsl(var(--foreground))]">What&apos;s inside</h2>
        <p className="mt-1 text-sm text-[hsl(var(--muted-foreground))]">
          {bundle.items.length} item{bundle.items.length === 1 ? '' : 's'} curated to work
          together.
        </p>
      </header>

      <ul className="divide-y divide-[hsl(var(--border))]">
        {bundle.items.map((it) => {
          const lineTotal = BigInt(it.unitRetailPriceMinor) * BigInt(it.quantity)
          return (
            <li key={it.variantId} className="flex items-center gap-4 px-6 py-4">
              <div className="flex-1">
                <Link
                  href={`/p/${it.productSlug}`}
                  className="text-base font-medium text-[hsl(var(--foreground))] hover:text-[hsl(var(--primary))]"
                >
                  {it.productName}
                </Link>
                <p className="mt-0.5 text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  {it.sizeMl}ml · qty {it.quantity}
                </p>
              </div>
              <p className="text-sm tabular-nums text-[hsl(var(--muted-foreground))]">
                {formatKes(lineTotal)}
              </p>
            </li>
          )
        })}
      </ul>

      <footer className="space-y-2 border-t border-[hsl(var(--border))] px-6 py-5 text-sm">
        <div className="flex items-center justify-between text-[hsl(var(--muted-foreground))]">
          <span>À-la-carte total</span>
          <span className="tabular-nums line-through">{formatKes(ala)}</span>
        </div>
        <div className="flex items-center justify-between text-[hsl(var(--foreground))]">
          <span className="font-medium">Bundle price</span>
          <span className="text-lg font-medium tabular-nums">{formatKes(retail)}</span>
        </div>
        {savings > 0n ? (
          <div className="flex items-center justify-between border-t border-[hsl(var(--border))] pt-3 text-[hsl(var(--accent))]">
            <span className="text-xs uppercase tracking-[0.15em]">You save</span>
            <span className="tabular-nums">{formatKes(savings)}</span>
          </div>
        ) : null}
      </footer>
    </section>
  )
}
