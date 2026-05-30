import { listBundles } from '@/lib/catalog/queries'
import { BundleHighlight } from '@/components/catalog/BundleHighlight'

// Catalog reads use the auth-bound Supabase client (cookies()), which
// is incompatible with static generation. Render fresh per request.
export const dynamic = 'force-dynamic'
export const metadata = {
  title: 'Bundles',
  description: 'Curated combos and starter packages from Loveli Luxury.',
}

export default async function BundlesIndexPage() {
  const bundles = await listBundles()

  return (
    <div className="mx-auto max-w-6xl px-6 py-16">
      <header className="mb-12">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--primary))]">Bundles</p>
        <h1 className="mt-2 text-4xl font-light tracking-tight">Curated together</h1>
        <p className="mt-4 max-w-xl text-sm text-[hsl(var(--muted-foreground))]">
          {bundles.length === 0
            ? 'No bundles available right now.'
            : 'Hand-picked combinations that work together, at a price below the sum of their parts.'}
        </p>
      </header>

      {bundles.length === 0 ? null : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {bundles.map((b) => (
            <BundleHighlight key={b.id} bundle={b} />
          ))}
        </div>
      )}
    </div>
  )
}
