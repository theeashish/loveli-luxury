/**
 * /r/[code] — shareable short link that lands on the homepage with the
 * sponsor cookie pre-set. Used in social shares, OG-unfurled by the
 * sibling `opengraph-image.tsx` so previews look branded.
 *
 * The middleware already captures `?ref=…` into the `ll_sponsor` cookie;
 * this route just rewrites the URL to `/?ref=CODE` so we share a clean,
 * memorable URL.
 */

import { redirect } from 'next/navigation'

const SPONSOR_RE = /^LL-[A-Z2-9]{2}-[A-Z2-9]{4}$/

export default function ShortShareRedirect({
  params,
}: {
  params: { code: string }
}) {
  const code = (params.code ?? '').toUpperCase()
  if (!SPONSOR_RE.test(code)) {
    redirect('/')
  }
  redirect(`/?ref=${code}`)
}
