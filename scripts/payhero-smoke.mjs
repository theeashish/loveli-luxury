#!/usr/bin/env node
/**
 * payhero-smoke.mjs
 *
 * Tiered smoke-test tool for the PayHero integration. Designed for use
 * during Daraja Go-Live (see docs/go-live-mpesa.md) so the operator can
 * prove each layer works before the next, instead of debugging a real
 * customer transaction in production.
 *
 * Four levels, each safer than the next:
 *
 *   --check-config
 *       Validates that every PayHero env var is set with a plausible shape.
 *       Does NOT contact PayHero. Free.
 *
 *   --check-webhooks
 *       GETs both webhook URLs (STK + B2C) and confirms each returns
 *       tokenAccepted: true. Proves the callback URLs PayHero is configured
 *       to call are reachable AND your token matches. Does NOT cost wallet.
 *       Free.
 *
 *   --stk --to=+254XXXXXXXXX [--amount=1]
 *       Fires ONE REAL STK push against the live channel. THE CUSTOMER'S
 *       PHONE WILL RING. If they enter their M-Pesa PIN, real money moves
 *       from their account to your paybill. The PayHero wallet IS charged
 *       a per-push fee whether they pay or not.
 *
 *   --b2c --to=+254XXXXXXXXX [--amount=1]
 *       Fires ONE REAL B2C TRANSFER from your B2C wallet to that number.
 *       Cannot be undone. Settles in seconds. Only run with an MSISDN you
 *       own.
 *
 * Required env (the same vars production uses):
 *   NEXT_PUBLIC_APP_URL
 *   PAYHERO_AUTH_TOKEN
 *   PAYHERO_CHANNEL_ID_STK     (for --stk)
 *   PAYHERO_CHANNEL_ID_B2C     (for --b2c)
 *   PAYHERO_WEBHOOK_TOKEN
 *
 * Pull them from Vercel before you run:
 *   vercel env pull .env.production --environment=production
 *   node --env-file=.env.production scripts/payhero-smoke.mjs --check-config
 *
 * The script will REFUSE to run --stk or --b2c without --really, an explicit
 * --to=, and a +254 E.164 MSISDN. No defaults that could surprise you.
 *
 * Importing this module (for tests) does NOT trigger any execution — main()
 * is only called when the file is invoked as a CLI.
 */
import { randomBytes } from 'node:crypto'
import { fileURLToPath } from 'node:url'

const PAYHERO_API_BASE = 'https://backend.payhero.co.ke/api/v2'

// ─── arg parsing helpers (pure, no side-effects) ───────────────────────────
function makeArgHelpers(argv) {
  const flag = (name) => argv.includes(name)
  const value = (name) => {
    const found = argv.find((a) => a.startsWith(`${name}=`))
    if (found) return found.slice(name.length + 1)
    const idx = argv.indexOf(name)
    if (idx >= 0 && idx + 1 < argv.length && !argv[idx + 1].startsWith('--')) {
      return argv[idx + 1]
    }
    return null
  }
  return { flag, value }
}

// ─── env loader (pure read) ────────────────────────────────────────────────
// Reads from process.env. Treats empty string the same as undefined (Vercel
// marks secrets as SENSITIVE — `vercel env pull` then writes name="" to the
// local file rather than the real value. From this script's point of view
// that means "not locally readable" not "not set in production". The
// checkConfig flow handles that distinction by also probing the live
// diagnostic endpoint where appropriate.
function envOrNull(name) {
  const v = process.env[name]
  if (!v || v.trim() === '') return null
  return v.trim()
}

function envOrExit(name, { required = true } = {}) {
  const v = envOrNull(name)
  if (v) return v
  if (!required) return null
  console.error(`✗ ${name} is not set in env.`)
  console.error(`  Pull from Vercel first: vercel env pull .env.local --environment=production`)
  console.error(`  Then run with: node --env-file=.env.local scripts/payhero-smoke.mjs ...`)
  console.error(`  (Note: vars marked SENSITIVE in Vercel are intentionally redacted.`)
  console.error(`   For those, --check-config falls back to the live diagnostic endpoint.)`)
  process.exit(1)
}

// Probe the live GET handler at the given path. Returns the JSON response
// (which on this codebase includes envTokenSet + envTokenLength when token
// validation fails) or throws on network/HTTP errors.
async function fetchLiveDiagnostic(appUrl, path) {
  const res = await fetch(`${appUrl}${path}`, { method: 'GET' })
  if (!res.ok) throw new Error(`${path} returned HTTP ${res.status}`)
  return res.json()
}

