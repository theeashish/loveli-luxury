# Security Incident Response Runbook

**Owner:** Loveli Luxury International
**Applies to:** `www.loveliluxury.com`, Vercel, Supabase, IntaSend, Upstash, and Sentry
**Last updated:** 13 August 2026

> This runbook is an operational procedure, not legal advice. Preserve evidence and involve appropriate legal, payment-provider, and regulatory contacts where required.

## 1. Immediate rule

**Do not disable Vercel system DDoS mitigation.** Keep the production application on HTTPS, preserve payment-webhook verification, and do not expose or rotate a secret in chat, source control, browser logs, or a ticket.

## 2. Detection signals

| Signal | Where to look | First interpretation |
|---|---|---|
| Sudden traffic, denied, challenged, or rate-limited requests | Vercel Firewall → Traffic and Audit Log | Possible DDoS, bot campaign, or abusive client. |
| Structured `[security]` request-limit or origin-rejection logs | Vercel project Logs / Sentry | Sensitive-route abuse or cross-origin request attempt. |
| Checkout, webhook, or provider-status failures | Vercel Logs, Sentry, IntaSend dashboard | Payment availability, forged webhook, or reconciliation problem. |
| Unexpected role, payout, refund, or order activity | Admin audit log and payment audit logs | Potential account compromise or financial-control issue. |
| Missing scheduled reconciliation or monthly close | Sentry check-ins and cron logs | Operational gap requiring manual verification. |

## 3. DDoS or abusive-traffic response

1. Record the UTC time, affected hostname/path, request volume, relevant Vercel Firewall event identifiers, and a screenshot/export of the current firewall view.
2. Check whether the event is concentrated on a path such as checkout initiation, payment status, partner signup, webhook, revalidation, login, or an administrative route.
3. In Vercel Firewall, use a narrowly targeted deny or challenge rule where the attack pattern is clear. Use IP blocking only for confirmed abusive sources. Do not create broad country or county blocks without approved policy.
4. If the attack is material or persistent, enable **Attack Mode**. This challenges all traffic and may affect legitimate customers, so record the decision and start/end time.
5. Confirm the following remain available after mitigation: homepage, shop, product detail, checkout page, `/api/health`, and the IntaSend webhook verification path.
6. Keep the strict shared rate limiter configured. In production, its protected routes return `503` rather than silently failing open if the limiter is unavailable.
7. Document the incident, response, outcome, cost/availability impact, and follow-up action.

## 4. Payment, webhook, or fraud response

1. Do not mark an order paid manually solely from a customer screenshot.
2. Check IntaSend provider reference, payment status, webhook delivery record, application payment audit log, and order status.
3. Confirm the webhook challenge verification result before considering a callback valid.
4. Use the existing idempotent reconciliation path; do not replay ledger writes or commission payouts manually without an audit trail.
5. If a secret is suspected compromised, rotate it in the provider/platform first, update Vercel/Supabase secrets securely, deploy, then verify with a controlled test. Never print the old or new value.
6. Preserve relevant order, payment, provider, and audit records. Escalate suspected fraud, chargeback, data breach, or unlawful activity to management and legal counsel.

## 5. Account or administrative-access response

1. Disable or revoke the affected user session/role through the authorised admin process.
2. Review audit-log entries, recent role changes, KYC actions, refunds, payouts, and order actions associated with the account.
3. Require password/session reset or MFA remediation where applicable before restoring access.
4. Record the timeline, decision-maker, evidence reviewed, and final resolution.

## 6. Recovery and closure

| Check | Required evidence |
|---|---|
| Customer surface is reachable | HTTPS homepage, shop, product, bundle, and health checks respond normally. |
| Financial integrity is intact | No unverified payment was marked paid; webhooks and reconciliation show expected results. |
| Security control remains enabled | Vercel mitigation active; strict limiter configured; no emergency bypass left enabled. |
| Evidence is preserved | Timeline, screenshots/log links, provider references, and corrective actions are retained. |
| Follow-up is assigned | Root cause, owner, deadline, and any legal/privacy notification assessment are documented. |

## 7. Configuration checklist

| Control | Production requirement |
|---|---|
| Vercel Firewall | Monitor traffic and audit log. Add path-specific rules after authorised review. |
| Vercel system mitigation | Enabled; never paused in normal operations. |
| Upstash Redis | `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` present and valid. |
| Sensitive-route controls | Checkout, partner signup, payment status, webhook, revalidation, and wishlist writes use strict rate controls. |
| Secrets | IntaSend webhook challenge, cron secret, and revalidation secret configured only in secure platform settings. |
| Monitoring | Review Vercel logs/Sentry and scheduled reconciliation health at least weekly. |

## References

[1]: https://vercel.com/docs/vercel-firewall/ddos-mitigation "Vercel DDoS Mitigation"
[2]: https://vercel.com/kb/guide/add-rate-limiting-vercel "Vercel Rate Limiting"
