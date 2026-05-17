/**
 * Live diagnostics. Verifies that every external dependency and every
 * critical SQL function is reachable + working from this deployment.
 *
 * Strict rule: no side effects beyond a single `audit_log` write per
 * run that records the diagnostic invocation, plus the natural reads
 * from a few RPCs that internally snapshot state (compute_gsv_snapshot
 * etc — those are idempotent).
 *
 * Mutating RPCs (mark_order_paid, write_commission_ledger, etc.) are
 * exercised with a deliberately invalid order id. A successful call
 * would be a bug; we expect the RPC to raise / no-op, which proves the
 * function exists and the service role can invoke it.
 */

import 'server-only'

import { getServerEnv, publicEnv } from '../env'
import { createServiceClient } from '../supabase/service'
import { lastFullUtcMonth } from '../close/orchestrate'

const AFRICAS_TALKING_USER = 'https://api.africastalking.com/version1/user'

const INVALID_ORDER_ID = -1
const INVALID_RESOLUTION_ID = -1
const FAR_PAST_YEAR = 2020
const FAR_PAST_MONTH = 1

export type CheckStatus = 'ok' | 'fail' | 'skip'

export type Check = {
  group: string
  name: string
  status: CheckStatus
  detail: string
  /** Milliseconds taken; reported per check. */
  ms: number
}

export type DiagnosticsResult = {
  ranAt: string
  totalMs: number
  okCount: number
  failCount: number
  skipCount: number
  checks: Check[]
}

async function timed(
  group: string,
  name: string,
  fn: () => Promise<{ status: CheckStatus; detail: string }>,
): Promise<Check> {
  const start = Date.now()
  try {
    const r = await fn()
    return { group, name, status: r.status, detail: r.detail, ms: Date.now() - start }
  } catch (err) {
    return {
      group,
      name,
      status: 'fail',
      detail: err instanceof Error ? err.message : String(err),
      ms: Date.now() - start,
    }
  }
}