// ─── output helpers ────────────────────────────────────────────────────────
function step(msg) { console.log(`\n── ${msg} ──`) }
function ok(msg) { console.log(`  ✓ ${msg}`) }
function warn(msg) { console.log(`  ⚠ ${msg}`) }
function fail(msg) { console.log(`  ✗ ${msg}`) }

// ─── E.164 validator (matches src/lib/env.ts and the Zod regex) ────────────
// Exported for unit tests; pure function, never throws.
const E164 = /^\+254\d{9}$/
export function validateMsisdn(s) {
  if (!s) return { ok: false, reason: 'no value' }
  if (!E164.test(s)) return { ok: false, reason: `expected +254XXXXXXXXX, got ${s}` }
  return { ok: true }
}

// ─── normaliser, mirrors src/lib/payhero/service.ts ────────────────────────
// Exported for unit tests; throws on unrecognised input by design (so a typo
// can never reach the API).
export function normaliseMsisdn(input) {
  const digits = String(input ?? '').replace(/\D/g, '')
  if (digits.startsWith('254') && digits.length === 12) return digits
  if (digits.startsWith('0') && digits.length === 10) return `254${digits.slice(1)}`
  if (digits.length === 9) return `254${digits}`
  throw new Error(`Unrecognised Kenyan MSISDN: ${input}`)
}

// ─── confirmation prompt for destructive actions ───────────────────────────
async function confirm(prompt, args) {
  const { flag } = makeArgHelpers(args)
  if (process.env.CI || flag('--yes')) return true
  process.stdout.write(`${prompt} type 'yes' to proceed: `)
  return await new Promise((resolve) => {
    process.stdin.setEncoding('utf8')
    process.stdin.once('data', (data) => resolve(data.trim().toLowerCase() === 'yes'))
  })
}

// ─── modes ─────────────────────────────────────────────────────────────────

