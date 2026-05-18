/**
 * Server-only helper for resolving the current user's distributor record.
 *
 * Used by the /account/partner/* portal pages and their layout. The
 * layout enforces the gate (redirect to signup if no row exists); the
 * pages call this again to read identity + rank when rendering. Two
 * round-trips per request are cheap; the alternative (passing the row
 * down through context across server boundaries) is harder.
 */

import 'server-only'

import { createClient } from '../supabase/server'
import { createServiceClient } from '../supabase/service'

export type CurrentDistributor = {
  id: number
  userId: string
  sponsorCode: string
  sponsorId: number | null
  isActive: boolean
  currentRankId: number | null
  currentRankName: string | null
  currentRankPosition: number | null
  currentRankEmoji: string | null
  payoutMsisdn: string | null
  starterPaidAt: string | null
}

export async function getCurrentDistributor(): Promise<CurrentDistributor | null> {
  const supabase = createClient()
  // getSession() (local cookie read) — getUser() can return null on
  // Vercel Edge even when the user is signed in, which caused a loop
  // between /account/partner and /partners/signup. See the
  // long note on /app/(public)/partners/signup/page.tsx.
  const {
    data: { session },
  } = await supabase.auth.getSession()
  const user = session?.user
  if (!user) return null

  const service = createServiceClient()
  const r = await service
    .from('distributors')
    .select(
      'id, user_id, sponsor_code, sponsor_id, is_active, current_rank_id, payout_msisdn, starter_paid_at',
    )
    .eq('user_id', user.id)
    .maybeSingle()

  const row = r.data as
    | {
        id: number
        user_id: string
        sponsor_code: string
        sponsor_id: number | null
        is_active: boolean
        current_rank_id: number | null
        payout_msisdn: string | null
        starter_paid_at: string | null
      }
    | null
  if (!row) return null

  let rankName: string | null = null
  let rankPosition: number | null = null
  let rankEmoji: string | null = null
  if (row.current_rank_id) {
    const rk = await service
      .from('config_ranks')
      .select('rank_name, rank_position, emoji')
      .eq('id', row.current_rank_id)
      .maybeSingle()
    const rkRow = rk.data as
      | { rank_name: string; rank_position: number; emoji: string | null }
      | null
    if (rkRow) {
      rankName = rkRow.rank_name
      rankPosition = rkRow.rank_position
      rankEmoji = rkRow.emoji
    }
  }

  return {
    id: row.id,
    userId: row.user_id,
    sponsorCode: row.sponsor_code,
    sponsorId: row.sponsor_id,
    isActive: row.is_active,
    currentRankId: row.current_rank_id,
    currentRankName: rankName,
    currentRankPosition: rankPosition,
    currentRankEmoji: rankEmoji,
    payoutMsisdn: row.payout_msisdn,
    starterPaidAt: row.starter_paid_at,
  }
}