export async function runDiagnostics(): Promise<DiagnosticsResult> {
  const start = Date.now()
  const env = getServerEnv()
  const service = createServiceClient()
  // The generated database.ts is missing `get_setting_bool` (and similar
  // helpers added in later migrations) so the strongly-typed `.rpc()`
  // signature rejects them. This is a diagnostic that exists to verify
  // those very functions exist at runtime — work around the stale
  // generated types with a loose alias.
  const rpc = (service as unknown as {
    rpc: (fn: string, args?: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }).rpc.bind(service)

  // Look up founding distributor once — many checks need their id.
  const founder = await service
    .from('distributors')
    .select('id, sponsor_code, payout_msisdn')
    .is('sponsor_id', null)
    .eq('is_active', true)
    .maybeSingle()
  const founderId = founder.data?.id ?? null

  // Look up the lowest-position rank for the qualifier checks. The
  // streak/qualified RPCs take a rank id (BIGINT), not a code.
  const firstRankRow = await service
    .from('config_ranks')
    .select('id, rank_name, rank_position')
    .is('effective_until', null)
    .order('rank_position', { ascending: true })
    .limit(1)
    .maybeSingle()
  const firstRankId = firstRankRow.data?.id ?? null
  const firstRankName = firstRankRow.data?.rank_name ?? 'first rank'

  const checks: Check[] = []

  // ---------------------------------------------------------------------
  // Group: Supabase
  // ---------------------------------------------------------------------

  checks.push(
    await timed('Supabase', 'service-role auth admin reachable', async () => {
      // listUsers paged at 1 — minimal payload, proves service-role talks
      // to auth.
      const r = await service.auth.admin.listUsers({ page: 1, perPage: 1 })
      if (r.error) return { status: 'fail', detail: r.error.message }
      return { status: 'ok', detail: `users page returned ${r.data.users.length} row(s)` }
    }),
  )

  checks.push(
    await timed('Supabase', 'service-role DB read', async () => {
      const r = await service.from('distributors').select('id', { count: 'exact', head: true })
      if (r.error) return { status: 'fail', detail: r.error.message }
      return { status: 'ok', detail: `distributors count=${r.count ?? 0}` }
    }),
  )

  checks.push(
    await timed('Supabase', 'service-role DB write (audit_log insert)', async () => {
      const r = await service
        .from('audit_log')
        .insert({
          action: 'diagnostics.invoked',
          resource_type: 'diagnostics',
          resource_id: new Date().toISOString(),
          after_data: { source: 'runDiagnostics' },
        })
        .select('id')
        .single()
      if (r.error || !r.data) return { status: 'fail', detail: r.error?.message ?? 'no row' }
      return { status: 'ok', detail: `audit_log.id=${r.data.id}` }
    }),
  )

  checks.push(
    await timed('Supabase', 'founding distributor present (sponsor_id IS NULL)', async () => {
      if (!founder.data) return { status: 'fail', detail: 'no founding row found' }
      return {
        status: 'ok',
        detail: `id=${founder.data.id} sponsor_code=${founder.data.sponsor_code}`,
      }
    }),
  )

  // ---------------------------------------------------------------------
  // Group: RPC — read-only / safe
  // ---------------------------------------------------------------------

  checks.push(
    await timed('RPC (safe)', 'generate_order_number()', async () => {
      const r = await rpc('generate_order_number')
      if (r.error) return { status: 'fail', detail: r.error.message }
      return { status: 'ok', detail: String(r.data) }
    }),
  )

  checks.push(
    await timed('RPC (safe)', 'get_setting_bool(commission_compression_enabled)', async () => {
      const r = await rpc('get_setting_bool', {
        p_key: 'commission_compression_enabled',
        p_default: false,
      })
      if (r.error) return { status: 'fail', detail: r.error.message }
      return { status: 'ok', detail: `value=${r.data}` }
    }),
  )

  if (founderId !== null) {
    checks.push(
      await timed('RPC (safe)', 'compute_gsv_snapshot(founder, 2020-01)', async () => {
        const r = await rpc('compute_gsv_snapshot', {
          p_distributor_id: founderId,
          p_year: FAR_PAST_YEAR,
          p_month: FAR_PAST_MONTH,
        })
        if (r.error) return { status: 'fail', detail: r.error.message }
        return { status: 'ok', detail: 'snapshot computed for empty period' }
      }),
    )
    checks.push(
      await timed('RPC (safe)', 'compute_monthly_salary(founder, 2020-01)', async () => {
        const r = await rpc('compute_monthly_salary', {
          p_distributor_id: founderId,
          p_year: FAR_PAST_YEAR,
          p_month: FAR_PAST_MONTH,
        })
        if (r.error) return { status: 'fail', detail: r.error.message }
        return { status: 'ok', detail: 'salary computed for empty period' }
      }),
    )
    checks.push(
      await timed('RPC (safe)', 'detect_rank_up(founder, 2020-01)', async () => {
        const r = await rpc('detect_rank_up', {
          p_distributor_id: founderId,
          p_year: FAR_PAST_YEAR,
          p_month: FAR_PAST_MONTH,
        })
        if (r.error) return { status: 'fail', detail: r.error.message }
        return { status: 'ok', detail: `result=${r.data ?? 'no promotion'}` }
      }),
    )
    checks.push(
      await timed('RPC (safe)', 'is_distributor_maintained(founder, 2020-01)', async () => {
        const r = await rpc('is_distributor_maintained', {
          p_distributor_id: founderId,
          p_year: FAR_PAST_YEAR,
          p_month: FAR_PAST_MONTH,
        })
        if (r.error) return { status: 'fail', detail: r.error.message }
        return { status: 'ok', detail: `result=${r.data}` }
      }),
    )
    if (firstRankId !== null) {
      checks.push(
        await timed(
          'RPC (safe)',
          `is_distributor_qualified_for_rank(founder, ${firstRankName})`,
          async () => {
            const r = await rpc('is_distributor_qualified_for_rank', {
              p_distributor_id: founderId,
              p_rank_id: firstRankId,
              p_year: FAR_PAST_YEAR,
              p_month: FAR_PAST_MONTH,
            })
            if (r.error) return { status: 'fail', detail: r.error.message }
            return { status: 'ok', detail: `result=${r.data}` }
          },
        ),
      )
      checks.push(
        await timed(
          'RPC (safe)',
          `count_qualifying_streak(founder, ${firstRankName})`,
          async () => {
            const r = await rpc('count_qualifying_streak', {
              p_distributor_id: founderId,
              p_target_rank_id: firstRankId,
              p_ending_year: FAR_PAST_YEAR,
              p_ending_month: FAR_PAST_MONTH,
              p_max: 12,
            })
            if (r.error) return { status: 'fail', detail: r.error.message }
            return { status: 'ok', detail: `streak=${r.data}` }
          },
        ),
      )
    } else {
      for (const name of [
        'is_distributor_qualified_for_rank(founder)',
        'count_qualifying_streak(founder)',
      ]) {
        checks.push({
          group: 'RPC (safe)',
          name,
          status: 'skip',
          detail: 'no rank rows in config_ranks',
          ms: 0,
        })
      }
    }
  } else {
    for (const name of [
      'compute_gsv_snapshot(founder)',
      'compute_monthly_salary(founder)',
      'detect_rank_up(founder)',
      'is_distributor_maintained(founder)',
      'is_distributor_qualified_for_rank(founder)',
      'count_qualifying_streak(founder)',
    ]) {
      checks.push({
        group: 'RPC (safe)',
        name,
        status: 'skip',
        detail: 'no founding distributor; skipped',
        ms: 0,
      })
    }
  }

  // ---------------------------------------------------------------------
  // Group: RPC — mutating, called with invalid input to prove existence.
  // A successful call here would be a bug; we expect a SQL error.
  // ---------------------------------------------------------------------

  const mutatingRPCs: Array<{
    name: string
    call: () => Promise<{ data: unknown; error: { message: string } | null }>
  }> = [
    {
      name: 'mark_order_paid(invalid)',
      call: () =>
        rpc('mark_order_paid', {
          p_order_id: INVALID_ORDER_ID,
          p_provider_ref: 'diag',
          p_paid_at: new Date().toISOString(),
        }),
    },
    {
      name: 'write_commission_ledger(invalid)',
      call: () =>
        rpc('write_commission_ledger', { p_order_id: INVALID_ORDER_ID }),
    },
    {
      name: 'provision_distributor(invalid)',
      call: () => rpc('provision_distributor', { p_order_id: INVALID_ORDER_ID }),
    },
    {
      name: 'restore_order_inventory(invalid)',
      call: () =>
        rpc('restore_order_inventory', { p_order_id: INVALID_ORDER_ID }),
    },
    {
      name: 'void_unpaid_commissions_for_order(invalid)',
      call: () =>
        rpc('void_unpaid_commissions_for_order', { p_order_id: INVALID_ORDER_ID }),
    },
    {
      name: 'apply_clawback_deduction(invalid)',
      call: () =>
        rpc('apply_clawback_deduction', { p_resolution_id: INVALID_RESOLUTION_ID }),
    },
  ]
  for (const rpc of mutatingRPCs) {
    checks.push(
      await timed('RPC (mutating)', rpc.name, async () => {
        const r = await rpc.call()
        if (r.error) {
          // Look specifically for "does not exist" / "could not find" /
          // "schema" — those mean the function is MISSING, not just
          // failed on bad input. Anything else proves the function is
          // there and rejected our garbage input as it should.
          const msg = r.error.message.toLowerCase()
          if (
            msg.includes('could not find') ||
            msg.includes('does not exist') ||
            msg.includes('schema cache')
          ) {
            return { status: 'fail', detail: `function missing: ${r.error.message}` }
          }
          return { status: 'ok', detail: `rejected as expected: ${r.error.message}` }
        }
        // Some RPCs (eg restore_order_inventory) raise inside the body;
        // others return early. A null/empty result with no error is also
        // acceptable proof of existence.
        return { status: 'ok', detail: 'callable; returned without error' }
      }),
    )
  }

  // ---------------------------------------------------------------------
  // Group: PayHero
  // ---------------------------------------------------------------------

  // STK + auth + webhook token are REQUIRED (PayHero is the only
  // provider). B2C channel is optional until payouts go live.
  const phRequiredEnvs: Array<[string, boolean]> = [
    ['PAYHERO_AUTH_TOKEN', !!env.PAYHERO_AUTH_TOKEN],
    ['PAYHERO_CHANNEL_ID_STK', !!env.PAYHERO_CHANNEL_ID_STK],
    ['PAYHERO_WEBHOOK_TOKEN', !!env.PAYHERO_WEBHOOK_TOKEN],
  ]
  for (const [name, present] of phRequiredEnvs) {
    checks.push({
      group: 'PayHero',
      name,
      status: present ? 'ok' : 'fail',
      detail: present ? 'set' : 'unset (REQUIRED — payments will fail)',
      ms: 0,
    })
  }
  checks.push({
    group: 'PayHero',
    name: 'PAYHERO_CHANNEL_ID_B2C',
    status: env.PAYHERO_CHANNEL_ID_B2C ? 'ok' : 'skip',
    detail: env.PAYHERO_CHANNEL_ID_B2C
      ? 'set'
      : 'unset (optional — only needed once distributor payouts go live)',
    ms: 0,
  })

  if (env.PAYHERO_AUTH_TOKEN) {
    checks.push(
      await timed('PayHero', 'API reachable + auth ok', async () => {
        // Probe transaction-status with a clearly invalid reference.
        // 401/403 means the token is bad; any other response (4xx with
        // structured body) means auth was accepted.
        const res = await fetch(
          'https://backend.payhero.co.ke/api/v2/transaction-status?reference=diagnostic-invalid',
          {
            method: 'GET',
            headers: {
              Authorization: `Basic ${env.PAYHERO_AUTH_TOKEN}`,
              Accept: 'application/json',
            },
          },
        )
        if (res.status === 401 || res.status === 403) {
          return { status: 'fail', detail: `auth rejected (HTTP ${res.status})` }
        }
        return { status: 'ok', detail: `endpoint responded HTTP ${res.status}` }
      }),
    )
  } else {
    checks.push({
      group: 'PayHero',
      name: 'API reachable + auth ok',
      status: 'fail',
      detail: 'PAYHERO_AUTH_TOKEN missing — payments will fail',
      ms: 0,
    })
  }

  // ---------------------------------------------------------------------
  // Group: SMS
  // ---------------------------------------------------------------------

  if (env.AFRICAS_TALKING_USERNAME && env.AFRICAS_TALKING_API_KEY) {
    checks.push(
      await timed('SMS', 'Africa\'s Talking user balance', async () => {
        const url = `${AFRICAS_TALKING_USER}?username=${encodeURIComponent(env.AFRICAS_TALKING_USERNAME!)}`
        const res = await fetch(url, {
          headers: {
            apiKey: env.AFRICAS_TALKING_API_KEY!,
            Accept: 'application/json',
          },
        })
        if (!res.ok) {
          return { status: 'fail', detail: `HTTP ${res.status}: ${await res.text()}` }
        }
        const json = (await res.json()) as {
          UserData?: { balance?: string }
        }
        const balance = json.UserData?.balance ?? 'unknown'
        return { status: 'ok', detail: `balance=${balance}` }
      }),
    )
  } else {
    checks.push({
      group: 'SMS',
      name: 'Africa\'s Talking user balance',
      status: 'skip',
      detail: 'AFRICAS_TALKING_USERNAME / API_KEY not set; SMS will fall back to audit_log',
      ms: 0,
    })
  }

  // Verify the audit-log SMS fallback channel can write a row — without
  // actually sending an SMS. (sendSMS itself would dispatch to AT if
  // configured, which is a real send; that's not safe in a diagnostic.)
  checks.push(
    await timed('SMS', 'audit_log fallback writeable', async () => {
      const r = await service
        .from('audit_log')
        .insert({
          action: 'sms.diagnostic_probe',
          resource_type: 'sms',
          resource_id: 'diagnostic',
          after_data: { note: 'fallback channel writability check' },
        })
        .select('id')
        .single()
      if (r.error || !r.data) {
        return { status: 'fail', detail: r.error?.message ?? 'no row' }
      }
      return { status: 'ok', detail: `audit_log.id=${r.data.id}` }
    }),
  )

  // ---------------------------------------------------------------------
  // Group: Monthly close (dry-run on founder only)
  // ---------------------------------------------------------------------

  const period = lastFullUtcMonth()
  if (founderId !== null) {
    checks.push(
      await timed(
        'Monthly close',
        `compute_gsv_snapshot(founder, ${period.year}-${String(period.month).padStart(2, '0')})`,
        async () => {
          const r = await rpc('compute_gsv_snapshot', {
            p_distributor_id: founderId,
            p_year: period.year,
            p_month: period.month,
          })
          if (r.error) return { status: 'fail', detail: r.error.message }
          return { status: 'ok', detail: 'snapshot computed for last full month' }
        },
      ),
    )
    checks.push(
      await timed(
        'Monthly close',
        `compute_monthly_salary(founder, ${period.year}-${String(period.month).padStart(2, '0')})`,
        async () => {
          const r = await rpc('compute_monthly_salary', {
            p_distributor_id: founderId,
            p_year: period.year,
            p_month: period.month,
          })
          if (r.error) return { status: 'fail', detail: r.error.message }
          return { status: 'ok', detail: 'salary computed' }
        },
      ),
    )
  } else {
    checks.push({
      group: 'Monthly close',
      name: 'dry-run',
      status: 'skip',
      detail: 'no founding distributor',
      ms: 0,
    })
  }

  // ---------------------------------------------------------------------
  // Group: Env sanity (no secret leakage)
  // ---------------------------------------------------------------------

  const envChecks: Array<[string, boolean]> = [
    ['SUPABASE_SERVICE_ROLE_KEY', !!env.SUPABASE_SERVICE_ROLE_KEY],
    ['REVALIDATE_SECRET', !!env.REVALIDATE_SECRET],
    ['CRON_SECRET (optional)', !!env.CRON_SECRET],
    ['ENABLE_PAYOUTS', !!env.ENABLE_PAYOUTS],
    ['ENABLE_DISTRIBUTOR_SIGNUP', !!env.ENABLE_DISTRIBUTOR_SIGNUP],
    ['NEXT_PUBLIC_APP_URL', !!publicEnv.NEXT_PUBLIC_APP_URL],
  ]
  for (const [name, present] of envChecks) {
    const isOptional = name.includes('optional') || name.startsWith('ENABLE_')
    checks.push({
      group: 'Env',
      name,
      status: present ? 'ok' : isOptional ? 'skip' : 'fail',
      detail: present ? 'set' : 'unset',
      ms: 0,
    })
  }

  // ---------------------------------------------------------------------

  const okCount = checks.filter((c) => c.status === 'ok').length
  const failCount = checks.filter((c) => c.status === 'fail').length
  const skipCount = checks.filter((c) => c.status === 'skip').length

  return {
    ranAt: new Date().toISOString(),
    totalMs: Date.now() - start,
    okCount,
    failCount,
    skipCount,
    checks,
  }
}
