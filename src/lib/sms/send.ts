/**
 * SMS send abstraction. Default channel is Africa's Talking (Kenya-first
 * gateway, dominant carrier integrations for Safaricom + Airtel KE). The
 * client passes plain text + recipient MSISDN; this helper picks the
 * channel based on env config.
 *
 * Channels:
 *   - africas_talking: if AFRICAS_TALKING_USERNAME + AFRICAS_TALKING_API_KEY
 *     are set, POSTs to api.africastalking.com.
 *   - audit_log fallback: if no provider env is set, writes the message
 *     payload to audit_log so an admin can manually relay. This keeps
 *     the verification flow runnable end-to-end without committing to
 *     an SMS contract.
 *
 * Returns the underlying provider message id (or "audit-{audit_log.id}"
 * for the fallback) so callers can correlate later.
 */

import 'server-only'

import { getServerEnv } from '../env'
import { createServiceClient } from '../supabase/service'

export type SmsSendResult = {
  channel: 'africas_talking' | 'audit_log'
  providerMessageId: string
}

export async function sendSMS(opts: {
  msisdn: string
  body: string
  /** Optional category label written to audit_log. e.g. 'msisdn_verification'. */
  category?: string
}): Promise<SmsSendResult> {
  const env = getServerEnv()
  const at = {
    username: env.AFRICAS_TALKING_USERNAME,
    apiKey: env.AFRICAS_TALKING_API_KEY,
    senderId: env.AFRICAS_TALKING_SENDER_ID,
  }

  if (at.username && at.apiKey) {
    return await sendViaAfricasTalking({
      username: at.username,
      apiKey: at.apiKey,
      senderId: at.senderId,
      msisdn: opts.msisdn,
      body: opts.body,
    })
  }

  return await sendViaAuditLogFallback({
    msisdn: opts.msisdn,
    body: opts.body,
    category: opts.category ?? null,
  })
}

// ---------------------------------------------------------------------------
// Provider: Africa's Talking
// ---------------------------------------------------------------------------

async function sendViaAfricasTalking(opts: {
  username: string
  apiKey: string
  senderId?: string
  msisdn: string
  body: string
}): Promise<SmsSendResult> {
  const formBody = new URLSearchParams()
  formBody.append('username', opts.username)
  formBody.append('to', opts.msisdn)
  formBody.append('message', opts.body)
  if (opts.senderId) formBody.append('from', opts.senderId)

  const res = await fetch('https://api.africastalking.com/version1/messaging', {
    method: 'POST',
    headers: {
      apiKey: opts.apiKey,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: formBody.toString(),
  })

  if (!res.ok) {
    throw new Error(
      `Africa's Talking SMS send failed: ${res.status} ${await res.text()}`,
    )
  }

  const json = (await res.json()) as {
    SMSMessageData?: {
      Recipients?: Array<{ messageId?: string; status?: string }>
    }
  }
  const recipient = json.SMSMessageData?.Recipients?.[0]
  if (!recipient?.messageId) {
    throw new Error(
      `Africa's Talking returned no messageId: ${JSON.stringify(json)}`,
    )
  }

  return {
    channel: 'africas_talking',
    providerMessageId: recipient.messageId,
  }
}

// ---------------------------------------------------------------------------
// Fallback: write the payload to audit_log
// ---------------------------------------------------------------------------

async function sendViaAuditLogFallback(opts: {
  msisdn: string
  body: string
  category: string | null
}): Promise<SmsSendResult> {
  const service = createServiceClient()
  const r = await service
    .from('audit_log')
    .insert({
      action: 'sms.relay_pending',
      resource_type: 'sms',
      resource_id: opts.msisdn,
      after_data: {
        category: opts.category,
        body: opts.body,
        note:
          'SMS provider not configured. Admin should relay this message manually.',
      },
    })
    .select('id')
    .single()
  if (r.error || !r.data) {
    throw new Error(`SMS audit-log fallback failed: ${r.error?.message}`)
  }
  return {
    channel: 'audit_log',
    providerMessageId: `audit-${r.data.id}`,
  }
}
