/**
 * /admin/content/site/[section]
 *
 * Per-section editor. Renders the current body as pretty-printed JSON in
 * a textarea, with the schema fields documented below for reference.
 * Submit goes through the server actions in ./actions.ts which validate
 * against the section's Zod schema before writing.
 */

import { notFound } from 'next/navigation'
import { SECTIONS, getSection, type SectionKey } from '@/lib/content/site'
import { SectionEditor } from './SectionEditor'

export const metadata = { robots: { index: false } }
export const dynamic = 'force-dynamic'

const SCHEMA_HELP: Record<SectionKey, string> = {
  home_hero: `Fields:
  eyebrow         — small uppercase line above the headline
  headline        — main display heading; wrap a phrase in *asterisks*
                    for italic + gold highlight
  subhead         — paragraph under the headline (max ~30 words)
  ctaLabel        — text on the primary button
  ctaHref         — where the button links to (e.g. "/shop")
  rotatingLabel   — small label above the rotating fragrance name
                    (e.g. "Now featuring")`,

  home_trust_strip: `Fields:
  ariaLabel       — screen-reader label for the strip
  pillars         — array of exactly 4 pillars, each with:
    icon            — one of: "shield-check", "smartphone",
                      "message-circle", "truck"
    label           — bold pillar title
    sub             — small line under the label
    href            — link (or null for non-clickable)`,

  home_story: `Fields:
  eyebrow         — small uppercase line above the headline
  headline        — display heading; *asterisks* for highlight
  body            — paragraph under the headline
  stats           — array of three { k, v } entries, where k is the
                    eyebrow line and v is the value line`,

  home_faq: `Fields:
  eyebrow         — small uppercase line above the headline
  headline        — display heading; *asterisks* for highlight
  items           — array of { q, a } pairs. q is the question
                    summary, a is the answer paragraph. Order in this
                    list controls order on the page; the first item
                    opens by default.`,

  home_philosophy: `Fields:
  eyebrow         — small uppercase line above the headline
  headline        — display heading; *asterisks* for highlight
  body            — paragraph under the headline
  quote           — single sentence rendered as the pull-quote at
                    the bottom of the section. No quotation marks
                    needed — the component adds them.`,

  footer: `Fields:
  brandName       — large brand name in the footer's left column
  tagline         — paragraph under the brand name (max ~30 words)
  copyrightName   — legal name in the "© YEAR …" line
  closingLine     — small italic-ish line on the right of the
                    bottom rule (e.g. "Blended in Nairobi · Shipped
                    with intention")
                  Note: footer LINKS (Shop / Brand / Promise columns)
                  are intentionally not editable here — they tie to
                  real routes. Ask an engineer if you need to add
                  or remove a link.`,

  partner_landing: `Fields:
  eyebrow         — small uppercase pill above the headline
                    (e.g. "Loveli Luxury · Partner Program")
  headline        — large display heading; *asterisks* for the
                    gold-italic highlight phrase
  microtag        — uppercase line under the headline
                    (e.g. "Five ranks · Verified retail · Editorial access")
  subhead         — paragraph under the microtag (max ~50 words)
  ctaLabel        — text on the primary "Join via your sponsor" button
                    (the button always goes to /partners/signup)
  secondaryLabel  — text on the secondary anchor link
  secondaryHref   — where the secondary link goes (e.g. "#tiers"
                    scrolls to the rank ladder on the same page)
  inviteNote      — small uppercase line under the buttons
                    (e.g. "Invite-only · Sponsor code required")`,

  policies_authenticity: `Fields:
  lead            — large display heading at the top of the page
  intro           — opening paragraph under the heading
  sections        — array of section blocks. Each block has:
    title           — section heading
    body            — paragraph (optional)
    bullets         — array of bullet strings (optional)
  Either body or bullets is enough; you can mix them too.`,

  policies_delivery: `Fields:
  lead              — large display heading at the top of the page
  intro             — opening paragraph under the heading
  zonesHeading      — heading above the delivery-time table
                      (e.g. "By region")
  zonesHeaderLeft   — left column header in the table
                      (e.g. "Where you are")
  zonesHeaderRight  — right column header (e.g. "Expect")
  zones             — array of { label, window } rows for the table.
                      label = the region, window = the delivery time.
  sections          — array of follow-up section blocks (couriers,
                      tracking, late delivery, etc.). Each block has:
    title           — section heading
    body            — paragraph (optional)
    bullets         — array of bullet strings (optional)`,

  policies_refund: `Fields:
  lead              — large display heading at the top of the page
  intro             — opening paragraph under the heading
  qualifiesHeading  — heading above the "What qualifies" bullets
  qualifiesIntro    — paragraph above the bullets
  qualifies         — array of bullet strings under "What qualifies"
  sections          — array of follow-up section blocks. Each block has:
    title           — section heading
    body            — paragraph (optional)
    bullets         — array of bullet strings (optional)`,

  home_find_your_scent: `Fields:
  eyebrow         — small uppercase line above the headline
                    (e.g. "Find your scent")
  headline        — display heading; *asterisks* for gold highlight
  resultEyebrow   — small line above the matched fragrance name
                    on the result screen (e.g. "Your scent")
  meetCtaPrefix   — text in front of the fragrance name on the
                    primary CTA (e.g. "Meet" → "Meet Sunset Bliss")
  tryAgainLabel   — text on the secondary link that resets the quiz
  steps           — array of { prompt, options } steps. Each option:
    label           — what the visitor sees on the button
    tag             — must be one of: "soft", "mysterious",
                      "fresh", "bold", "warm"
                      (this is what the matcher reads to pick a
                       fragrance — labels can change freely, but
                       the tag must stay one of those five values)`,

  home_marquee: `Fields:
  separator       — character drawn between names
                    (e.g. "✦", "·", "—")
  items           — array of strings that scroll across the band.
                    Order in the array is order on screen.`,

  partner_ids: `Fields (Income Disclosure Statement at /ids):
  eyebrow         — small uppercase line above the headline
  headline        — display heading; *asterisks* for italic + gold
  lead            — paragraph under the headline, max ~50 words
  periodLabel    — free-form period label, e.g. "Q1 2026" or
                    "January-March 2026". Replace "DATA PENDING".
  methodology     — paragraph explaining how the numbers were
                    computed. Defines what "active partner" means.
  stats           — 3-6 entries, each with:
    label           — the stat name
    value           — the headline value (e.g. "KES 4,200", "61%")
    sub             — caption under the value; include unit/caveat
  rules           — bullet list of the non-negotiable program rules.
                    Keep these factual and conservative.
  footnote        — closing paragraph; include the report-fraud email.

  LOCKED PRINCIPLE — this page is the OPPOSITE of an income claim. Stats
  must describe REALITY (median, % earning, recoup rate), not best-case.
  Replace every "DATA PENDING" with verified numbers before launch.`,
}

export default async function SectionEditPage({
  params,
}: {
  params: { section: string }
}) {
  if (!(params.section in SECTIONS)) {
    notFound()
  }
  const key = params.section as SectionKey

  const current = await getSection(key)
  const initialJson = JSON.stringify(current, null, 2)
  const meta = SECTIONS[key]

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-6">
        <p className="text-eyebrow text-neutral-500">Content · {key}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-neutral-900">
          {meta.label}
        </h1>
        <p className="mt-3 text-sm leading-relaxed text-neutral-600">
          {meta.description} Edit the JSON below and save — your changes go
          live on the public site immediately. If the JSON is malformed, the
          save is rejected and the previous version stays live.
        </p>
      </header>

      <SectionEditor
        sectionKey={key}
        initialJson={initialJson}
        schemaHelp={SCHEMA_HELP[key]}
      />
    </div>
  )
}