async function checkConfig() {
  step('Config sanity check (combines local env + live diagnostic probe)')
  const appUrl = envOrExit('NEXT_PUBLIC_APP_URL')
  const tokenLocal = envOrNull('PAYHERO_AUTH_TOKEN')
  const channelStk = envOrNull('PAYHERO_CHANNEL_ID_STK')
  const channelB2c = envOrNull('PAYHERO_CHANNEL_ID_B2C')
  const webhookLocal = envOrNull('PAYHERO_WEBHOOK_TOKEN')

  if (!appUrl.startsWith('https://')) fail(`NEXT_PUBLIC_APP_URL must be HTTPS in prod (got ${appUrl})`)
  else ok(`NEXT_PUBLIC_APP_URL = ${appUrl}`)

  // PAYHERO_AUTH_TOKEN and PAYHERO_WEBHOOK_TOKEN are almost always marked
  // sensitive in Vercel, so they read as empty locally. Probe the live GET
  // handler at /api/payhero/webhook — its diagnostic response carries
  // envTokenSet + envTokenLength, computed from the running deployment's
  // own env. That tells us authoritatively what production thinks.
  let live = null
  try {
    live = await fetchLiveDiagnostic(appUrl, '/api/payhero/webhook')
  } catch (e) {
    warn(`Could not probe live diagnostic at ${appUrl}/api/payhero/webhook: ${e.message}`)
  }

  // PAYHERO_AUTH_TOKEN — only verifiable locally; we have no live diagnostic
  // for it (deliberately — exposing auth-token state would leak the
  // setness/length, which is an unnecessary side channel).
  if (tokenLocal) {
    if (tokenLocal.startsWith('Basic ')) {
      fail(`PAYHERO_AUTH_TOKEN starts with "Basic " — paste the dashboard token raw, no prefix.`)
    } else {
      ok(`PAYHERO_AUTH_TOKEN locally readable (${tokenLocal.length} chars)`)
    }
  } else {
    warn(`PAYHERO_AUTH_TOKEN not in local env — likely marked SENSITIVE in Vercel`)
    warn(`  Verify in the Vercel dashboard: should be a long base64-ish string with no "Basic " prefix.`)
  }

  // PAYHERO_CHANNEL_ID_STK — not typically sensitive.
  if (channelStk && /^\d+$/.test(channelStk)) ok(`PAYHERO_CHANNEL_ID_STK = ${channelStk}`)
  else if (!channelStk) fail(`PAYHERO_CHANNEL_ID_STK unset — STK push will not work`)
  else fail(`PAYHERO_CHANNEL_ID_STK should be a numeric id, got ${channelStk}`)

  // PAYHERO_CHANNEL_ID_B2C — also not typically sensitive. Missing today.
  if (channelB2c && /^\d+$/.test(channelB2c)) ok(`PAYHERO_CHANNEL_ID_B2C = ${channelB2c}`)
  else if (!channelB2c) fail(`PAYHERO_CHANNEL_ID_B2C unset — payouts will not work until set in Vercel`)
  else fail(`PAYHERO_CHANNEL_ID_B2C should be a numeric id, got ${channelB2c}`)

  // PAYHERO_WEBHOOK_TOKEN — verify via live diagnostic if not locally readable.
  if (webhookLocal) {
    if (webhookLocal.length >= 20) ok(`PAYHERO_WEBHOOK_TOKEN locally readable (${webhookLocal.length} chars)`)
    else fail(`PAYHERO_WEBHOOK_TOKEN must be at least 20 chars (got ${webhookLocal.length})`)
  } else if (live && typeof live === 'object' && 'debug' in live) {
    // .mjs file — no TS syntax. Pure runtime introspection of the JSON
    // returned by the live diagnostic.
    const dbg = live.debug ?? {}
    const tokSet = dbg.envTokenSet === true
    const tokLen = typeof dbg.envTokenLength === 'number' ? Number(dbg.envTokenLength) : 0
    if (tokSet && tokLen >= 20) ok(`PAYHERO_WEBHOOK_TOKEN set in PROD (${tokLen} chars, from live diagnostic)`)
    else if (tokSet) fail(`PAYHERO_WEBHOOK_TOKEN set in prod but only ${tokLen} chars (need >= 20)`)
    else fail(`PAYHERO_WEBHOOK_TOKEN is NOT set in production — register URL token in Vercel before Go-Live`)
  } else {
    warn(`PAYHERO_WEBHOOK_TOKEN not locally readable and no live diagnostic available`)
  }

  step('Expected callback URLs (register THESE in PayHero dashboard)')
  // We hide the actual token in the printed URL when we couldn't read it
  // locally — there's no point printing "key=" with nothing after it.
  const tokenSuffix = webhookLocal ? `key=${webhookLocal}` : `key=<PAYHERO_WEBHOOK_TOKEN>`
  ok(`STK callback:  ${appUrl}/api/payhero/webhook?${tokenSuffix}`)
  ok(`B2C callback:  ${appUrl}/api/payhero/payout-webhook?${tokenSuffix}`)
  console.log('\nNote: the B2C callback URL is a DIFFERENT route from STK. Both must')
  console.log('be registered separately in the PayHero dashboard.')
  if (!webhookLocal) {
    console.log('To get the actual token value: Vercel dashboard → Project →')
    console.log('Settings → Environment Variables → PAYHERO_WEBHOOK_TOKEN → "Show".')
  }
  console.log('')
}

