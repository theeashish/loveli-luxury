/**
 * Dynamic OG image for /r/[code]. Shows "Join Loveli with [Name]" with
 * the sponsor code, rendered as a branded card so socials unfurl it
 * cleanly. Lookup is best-effort: if we can't resolve the code we still
 * render a sensible default ("Loveli Luxury International").
 */

import { ImageResponse } from 'next/og'
import { createServiceClient } from '@/lib/supabase/service'

export const runtime = 'nodejs'
export const alt = 'Loveli Luxury International — distributor invite'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const SPONSOR_RE = /^LL-[A-Z2-9]{2}-[A-Z2-9]{4}$/

export default async function OgImage({
  params,
}: {
  params: { code: string }
}) {
  const code = (params.code ?? '').toUpperCase()
  let sponsorName: string | null = null

  if (SPONSOR_RE.test(code)) {
    try {
      const service = createServiceClient()
      const r = await service
        .from('distributors')
        .select('user_id, is_active')
        .eq('sponsor_code', code)
        .maybeSingle()
      const dist = r.data as
        | { user_id: string; is_active: boolean }
        | null
      if (dist?.is_active) {
        const p = await service
          .from('profiles')
          .select('full_name')
          .eq('id', dist.user_id)
          .maybeSingle()
        sponsorName = (p.data as { full_name: string } | null)?.full_name ?? null
      }
    } catch {
      // ignore — fall through to the default card
    }
  }

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '70px 80px',
          background:
            'linear-gradient(135deg, #0D0D0D 0%, #1A1408 60%, #0D0D0D 100%)',
          color: '#FFF',
          fontFamily: 'serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
          <div
            style={{
              width: 12,
              height: 12,
              background: '#C9A84C',
              transform: 'rotate(45deg)',
            }}
          />
          <div
            style={{
              color: '#C9A84C',
              fontSize: 16,
              letterSpacing: 6,
              textTransform: 'uppercase',
            }}
          >
            Independent Business Owner Program
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 28,
              letterSpacing: 3,
              textTransform: 'uppercase',
              color: '#8A8070',
              marginBottom: 18,
            }}
          >
            You're invited to join
          </div>
          <div
            style={{
              fontSize: 86,
              lineHeight: 1.05,
              fontWeight: 700,
              color: '#FFF',
              display: 'flex',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            Loveli{' '}
            <span style={{ fontStyle: 'italic', color: '#C9A84C' }}>
              Luxury
            </span>{' '}
            International
          </div>
          {sponsorName ? (
            <div
              style={{
                marginTop: 28,
                fontSize: 26,
                color: '#E8C97A',
              }}
            >
              Sponsored by {sponsorName}
            </div>
          ) : null}
        </div>

        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            color: '#8A8070',
            fontSize: 18,
            letterSpacing: 2,
            textTransform: 'uppercase',
          }}
        >
          <div>theperfumeworld.co.ke</div>
          <div style={{ color: '#C9A84C', fontFamily: 'monospace' }}>{code}</div>
        </div>
      </div>
    ),
    { ...size },
  )
}
