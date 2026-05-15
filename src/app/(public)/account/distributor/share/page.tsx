/**
 * Share page — sponsor code, share URLs, server-rendered QR codes, and
 * copy buttons. QR is generated to inline SVG via the `qrcode` package
 * at request time so it stays cache-clean and never depends on a
 * client-side library.
 */

import QRCode from 'qrcode'
import { getCurrentDistributor } from '@/lib/distributors/current'
import { publicEnv } from '@/lib/env'
import { CopyButton } from '@/components/distributors/CopyButton'

export const dynamic = 'force-dynamic'

async function qrSvg(text: string): Promise<string> {
  return QRCode.toString(text, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    margin: 1,
    color: { dark: '#0A0A0A', light: '#FAF7F2' },
  })
}

export default async function SharePage() {
  const me = await getCurrentDistributor()
  if (!me) return null

  const shareUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/?ref=${me.sponsorCode}`
  const signupUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/distributors/signup?ref=${me.sponsorCode}`
  const shortUrl = `${publicEnv.NEXT_PUBLIC_APP_URL}/r/${me.sponsorCode}`

  const [shopQr, signupQr, shortQr] = await Promise.all([
    qrSvg(shareUrl),
    qrSvg(signupUrl),
    qrSvg(shortUrl),
  ])

  return (
    <div className="space-y-8">
      <section className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-8 text-center">
        <p className="text-xs uppercase tracking-[0.3em] text-[hsl(var(--muted-foreground))]">
          Your sponsor code
        </p>
        <p className="mt-3 font-mono text-4xl tracking-wide text-[hsl(var(--primary))]">
          {me.sponsorCode}
        </p>
        <p className="mt-3 text-sm text-[hsl(var(--muted-foreground))]">
          New buyers and recruits who arrive via your link are tied to you
          for attribution and downline credit.
        </p>
      </section>

      <section className="rounded-lg border border-[hsl(var(--primary))]/30 bg-[hsl(var(--muted))] p-5">
        <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
          Pretty share link
        </p>
        <p className="mt-2 break-all font-mono text-sm">{shortUrl}</p>
        <p className="mt-2 text-xs text-[hsl(var(--muted-foreground))]">
          Best for social posts and WhatsApp — unfurls with your branded
          card. Redirects to the homepage with your sponsor code locked in.
        </p>
        <div className="mt-4 grid grid-cols-1 items-center gap-4 md:grid-cols-[10rem_1fr]">
          <div
            className="flex justify-center rounded-md bg-[#FAF7F2] p-3 [&_svg]:h-32 [&_svg]:w-32"
            dangerouslySetInnerHTML={{ __html: shortQr }}
          />
          <div>
            <CopyButton value={shortUrl}>Copy pretty link</CopyButton>
          </div>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
            Shop link
          </p>
          <p className="mt-2 break-all font-mono text-xs">{shareUrl}</p>
          <div
            className="mt-4 flex justify-center rounded-md bg-[#FAF7F2] p-4 [&_svg]:h-40 [&_svg]:w-40"
            dangerouslySetInnerHTML={{ __html: shopQr }}
          />
          <div className="mt-4 flex justify-center">
            <CopyButton value={shareUrl}>Copy shop link</CopyButton>
          </div>
        </div>

        <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))] p-5">
          <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
            Distributor recruit link
          </p>
          <p className="mt-2 break-all font-mono text-xs">{signupUrl}</p>
          <div
            className="mt-4 flex justify-center rounded-md bg-[#FAF7F2] p-4 [&_svg]:h-40 [&_svg]:w-40"
            dangerouslySetInnerHTML={{ __html: signupQr }}
          />
          <div className="mt-4 flex justify-center">
            <CopyButton value={signupUrl}>Copy recruit link</CopyButton>
          </div>
          <p className="mt-3 text-center text-xs text-[hsl(var(--muted-foreground))]">
            Anyone who signs up via this link is locked to you as their
            sponsor — that's how you grow your downline.
          </p>
        </div>
      </section>
    </div>
  )
}