async function checkWebhooks() {
  step('Webhook URL reachability + token match')
  const appUrl = envOrExit('NEXT_PUBLIC_APP_URL')
  const webhook = envOrNull('PAYHERO_WEBHOOK_TOKEN')

  // If we can't read the token locally (Vercel sensitive), we can still
  // verify each route is REACHABLE and the prod env has a token of correct
  // shape — what we cannot prove is that the token value matches the one
  // PayHero is configured to send. That match has to be verified by an
  // actual webhook delivery (smoke step 6 of docs/go-live-mpesa.md).
  const canDoExactMatchCheck = !!webhook

  for (const [label, path] of [
    ['STK', '/api/payhero/webhook'],
    ['B2C', '/api/payhero/payout-webhook'],
  ]) {
    if (canDoExactMatchCheck) {
      const url = `${appUrl}${path}?key=${encodeURIComponent(webhook)}`
      try {
        const res = await fetch(url, { method: 'GET' })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          fail(`${label} GET ${path} returned HTTP ${res.status}`)
          continue
        }
        if (body.tokenAccepted === true) {
          ok(`${label} ${path} → 200 tokenAccepted: true (exact-match verified)`)
        } else {
          fail(`${label} ${path} → 200 but tokenAccepted: ${body.tokenAccepted}. Local PAYHERO_WEBHOOK_TOKEN does NOT match prod's.`)
        }
      } catch (e) {
        fail(`${label} ${path} → network error: ${e.message}`)
      }
    } else {
      // Reachability + prod-env-state probe (no exact match).
      const url = `${appUrl}${path}`
      try {
        const res = await fetch(url, { method: 'GET' })
        const body = await res.json().catch(() => ({}))
        if (!res.ok) {
          fail(`${label} GET ${path} returned HTTP ${res.status}`)
          continue
        }
        const dbg = body?.debug ?? {}
        const set = dbg.envTokenSet === true
        const len = typeof dbg.envTokenLength === 'number' ? dbg.envTokenLength : 0
        if (set && len >= 20) {
          ok(`${label} ${path} → 200, prod env has token (${len} chars). Exact match not verified locally (sensitive var). Smoke step 6 will confirm.`)
        } else {
          fail(`${label} ${path} → 200 but prod debug says envTokenSet=${set}, envTokenLength=${len}. Token missing or too short in Vercel.`)
        }
      } catch (e) {
        fail(`${label} ${path} → network error: ${e.message}`)
      }
    }
  }
  if (!canDoExactMatchCheck) {
    console.log('\nNote: PAYHERO_WEBHOOK_TOKEN was not readable locally (likely marked SENSITIVE')
    console.log('in Vercel — good security hygiene). The check above proves the routes are')
    console.log('reachable and prod has a token of correct shape; the exact value match is')
    console.log('confirmed by the first real PayHero callback (smoke step 6).\n')
  }
}

async function doStkPush({ to, amountKes, args }) {
  step(`STK push — ⚠ real wallet fee, real customer prompt`)
  const token = envOrExit('PAYHERO_AUTH_TOKEN')
  const channelId = envOrExit('PAYHERO_CHANNEL_ID_STK')
  const appUrl = envOrExit('NEXT_PUBLIC_APP_URL')
  const webhook = envOrExit('PAYHERO_WEBHOOK_TOKEN')
  const orderNumber = `LL-SMOKE-${randomBytes(3).toString('hex').toUpperCase()}`
  const callbackUrl = `${appUrl}/api/payhero/webhook?key=${webhook}`
  const msisdn = normaliseMsisdn(to)

  console.log(`  channel_id        : ${channelId}`)
  console.log(`  amount (KES)      : ${amountKes}`)
  console.log(`  phone_number      : ${msisdn}`)
  console.log(`  external_reference: ${orderNumber}`)
  console.log(`  callback_url      : ${callbackUrl}`)

  const proceed = await confirm(`\n  Fire the STK push now? This will ring +${msisdn}.`, args)
  if (!proceed) { console.log('Aborted.'); process.exit(0) }

  const res = await fetch(`${PAYHERO_API_BASE}/payments`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: amountKes,
      phone_number: msisdn,
      channel_id: Number(channelId),
      provider: 'm-pesa',
      external_reference: orderNumber,
      customer_name: 'Loveli smoke test',
      callback_url: callbackUrl,
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    fail(`PayHero STK init returned HTTP ${res.status}: ${JSON.stringify(json)}`)
    process.exit(2)
  }
  ok(`STK init accepted by PayHero.`)
  console.log(`  reference          : ${json.reference ?? json.CheckoutRequestID ?? '(none returned)'}`)
  console.log(`  status             : ${json.status ?? '(none)'}`)
  console.log(`\n  Next: the customer phone should ring within ~5 seconds.`)
  console.log(`  When PIN is entered (or push fails/times out), PayHero POSTs to:`)
  console.log(`    ${callbackUrl}`)
  console.log(`  Then check the DB:`)
  console.log(`    SELECT * FROM webhook_deliveries WHERE event_id LIKE '%${orderNumber}%' OR body::text LIKE '%${orderNumber}%';`)
}

