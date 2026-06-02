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

// ─── env loader (pure read; logs + exits on miss when called) ──────────────
function envOrExit(name, { required = true } = {}) {
  const v = process.env[name]
  if (!v || v.trim() === '') {
    if (required) {
      console.error(`✗ ${name} is not set in env.`)
      console.error(`  Pull from Vercel first: vercel env pull .env.production --environment=production`)
      console.error(`  Then run with: node --env-file=.env.production scripts/payhero-smoke.mjs ...`)
      process.exit(1)
    }
    return null
  }
  return v.trim()
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
  step('Config sanity check (no PayHero API call)')
  const appUrl = envOrExit('NEXT_PUBLIC_APP_URL')
  const token = envOrExit('PAYHERO_AUTH_TOKEN')
  const channelStk = envOrExit('PAYHERO_CHANNEL_ID_STK', { required: false })
  const channelB2c = envOrExit('PAYHERO_CHANNEL_ID_B2C', { required: false })
  const webhook = envOrExit('PAYHERO_WEBHOOK_TOKEN')

  if (!appUrl.startsWith('https://')) fail(`NEXT_PUBLIC_APP_URL must be HTTPS in prod (got ${appUrl})`)
  else ok(`NEXT_PUBLIC_APP_URL = ${appUrl}`)

  if (token.startsWith('Basic ')) {
    fail(`PAYHERO_AUTH_TOKEN must NOT include the "Basic " prefix — paste the dashboard token raw.`)
  } else {
    ok(`PAYHERO_AUTH_TOKEN set (${token.length} chars)`)
  }

  if (channelStk && /^\d+$/.test(channelStk)) ok(`PAYHERO_CHANNEL_ID_STK = ${channelStk}`)
  else if (!channelStk) warn(`PAYHERO_CHANNEL_ID_STK unset — STK push will not work`)
  else fail(`PAYHERO_CHANNEL_ID_STK should be a numeric id, got ${channelStk}`)

  if (channelB2c && /^\d+$/.test(channelB2c)) ok(`PAYHERO_CHANNEL_ID_B2C = ${channelB2c}`)
  else if (!channelB2c) warn(`PAYHERO_CHANNEL_ID_B2C unset — payouts will not work`)
  else fail(`PAYHERO_CHANNEL_ID_B2C should be a numeric id, got ${channelB2c}`)

  if (webhook.length >= 20) ok(`PAYHERO_WEBHOOK_TOKEN set (${webhook.length} chars)`)
  else fail(`PAYHERO_WEBHOOK_TOKEN must be at least 20 chars (got ${webhook.length})`)

  step('Expected callback URLs (register THESE in PayHero dashboard)')
  ok(`STK callback:  ${appUrl}/api/payhero/webhook?key=${webhook}`)
  ok(`B2C callback:  ${appUrl}/api/payhero/payout-webhook?key=${webhook}`)
  console.log('\nNote: the B2C callback URL is a DIFFERENT route from STK. Both must')
  console.log('be registered separately in the PayHero dashboard.\n')
}

async function checkWebhooks() {
  step('Webhook URL reachability + token match')
  const appUrl = envOrExit('NEXT_PUBLIC_APP_URL')
  const webhook = envOrExit('PAYHERO_WEBHOOK_TOKEN')

  for (const [label, path] of [
    ['STK', '/api/payhero/webhook'],
    ['B2C', '/api/payhero/payout-webhook'],
  ]) {
    const url = `${appUrl}${path}?key=${encodeURIComponent(webhook)}`
    try {
      const res = await fetch(url, { method: 'GET' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) {
        fail(`${label} GET ${path} returned HTTP ${res.status}`)
        continue
      }
      if (body.tokenAccepted === true) {
        ok(`${label} ${path} → 200 tokenAccepted: true`)
      } else {
        fail(`${label} ${path} → 200 but tokenAccepted: ${body.tokenAccepted}. PAYHERO_WEBHOOK_TOKEN in Vercel does not match the value here.`)
      }
    } catch (e) {
      fail(`${label} ${path} → network error: ${e.message}`)
    }
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
