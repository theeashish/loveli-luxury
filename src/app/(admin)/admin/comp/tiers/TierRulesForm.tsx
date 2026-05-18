'use client'

/**
 * Per-tier rules editor.
 *
 * Renders the relevant editable fields based on the tier's qualification
 * shape. Tier 1 only has the requires_any flag set (verified customer
 * / creator); tiers 2-3 have numeric thresholds; tier 4 has compliance
 * flags. The form hides fields that don't apply to the tier the user
 * is editing.
 */

import { useState, useTransition } from 'react'
import {
  adminCheckboxCls,
  adminInputCls,
  adminPrimaryBtnCls,
} from '@/components/admin/forms'
import type { PartnerTier, QualificationRules } from '@/lib/partners/types'
import { updatePartnerTierRules } from './actions'

interface Props {
  tier: PartnerTier
}

export function TierRulesForm({ tier }: Props) {
  const [directRatePct, setDirectRatePct] = useState(
    tier.direct_rate_basis_points / 100,
  )
  const [overrideRatePct, setOverrideRatePct] = useState(
    tier.override_rate_basis_points / 100,
  )
  const [canReferMax, setCanReferMax] = useState(tier.can_refer_tier_max)

  const rules = tier.qualification_rules
  const [retailKes, setRetailKes] = useState(
    Math.round((rules.min_90d_retail_minor ?? 0) / 100),
  )
  const [retentionScore, setRetentionScore] = useState(
    rules.min_retention_score ?? 0,
  )
  const [uniqueBuyers, setUniqueBuyers] = useState(
    rules.min_unique_buyers_90d ?? 0,
  )
  const [posts, setPosts] = useState(rules.min_90d_post_count ?? 0)
  const [quarterly, setQuarterly] = useState(
    Boolean(rules.quarterly_review_required),
  )
  const [compliance, setCompliance] = useState(
    Boolean(rules.brand_compliance_required),
  )

  const [pending, startTransition] = useTransition()
  const [msg, setMsg] = useState<
    { kind: 'ok' | 'error'; text: string } | null
  >(null)

  const showNumericThresholds =
    tier.tier_position === 2 || tier.tier_position === 3
  const showComplianceFlags = tier.tier_position === 4

  function onSubmit(e: React.FormEvent) {
    e.preventDefault()
    setMsg(null)

    const nextRules: QualificationRules = {}
    // Carry forward requires_any if it was present (we don't edit it).
    if (rules.requires_any) nextRules.requires_any = rules.requires_any
    if (showNumericThresholds) {
      nextRules.min_90d_retail_minor = retailKes * 100
      if (tier.tier_position === 2) {
        nextRules.min_retention_score = retentionScore
      }
      if (tier.tier_position === 3) {
        nextRules.min_unique_buyers_90d = uniqueBuyers
        nextRules.min_90d_post_count = posts
      }
    }
    if (showComplianceFlags) {
      nextRules.min_90d_retail_minor = retailKes * 100
      nextRules.quarterly_review_required = quarterly
      nextRules.brand_compliance_required = compliance
    }

    startTransition(async () => {
      const res = await updatePartnerTierRules({
        tierPosition: tier.tier_position,
        directRateBasisPoints: Math.round(directRatePct * 100),
        overrideRateBasisPoints: Math.round(overrideRatePct * 100),
        canReferTierMax: canReferMax,
        qualificationRules: nextRules,
      })
      if ('error' in res) {
        setMsg({ kind: 'error', text: res.error })
      } else {
        setMsg({
          kind: 'ok',
          text: 'Tier rules updated. Existing row closed; new version active.',
        })
      }
    })
  }

  return (
    <form onSubmit={onSubmit} className="mt-4 space-y-4">
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <Field label="Direct rate (%)">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={directRatePct}
            onChange={(e) => setDirectRatePct(Number(e.target.value))}
            className={`${adminInputCls} tabular-nums`}
          />
        </Field>
        <Field label="Override rate (%)">
          <input
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={overrideRatePct}
            onChange={(e) => setOverrideRatePct(Number(e.target.value))}
            className={`${adminInputCls} tabular-nums`}
          />
        </Field>
        <Field label="Can refer up to tier #">
          <input
            type="number"
            min={0}
            max={4}
            step={1}
            value={canReferMax}
            onChange={(e) => setCanReferMax(Number(e.target.value))}
            className={`${adminInputCls} tabular-nums`}
          />
        </Field>
      </div>

      {showNumericThresholds || showComplianceFlags ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <Field label="Min 90-day verified revenue (KES)">
            <input
              type="number"
              min={0}
              step={1000}
              value={retailKes}
              onChange={(e) => setRetailKes(Number(e.target.value))}
              className={`${adminInputCls} tabular-nums`}
            />
          </Field>
          {tier.tier_position === 2 ? (
            <Field label="Min retention score (0–1)">
              <input
                type="number"
                min={0}
                max={1}
                step={0.05}
                value={retentionScore}
                onChange={(e) => setRetentionScore(Number(e.target.value))}
                className={`${adminInputCls} tabular-nums`}
              />
            </Field>
          ) : null}
          {tier.tier_position === 3 ? (
            <>
              <Field label="Min unique buyers (90d)">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={uniqueBuyers}
                  onChange={(e) => setUniqueBuyers(Number(e.target.value))}
                  className={`${adminInputCls} tabular-nums`}
                />
              </Field>
              <Field label="Min posts (90d)">
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={posts}
                  onChange={(e) => setPosts(Number(e.target.value))}
                  className={`${adminInputCls} tabular-nums`}
                />
              </Field>
            </>
          ) : null}
          {showComplianceFlags ? (
            <>
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={quarterly}
                  onChange={(e) => setQuarterly(e.target.checked)}
                  className={adminCheckboxCls}
                />
                Quarterly review required
              </label>
              <label className="flex items-center gap-2 text-sm text-neutral-800">
                <input
                  type="checkbox"
                  checked={compliance}
                  onChange={(e) => setCompliance(e.target.checked)}
                  className={adminCheckboxCls}
                />
                Brand compliance required
              </label>
            </>
          ) : null}
        </div>
      ) : (
        <p className="text-xs text-neutral-500">
          Tier 1 qualification is flag-based (verified customer OR verified
          content creator). No numeric thresholds apply.
        </p>
      )}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={pending} className={adminPrimaryBtnCls}>
          {pending ? 'Saving…' : 'Save tier rules'}
        </button>
        {msg ? (
          <span
            className={`text-xs ${
              msg.kind === 'ok' ? 'text-emerald-700' : 'text-rose-700'
            }`}
          >
            {msg.text}
          </span>
        ) : null}
      </div>
    </form>
  )
}

function Field({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-800">
        {label}
      </label>
      {children}
    </div>
  )
}
