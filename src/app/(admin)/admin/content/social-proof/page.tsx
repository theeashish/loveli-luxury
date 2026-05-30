/**
 * /admin/content/social-proof
 *
 * CRUD for the homepage social-proof CMS (migration 026): customer reviews
 * ("In their words") and press / creator features ("As featured"). Plain
 * server-action forms — no client JS. Published reviews render on the
 * homepage; press features render only when at least one is published.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { createServiceClient } from '@/lib/supabase/service'
import {
  createReview,
  deleteReview,
  toggleReviewPublished,
  reassignReviewProduct,
  createPress,
  deletePress,
  togglePressPublished,
} from './actions'

export const metadata = { title: 'Social proof', robots: { index: false } }
export const dynamic = 'force-dynamic'

type ReviewRow = {
  id: number
  quote: string
  author_name: string
  author_city: string | null
  position: number
  is_published: boolean
  product_id: number | null
}
type PressRow = {
  id: number
  name: string
  url: string | null
  position: number
  is_published: boolean
}
type ProductOption = { id: number; name: string }

export default async function SocialProofAdminPage() {
  const db = createServiceClient() as unknown as SupabaseClient

  const rRes = await db
    .from('homepage_reviews')
    .select('id, quote, author_name, author_city, position, is_published, product_id')
    .order('position', { ascending: true })
  const pRes = await db
    .from('press_features')
    .select('id, name, url, position, is_published')
    .order('position', { ascending: true })
  const prodRes = await db
    .from('products')
    .select('id, name')
    .eq('is_active', true)
    .order('name', { ascending: true })

  const tableMissing = Boolean(rRes.error || pRes.error)
  const reviews = (rRes.data ?? []) as ReviewRow[]
  const press = (pRes.data ?? []) as PressRow[]
  const products = (prodRes.data ?? []) as ProductOption[]
  const productNameById = new Map(products.map((p) => [p.id, p.name]))

  const inputCls =
    'rounded border border-neutral-300 px-3 py-2 text-sm text-neutral-900'

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-8">
        <p className="text-eyebrow text-neutral-500">Content</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          Social proof
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          Manage the homepage customer reviews (&ldquo;In their words&rdquo;)
          and press / creator features (&ldquo;As featured&rdquo;). Published
          reviews appear on the homepage; an empty published set hides the
          section. Press features show only when at least one is published.
          Lower <code>position</code> sorts first.
        </p>
      </header>

      {tableMissing ? (
        <div className="mb-8 rounded-lg border border-amber-300 bg-amber-50 p-6 text-sm text-amber-900">
          The <code>homepage_reviews</code> / <code>press_features</code> tables
          don&apos;t exist yet. Apply migration{' '}
          <code>026_homepage_social_proof.sql</code> in Supabase (SQL editor or{' '}
          <code>supabase db push</code>), then reload. Until then the homepage
          shows the seeded placeholder reviews.
        </div>
      ) : null}

      {/* ── Reviews ─────────────────────────────────────────────────────── */}
      <section className="mb-12">
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">
          Customer reviews
        </h2>
        <ul className="space-y-3">
          {reviews.map((r) => {
            const attachedTo =
              r.product_id === null
                ? 'Homepage carousel'
                : productNameById.get(r.product_id)
                  ? `On PDP: ${productNameById.get(r.product_id)}`
                  : `On PDP: product #${r.product_id} (not found)`
            return (
              <li
                key={r.id}
                className="rounded-lg border border-neutral-200 bg-white p-4"
              >
                <p className="text-sm text-neutral-800">&ldquo;{r.quote}&rdquo;</p>
                <p className="mt-2 text-xs text-neutral-500">
                  {r.author_name}
                  {r.author_city ? ` · ${r.author_city}` : ''} · position{' '}
                  {r.position} · {r.is_published ? 'published' : 'hidden'} ·{' '}
                  <span className="font-medium text-neutral-700">{attachedTo}</span>
                </p>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <form action={toggleReviewPublished}>
                    <input type="hidden" name="id" defaultValue={r.id} />
                    <input
                      type="hidden"
                      name="next"
                      defaultValue={String(!r.is_published)}
                    />
                    <button className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-100">
                      {r.is_published ? 'Hide' : 'Publish'}
                    </button>
                  </form>
                  <form action={deleteReview}>
                    <input type="hidden" name="id" defaultValue={r.id} />
                    <button className="rounded border border-rose-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50">
                      Delete
                    </button>
                  </form>
                  <form action={reassignReviewProduct} className="flex items-center gap-1">
                    <input type="hidden" name="id" defaultValue={r.id} />
                    <label className="text-xs text-neutral-500" htmlFor={`reassign-${r.id}`}>
                      Move to:
                    </label>
                    <select
                      id={`reassign-${r.id}`}
                      name="productId"
                      defaultValue={r.product_id === null ? '' : String(r.product_id)}
                      className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-900"
                    >
                      <option value="">Homepage carousel</option>
                      {products.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <button className="rounded border border-neutral-300 px-2 py-1 text-xs text-neutral-700 hover:bg-neutral-100">
                      Save
                    </button>
                  </form>
                </div>
              </li>
            )
          })}
          {reviews.length === 0 && !tableMissing ? (
            <li className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
              No reviews yet. Add one below — the homepage section stays hidden
              until a review is published.
            </li>
          ) : null}
        </ul>

        <form
          action={createReview}
          className="mt-5 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
        >
          <p className="text-sm font-medium text-neutral-900">Add a review</p>
          <textarea
            name="quote"
            required
            maxLength={600}
            rows={3}
            placeholder="Quote"
            className={`${inputCls} w-full`}
          />
          <div className="flex flex-wrap gap-3">
            <input
              name="authorName"
              required
              maxLength={80}
              placeholder="Name / initials (e.g. A. M.)"
              className={`${inputCls} flex-1`}
            />
            <input
              name="authorCity"
              maxLength={80}
              placeholder="City (optional)"
              className={`${inputCls} flex-1`}
            />
            <input
              name="position"
              type="number"
              min={0}
              defaultValue={0}
              className={`${inputCls} w-24`}
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-neutral-500" htmlFor="new-review-product">
              Attach to (leave on &ldquo;Homepage carousel&rdquo; to render on the home page)
            </label>
            <select
              id="new-review-product"
              name="productId"
              defaultValue=""
              className={`${inputCls} w-full`}
            >
              <option value="">Homepage carousel</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  On PDP: {p.name}
                </option>
              ))}
            </select>
          </div>
          <button className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Add review
          </button>
        </form>
      </section>

      {/* ── Press / creator features ────────────────────────────────────── */}
      <section>
        <h2 className="mb-4 text-lg font-semibold text-neutral-900">
          Press / creator features
        </h2>
        <ul className="space-y-3">
          {press.map((p) => (
            <li
              key={p.id}
              className="flex items-center justify-between gap-4 rounded-lg border border-neutral-200 bg-white p-4"
            >
              <div className="min-w-0">
                <p className="truncate text-sm text-neutral-800">{p.name}</p>
                <p className="mt-1 truncate text-xs text-neutral-500">
                  {p.url ?? 'no link'} · position {p.position} ·{' '}
                  {p.is_published ? 'published' : 'hidden'}
                </p>
              </div>
              <div className="flex flex-none gap-2">
                <form action={togglePressPublished}>
                  <input type="hidden" name="id" defaultValue={p.id} />
                  <input
                    type="hidden"
                    name="next"
                    defaultValue={String(!p.is_published)}
                  />
                  <button className="rounded border border-neutral-300 px-3 py-1 text-xs text-neutral-700 hover:bg-neutral-100">
                    {p.is_published ? 'Hide' : 'Publish'}
                  </button>
                </form>
                <form action={deletePress}>
                  <input type="hidden" name="id" defaultValue={p.id} />
                  <button className="rounded border border-rose-300 px-3 py-1 text-xs text-rose-700 hover:bg-rose-50">
                    Delete
                  </button>
                </form>
              </div>
            </li>
          ))}
          {press.length === 0 && !tableMissing ? (
            <li className="rounded-lg border border-dashed border-neutral-300 p-4 text-sm text-neutral-500">
              No press features yet. The &ldquo;As featured&rdquo; band stays
              hidden until you publish one.
            </li>
          ) : null}
        </ul>

        <form
          action={createPress}
          className="mt-5 space-y-3 rounded-lg border border-neutral-200 bg-neutral-50 p-4"
        >
          <p className="text-sm font-medium text-neutral-900">
            Add a press / creator feature
          </p>
          <div className="flex flex-wrap gap-3">
            <input
              name="name"
              required
              maxLength={120}
              placeholder="Publication or creator name"
              className={`${inputCls} flex-1`}
            />
            <input
              name="url"
              maxLength={500}
              placeholder="https://… (optional)"
              className={`${inputCls} flex-1`}
            />
            <input
              name="position"
              type="number"
              min={0}
              defaultValue={0}
              className={`${inputCls} w-24`}
            />
          </div>
          <button className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
            Add feature
          </button>
        </form>
      </section>
    </div>
  )
}