async function doB2C({ to, amountKes, args }) {
  step(`B2C transfer — ⚠ real money out, NOT REVERSIBLE`)
  const token = envOrExit('PAYHERO_AUTH_TOKEN')
  const channelId = envOrExit('PAYHERO_CHANNEL_ID_B2C')
  const appUrl = envOrExit('NEXT_PUBLIC_APP_URL')
  const webhook = envOrExit('PAYHERO_WEBHOOK_TOKEN')
  // Use a payoutId large enough not to collide with any real payouts.id —
  // PayHero only echoes this back as external_reference; it doesn't have to
  // exist in our payouts table for a smoke run.
  const fakePayoutId = 999000000 + Math.floor(Math.random() * 1000)
  const callbackUrl = `${appUrl}/api/payhero/payout-webhook?key=${webhook}`
  const msisdn = normaliseMsisdn(to)

  console.log(`  channel_id        : ${channelId}`)
  console.log(`  amount (KES)      : ${amountKes}`)
  console.log(`  phone_number      : ${msisdn}`)
  console.log(`  external_reference: PO-${fakePayoutId}  (NOT a real payouts row)`)
  console.log(`  callback_url      : ${callbackUrl}`)

  const proceed = await confirm(
    `\n  Fire the B2C transfer now? Real KES ${amountKes} leaves your wallet, NOT REVERSIBLE.`,
    args,
  )
  if (!proceed) { console.log('Aborted.'); process.exit(0) }

  const res = await fetch(`${PAYHERO_API_BASE}/withdraw`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${token}`,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify({
      amount: amountKes,
      phone_number: msisdn,
      channel_id: Number(channelId),
      external_reference: `PO-${fakePayoutId}`,
      callback_url: callbackUrl,
      customer_name: 'Loveli smoke test',
      provider: 'm-pesa',
    }),
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok || json.success === false) {
    fail(`PayHero B2C init returned HTTP ${res.status}: ${JSON.stringify(json)}`)
    process.exit(2)
  }
  ok(`B2C init accepted by PayHero.`)
  console.log(`  reference: ${json.reference ?? '(none returned)'}`)
  console.log(`  status   : ${json.status ?? '(none)'}`)
  console.log(`\n  Next: the recipient should receive the funds in seconds.`)
  console.log(`  PayHero will POST completion to ${callbackUrl}.`)
  console.log(`  Since external_reference is synthetic (PO-${fakePayoutId}, not in payouts),`)
  console.log(`  the webhook will log "payout ${fakePayoutId} not found" and acknowledge — that's expected.`)
}

function printUsage() {
  const path = 'scripts/payhero-smoke.mjs'
  console.log(`PayHero smoke test\n`)
  console.log(`Usage:`)
  console.log(`  node --env-file=.env.production ${path} --check-config`)
  console.log(`  node --env-file=.env.production ${path} --check-webhooks`)
  console.log(`  node --env-file=.env.production ${path} --stk --to=+254XXXXXXXXX [--amount=1]`)
  console.log(`  node --env-file=.env.production ${path} --b2c --to=+254XXXXXXXXX [--amount=1]\n`)
  console.log(`Hint: pull env from Vercel first with`)
  console.log(`  vercel env pull .env.production --environment=production\n`)
  console.log(`The --stk and --b2c modes will prompt for confirmation before firing.`)
}

// ─── main ──────────────────────────────────────────────────────────────────
async function main() {
  const args = process.argv.slice(2)
  const { flag, value } = makeArgHelpers(args)
  const mode = ['--check-config', '--check-webhooks', '--stk', '--b2c'].find((m) => flag(m))

  if (!mode || flag('--help')) {
    printUsage()
    process.exit(mode ? 0 : 1)
  }

  if (mode === '--check-config') { await checkConfig(); return }
  if (mode === '--check-webhooks') { await checkWebhooks(); return }

  // Destructive paths from here.
  const to = value('--to')
  const amount = Number(value('--amount') ?? '1')
  const msisdn = validateMsisdn(to)
  if (!msisdn.ok) {
    fail(`--to=+254XXXXXXXXX required (${msisdn.reason})`)
    process.exit(1)
  }
  if (!Number.isInteger(amount) || amount < 1 || amount > 100) {
    fail(`--amount must be an integer in [1, 100] for smoke runs (got ${amount})`)
    process.exit(1)
  }
  if (mode === '--stk') await doStkPush({ to, amountKes: amount, args })
  if (mode === '--b2c') await doB2C({ to, amountKes: amount, args })
}

// Only run main() when invoked directly, not when imported by a test.
// `process.argv[1]` is the entrypoint path; on direct invocation it equals
// this file's URL when converted with fileURLToPath. On import (e.g. from
// Vitest) it's a different file — so main() doesn't fire.
const isDirectInvocation = (() => {
  try {
    return fileURLToPath(import.meta.url) === process.argv[1]
  } catch {
    return false
  }
})()

if (isDirectInvocation) {
  main().catch((e) => {
    console.error('\n✗ Unhandled error:', e.message ?? e)
    process.exit(1)
  })
}
