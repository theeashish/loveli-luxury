/**
 * Site content CMS — server-side reads.
 *
 * Each editable section is keyed by a stable string (e.g. 'home_hero') and
 * stored as JSONB in `site_content`. This module is the single bridge
 * between that DB shape and the React components that render it.
 *
 * Three guarantees:
 *   1. **Strict schemas.** Every section has a Zod schema; a malformed
 *      row in the DB never reaches a component — it falls back to the
 *      in-code default.
 *   2. **Code defaults.** If a row is missing (fresh install, deleted by
 *      mistake), the site still renders with the original copy. The DB
 *      is the *override*, not the source.
 *   3. **Service-role read.** site_content is publicly readable per the
 *      RLS policy in migration 035, but we use the service client so the
 *      read never depends on the caller's auth context.
 *
 * The seed in migration 035 mirrors the DEFAULTS objects below, so a
 * fresh DB and a never-touched DB look identical.
 */

import 'server-only'

import { z } from 'zod'
import { createServiceClient } from '../supabase/service'

// ---------------------------------------------------------------------
// Section schemas + defaults
// ---------------------------------------------------------------------

/** home_hero — the headline section above the fold. */
export const heroSchema = z.object({
  eyebrow: z.string(),
  /** Use *asterisks* to mark italic + primary-color emphasis. */
  headline: z.string(),
  subhead: z.string(),
  ctaLabel: z.string(),
  ctaHref: z.string(),
  rotatingLabel: z.string(),
})
export type HeroContent = z.infer<typeof heroSchema>
export const HERO_DEFAULTS: HeroContent = {
  eyebrow: 'Where love meets luxury',
  headline: 'The Scent of *Elegance*, Bottled.',
  subhead:
    'Eau de Parfum blended in small batches in Nairobi. Each bottle is made for people who enjoy wearing fragrance.',
  ctaLabel: 'Shop the collection',
  ctaHref: '/shop',
  rotatingLabel: 'Now featuring',
}

/** home_trust_strip — the 4 pillars under the hero. */
export const trustStripSchema = z.object({
  ariaLabel: z.string(),
  pillars: z.array(
    z.object({
      /** Whitelist — see ICON_MAP in TrustStrip.tsx. */
      icon: z.enum(['shield-check', 'smartphone', 'message-circle', 'truck']),
      label: z.string(),
      sub: z.string(),
      href: z.string().nullable(),
    }),
  ),
})
export type TrustStripContent = z.infer<typeof trustStripSchema>
export const TRUST_STRIP_DEFAULTS: TrustStripContent = {
  ariaLabel: 'Why shop with Loveli Luxury Scents',
  pillars: [
    {
      icon: 'shield-check',
      label: 'Authenticity verified',
      sub: 'Every fragrance is checked before dispatch',
      href: '/policies/authenticity',
    },
    {
      icon: 'smartphone',
      label: 'M-Pesa secure checkout',
      sub: 'Pay by STK push, no card needed',
      href: null,
    },
    {
      icon: 'message-circle',
      label: 'Concierge on WhatsApp',
      sub: 'Help choosing your scent',
      href: null,
    },
    {
      icon: 'truck',
      label: 'Nationwide delivery',
      sub: 'Nairobi 24–48 hours · across Kenya',
      href: '/policies/delivery',
    },
  ],
}

/** home_story — the origin block. */
export const storySchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  body: z.string(),
  stats: z.array(z.object({ k: z.string(), v: z.string() })),
})
export type StoryContent = z.infer<typeof storySchema>
export const STORY_DEFAULTS: StoryContent = {
  eyebrow: 'Our story',
  headline:
    'Born in Nairobi. *Bottled* with intention. Sent into the world to be unforgettable.',
  body: 'Loveli Luxury Scents began with a small idea: that fragrance should feel like a love letter, not a label. We blend in small batches, source carefully, and trust the long finish. Every bottle is hand-finished, signed, and sent.',
  stats: [
    { k: 'Hand-blended', v: 'Small batches, never machine-rushed.' },
    { k: 'Long-wear', v: '8–12 hours on skin. Eau de Parfum strength.' },
    { k: 'Made in Kenya', v: 'Designed and finished in Nairobi.' },
  ],
}

/** home_philosophy — the "Presence before words" editorial block. */
export const philosophySchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  body: z.string(),
  quote: z.string(),
})
export type PhilosophyContent = z.infer<typeof philosophySchema>
export const PHILOSOPHY_DEFAULTS: PhilosophyContent = {
  eyebrow: 'The philosophy',
  headline:
    'Presence before words. *Remembered long after you leave.*',
  body: "We compose for the dry-down: the hours after the first impression, when a fragrance stops being something you wear and becomes part of how you're remembered. Eau de Parfum strength, blended in small batches, balanced to last.",
  quote:
    'A scent should arrive a moment before you do, and stay a moment after.',
}

/** footer — brand intro + tagline + copyright + closing line. Link structure stays in code. */
export const footerSchema = z.object({
  brandName: z.string(),
  tagline: z.string(),
  copyrightName: z.string(),
  closingLine: z.string(),
})
export type FooterContent = z.infer<typeof footerSchema>
export const FOOTER_DEFAULTS: FooterContent = {
  brandName: 'Loveli Luxury Scents',
  tagline:
    'Modern African fragrance, made in Nairobi and delivered with care.',
  copyrightName: 'Loveli Luxury International',
  closingLine: 'Blended in Nairobi · Shipped with intention',
}

/** home_faq — the bottom-of-page Q&A. */
export const faqSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  items: z.array(z.object({ q: z.string(), a: z.string() })),
})
export type FaqContent = z.infer<typeof faqSchema>
export const FAQ_DEFAULTS: FaqContent = {
  eyebrow: 'Quiet answers',
  headline: 'Things people *ask*.',
  items: [
    {
      q: 'How long does a Loveli Luxury fragrance last?',
      a: 'Eau de Parfum concentration. Expect 8–12 hours on skin and even longer on fabric, with a refined dry-down that softens through the day.',
    },
    {
      q: 'Is delivery available outside Nairobi?',
      a: 'Yes, we ship across Kenya and to neighbouring countries. Free delivery in Nairobi on orders above Kes 5,000.',
    },
    {
      q: 'Are these bottles refillable?',
      a: 'Each 30ml and 50ml bottle is designed to be cherished. A refill programme for our partners is on the way.',
    },
    {
      q: 'Can I join the partner program?',
      a: 'By invitation only. An existing partner shares an invitation code. You join by paying the registration fee and choosing one or more 50ml perfumes. You begin as an Ambassador and earn retail margin on every bottle you place. Five ranks (Ambassador, Active, Gold Director, Platinum Director, Crown President) are based on verified retail sales, Active Directs and group volume, never recruitment alone. See the partner program for the full structure.',
    },
    {
      q: 'Are your fragrances tested on animals?',
      a: 'Never. Our blends are vegan-friendly and cruelty-free, and we work only with suppliers who hold the same standard.',
    },
  ],
}

/** partner_landing — hero block on /partners. */
export const partnerLandingSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  microtag: z.string(),
  subhead: z.string(),
  ctaLabel: z.string(),
  secondaryLabel: z.string(),
  secondaryHref: z.string(),
  inviteNote: z.string(),
})
export type PartnerLandingContent = z.infer<typeof partnerLandingSchema>
export const PARTNER_LANDING_DEFAULTS: PartnerLandingContent = {
  eyebrow: 'Loveli Luxury · Partner Program',
  headline: 'Build a *luxury fragrance* business',
  microtag: 'Five ranks · 50ml product · Grow through retail sales',
  subhead:
    'An invite-only partner program for people building a fragrance business in their area. Join with the registration fee and one or more perfumes, then grow through personal bottles, Active Directs and group volume.',
  ctaLabel: 'Join via your sponsor',
  secondaryLabel: 'See the rank ladder ↓',
  secondaryHref: '#tiers',
  inviteNote: 'Invite-only · Sponsor code required',
}

/** Shared shape for a policy section block: a title, an optional body, an
 *  optional bullet list, and an optional two-column table. The renderer
 *  decides what to show based on which fields the admin filled in. */
const policySectionSchema = z.object({
  title: z.string(),
  body: z.string().optional(),
  bullets: z.array(z.string()).optional(),
})

/** policies_authenticity — body of /policies/authenticity. */
export const policiesAuthenticitySchema = z.object({
  lead: z.string(),
  intro: z.string(),
  sections: z.array(policySectionSchema),
})
export type PoliciesAuthenticityContent = z.infer<typeof policiesAuthenticitySchema>
export const POLICIES_AUTHENTICITY_DEFAULTS: PoliciesAuthenticityContent = {
  lead: 'Every fragrance is authenticity verified before dispatch.',
  intro:
    "Counterfeit perfume is a real problem in our region. We built Loveli Luxury knowing that a customer's first concern isn't going to be the scent. It's whether the bottle in their hand is the real one. So our process starts well before the prompt to pay.",
  sections: [
    {
      title: 'How we source',
      body: "Our inventory comes from a small set of authorised distributors. These are the same channels that supply premium retail across East Africa. Each consignment arrives with its house documentation. Anything that doesn't match the paperwork is returned at our expense, not yours.",
    },
    {
      title: 'How we store',
      body: 'Temperature-stable, low-light storage in our Nairobi facility. Fragrance is fragile chemistry: heat, light, and rough handling change how a scent behaves on skin. Our handling protocol exists so the bottle on your dresser smells exactly like the one the house signed off.',
    },
    {
      title: 'How we seal',
      body: 'Every order is hand-inspected, sealed, and tamper-banded before the rider arrives. Open the box on camera if you want. We keep unboxing-friendly packaging because we expect you to check it. If the seal is broken on arrival, do not accept the parcel. Ping our Concierge and we send a replacement.',
    },
    {
      title: 'If something is wrong',
      body: "We refund or replace anything that fails authenticity inspection post-delivery. See the refund policy for the mechanics. The fastest route is Concierge on WhatsApp. We don't make you write an email and wait.",
    },
  ],
}

/** policies_delivery — body of /policies/delivery. */
export const policiesDeliverySchema = z.object({
  lead: z.string(),
  intro: z.string(),
  zonesHeading: z.string(),
  zonesHeaderLeft: z.string(),
  zonesHeaderRight: z.string(),
  zones: z.array(z.object({ label: z.string(), window: z.string() })),
  sections: z.array(policySectionSchema),
})
export type PoliciesDeliveryContent = z.infer<typeof policiesDeliverySchema>
export const POLICIES_DELIVERY_DEFAULTS: PoliciesDeliveryContent = {
  lead: 'Honest timelines, real couriers.',
  intro:
    'We dispatch from Nairobi the same day if your order is paid and confirmed before 14:00 EAT, the next morning otherwise. From there, time depends on where you are. The table below reflects what we actually see, not the marketing version.',
  zonesHeading: 'By region',
  zonesHeaderLeft: 'Where you are',
  zonesHeaderRight: 'Expect',
  zones: [
    { label: 'Nairobi metro (CBD, Westlands, Kilimani, Kileleshwa, Karen, Lavington, Eastlands)', window: '24–48 hours' },
    { label: 'Kiambu, Machakos, Kajiado (peri-Nairobi)', window: '24–72 hours' },
    { label: 'Mombasa, Kisumu, Nakuru, Eldoret (major cities)', window: '2–3 business days' },
    { label: 'Western Kenya: Kakamega, Kisii, Bungoma, Busia', window: '2–4 business days' },
    { label: 'Coastal towns, Mt. Kenya region, Rift Valley counties', window: '3–5 business days' },
    { label: 'Far-flung counties (Lodwar, Mandera, Lamu, Marsabit)', window: '4–7 business days' },
  ],
  sections: [
    {
      title: 'Couriers we use',
      body: 'Within Nairobi metro: motorcycle riders, contactless drop, signed receipt. Across counties: G4S Courier or Wells Fargo. Far-flung addresses: Posta EMS with G4S last-mile where available. We pick the route that actually delivers, not the cheapest one, and absorb the difference.',
    },
    {
      title: 'Tracking',
      body: 'Every order gets a unique order number (looks like LL-2026-000123). Visit loveli-luxury.vercel.app/track/<your-order-number> any time to see status, courier reference, and expected delivery. No login required. The order number is enough.',
    },
    {
      title: 'If a delivery is late',
      body: "Ping our Concierge on WhatsApp with the order number. We chase the courier and reroute on our side; you don't sit on hold. If your delivery is more than 48 hours beyond the window above, we waive the next dispatch fee on your next order.",
    },
  ],
}

/** policies_refund — body of /policies/refund. */
export const policiesRefundSchema = z.object({
  lead: z.string(),
  intro: z.string(),
  qualifiesHeading: z.string(),
  qualifiesIntro: z.string(),
  qualifies: z.array(z.string()),
  sections: z.array(policySectionSchema),
})
export type PoliciesRefundContent = z.infer<typeof policiesRefundSchema>
export const POLICIES_REFUND_DEFAULTS: PoliciesRefundContent = {
  lead: 'Sealed and second-guessing? Send it back.',
  intro:
    "Fragrance is a hygiene product. Once a bottle is opened, the next person in line can't safely receive it. That's why our refund policy looks the way it does: strict on the seal, generous on everything else.",
  qualifiesHeading: 'What qualifies',
  qualifiesIntro: 'A standard refund applies when:',
  qualifies: [
    'The tamper seal is intact and the cellophane is unbroken.',
    'The bottle is unsprayed.',
    'You contact us within 7 days of delivery (we look at your tracking).',
    'The packaging is in the same condition we sent it in.',
  ],
  sections: [
    {
      title: 'How to start one',
      body: "WhatsApp our Concierge with your order number. We arrange return collection at our cost. We don't ask you to find a courier. Once we receive the parcel and confirm the seal, we reverse the M-Pesa transaction within 5 business days. You'll see the reversal on the same number you paid from.",
    },
    {
      title: 'If the bottle is wrong on arrival',
      body: "Damaged in transit, wrong fragrance picked, seal compromised, scent clearly off. That's not a refund situation, that's our error and we replace immediately. Open the box on camera if you can; it speeds the loop. See the authenticity policy for what happens next.",
    },
    {
      title: "What doesn't qualify",
      body: "Sprayed bottles. Bottles outside the 7-day window. Discovery / sample kits (these are non-refundable by their nature). Custom or limited-edition orders where the bottle has been engraved or otherwise personalised. Anything where the seal or cellophane has been broken, even if the scent itself wasn't applied.",
    },
    {
      title: 'Distributor / partner returns',
      body: "Starter package purchases follow the same 7-day, sealed-only rule. The partner agreement explains what a refund means for commissions and partner levels. In short, a refunded order does not earn commission, and any commission already paid is taken from a later payout.",
    },
  ],
}

/** home_find_your_scent — homepage quiz copy. The `tag` enum is bound to
 *  the FRAGRANCES['vibe'] values in catalog/fragrance-meta.ts and must
 *  stay in sync — only the human-readable labels are editable. */
const fragranceVibeSchema = z.enum(['soft', 'mysterious', 'fresh', 'bold', 'warm'])
export const findYourScentSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  resultEyebrow: z.string(),
  meetCtaPrefix: z.string(),
  tryAgainLabel: z.string(),
  steps: z.array(
    z.object({
      prompt: z.string(),
      options: z.array(
        z.object({ label: z.string(), tag: fragranceVibeSchema }),
      ),
    }),
  ),
})
export type FindYourScentContent = z.infer<typeof findYourScentSchema>
export const FIND_YOUR_SCENT_DEFAULTS: FindYourScentContent = {
  eyebrow: 'Find your scent',
  headline: 'A small ritual, *three quiet questions*.',
  resultEyebrow: 'Your scent',
  meetCtaPrefix: 'Meet',
  tryAgainLabel: 'Try again',
  steps: [
    {
      prompt: 'How do you want to enter the room?',
      options: [
        { label: 'Quietly, but unforgettably', tag: 'soft' },
        { label: 'Like the door just opened on a story', tag: 'mysterious' },
        { label: 'Sun-warm, smiling', tag: 'fresh' },
        { label: 'Tailored. Decided.', tag: 'bold' },
      ],
    },
    {
      prompt: 'Pick a time of day:',
      options: [
        { label: 'First light through linen curtains', tag: 'fresh' },
        { label: 'Gold hour, almost dusk', tag: 'warm' },
        { label: 'Late, candlelit, low music', tag: 'mysterious' },
        { label: 'High noon, somewhere by the sea', tag: 'fresh' },
      ],
    },
    {
      prompt: 'And finally, your evening looks like:',
      options: [
        { label: 'Slow dinner, longer conversation', tag: 'warm' },
        { label: 'A single glass, a balcony, a friend', tag: 'soft' },
        { label: 'A room you walked into and changed', tag: 'bold' },
        { label: 'A walk you take alone, on purpose', tag: 'mysterious' },
      ],
    },
  ],
}

/**
 * partner_ids — the Income Disclosure Statement at /ids.
 *
 * Locked design rules (don't soften these in copy edits — they're what
 * makes the page legally and ethically defensible):
 *  1. Stats describe REALITY, not projection. Median, % earning > 0, recoup
 *     rate, top 5% — all distribution facts, never best-case promises.
 *  2. The simulator (if shown) MUST default to median, not optimistic.
 *  3. The "Rules of the program" block is non-negotiable: commission only
 *     on confirmed retail sales; no recruitment commissions; starter is not
 *     commissionable; refunds trigger clawbacks; no income is guaranteed.
 *  4. Every figure carries a "DATA PENDING" marker until real numbers exist.
 *
 * Edited at /admin/content/site/partner_ids by the owner.
 */
export const partnerIdsSchema = z.object({
  eyebrow: z.string(),
  /** Use *asterisks* to mark italic + primary-color emphasis. */
  headline: z.string(),
  lead: z.string(),
  /** Free-form reporting-period label (e.g. "January–March 2026"). */
  periodLabel: z.string(),
  /** What "active partner" means + how numbers are computed. */
  methodology: z.string(),
  stats: z
    .array(
      z.object({
        label: z.string(),
        value: z.string(),
        sub: z.string(),
      }),
    )
    .min(3)
    .max(6),
  /** The non-negotiable program rules — render as a fixed bullet list. */
  rules: z.array(z.string()).min(3),
  photo: z
    .object({
      url: z.string().url().optional(),
      alt: z.string(),
      caption: z.string(),
    })
    .optional(),
  footnote: z.string(),
})
export type PartnerIdsContent = z.infer<typeof partnerIdsSchema>
export const PARTNER_IDS_DEFAULTS: PartnerIdsContent = {
  eyebrow: 'Income disclosure',
  headline: 'What partners *actually* earn',
  lead: 'We publish this because you deserve real numbers, not a sales pitch. The stats below describe the verified earnings distribution across active Loveli partners over the reporting period. They are not projections, promises, or testimonials.',
  periodLabel: 'Reporting period: Figures not available yet',
  methodology:
    'An "active partner" is one who placed at least one verified retail sale in the 90 days before the period end. All amounts are gross commission earnings before taxes and personal expenses. Refunded and clawed-back commissions are excluded. The same numbers are visible in your partner dashboard under Earnings.',
  stats: [
    {
      label: 'Median monthly earnings',
      value: 'KES 0',
      sub: 'Active partners. Figures not available yet.',
    },
    {
      label: 'Active partners earning more than zero',
      value: '0%',
      sub: 'Of all active partners in the period. Figures not available yet.',
    },
    {
      label: 'Partners who recouped their starter cost',
      value: '0%',
      sub: 'Cumulative earnings compared with Starter package cost. Figures not available yet.',
    },
    {
      label: 'Top 5% monthly earnings',
      value: 'KES 0',
      sub: 'Highest-earning 5% of active partners. Figures not available yet.',
    },
  ],
  rules: [
    'Commissions are paid only on confirmed retail sales. Recruiting a partner does not earn commission.',
    'Your own Starter package purchase does not earn commission.',
    'If an order is refunded, any related commission is taken from a later payout.',
    'To remain active, a partner must make verified retail sales each month.',
    'No income is guaranteed. Earnings depend entirely on retail performance.',
  ],
  photo: {
    alt: 'Loveli Luxury partner program editorial photograph',
    caption: 'Income figures will be added here',
  },
  footnote:
    'Loveli Luxury Scents is committed to transparent compensation. If you ever see a recruitment-only pitch in our name, that pitch is not from us. Report it: concierge@loveliluxuryscents.com.',
}

/** home_marquee — the brand marquee strip. */
export const marqueeSchema = z.object({
  separator: z.string(),
  items: z.array(z.string()),
})
export type MarqueeContent = z.infer<typeof marqueeSchema>
export const MARQUEE_DEFAULTS: MarqueeContent = {
  separator: '✦',
  items: [
    'OCEAN DESIRE',
    'CRIMSON NOIR',
    'SUNSET BLISS',
    'AFAR',
    'VANILLA SMOKE',
    'ROSE NOIR',
    'LOVELI SIGNATURE',
    'AMBER VESPERS',
    'WHITE OUD',
  ],
}


/** policies_shell — shared hero and navigation copy for all policy pages. */
export const policiesShellSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  subhead: z.string(),
  sectionsLabel: z.string(),
  authenticityLabel: z.string(),
  deliveryLabel: z.string(),
  refundLabel: z.string(),
  lastUpdatedLabel: z.string(),
  lastUpdated: z.string(),
})
export type PoliciesShellContent = z.infer<typeof policiesShellSchema>
export const POLICIES_SHELL_DEFAULTS: PoliciesShellContent = {
  eyebrow: 'The Loveli promise',
  headline: 'Care, stated clearly.',
  subhead:
    'The details behind every order: how we verify it, how it travels, and how we make things right when they do not arrive as they should.',
  sectionsLabel: 'Our promises',
  authenticityLabel: 'Authenticity',
  deliveryLabel: 'Delivery',
  refundLabel: 'Returns & refunds',
  lastUpdatedLabel: 'Last updated',
  lastUpdated: '18 May 2026',
}

/** shop_landing — editorial heading on the public collection page. */
export const shopLandingSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  subhead: z.string(),
  countSingular: z.string(),
  countPlural: z.string(),
  emptyMessage: z.string(),
})
export type ShopLandingContent = z.infer<typeof shopLandingSchema>
export const SHOP_LANDING_DEFAULTS: ShopLandingContent = {
  eyebrow: 'The collection',
  headline: 'Scent, selected with intention.',
  subhead:
    'A considered wardrobe of fragrance for the way you want to arrive, linger, and be remembered.',
  countSingular: 'fragrance, chosen for presence.',
  countPlural: 'fragrances, chosen for presence.',
  emptyMessage: 'A new collection is being prepared. Please return shortly.',
}

/** bundles_landing — editorial heading on the public bundles page. */
export const bundlesLandingSchema = z.object({
  eyebrow: z.string(),
  headline: z.string(),
  subhead: z.string(),
  countSingular: z.string(),
  countPlural: z.string(),
  emptyMessage: z.string(),
})
export type BundlesLandingContent = z.infer<typeof bundlesLandingSchema>
export const BUNDLES_LANDING_DEFAULTS: BundlesLandingContent = {
  eyebrow: 'Curated sets',
  headline: 'More to remember, together.',
  subhead:
    'Fragrance sets made to make choosing easier.',
  countSingular: 'set',
  countPlural: 'sets',
  emptyMessage: 'No sets are available right now. Please check again later.',
}


/** partner_program — editorial sections and optional photography on /partners.
 * Rate, pricing, commission, KYC, and rank-enforcement rules deliberately
 * remain in code so content changes cannot weaken program safeguards. */
export const partnerProgramSchema = z.object({
  philosophyEyebrow: z.string(),
  philosophyHeadline: z.string(),
  philosophyBody: z.string(),
  philosophyNote: z.string(),
  tiersEyebrow: z.string(),
  tiersHeadline: z.string(),
  tiersLead: z.string(),
  tiersFootnote: z.string(),
  storiesEyebrow: z.string(),
  storiesHeadline: z.string(),
  storiesBody: z.string(),
  startEyebrow: z.string(),
  startHeadline: z.string(),
  photo: z.object({
    heroUrl: z.string().url().optional(),
    heroAlt: z.string(),
    heroCaption: z.string(),
    storiesUrl: z.string().url().optional(),
    storiesAlt: z.string(),
    storiesCaption: z.string(),
  }),
})
export type PartnerProgramContent = z.infer<typeof partnerProgramSchema>
export const PARTNER_PROGRAM_DEFAULTS: PartnerProgramContent = {
  philosophyEyebrow: 'How the programme works',
  philosophyHeadline: 'A partner programme built on real sales.',
  philosophyBody:
    'Loveli Luxury works with people who place fragrance with care. The programme is for creators, resellers, and regional curators who value the product and their customers. Trust matters in every sale.',
  philosophyNote:
    'Every commission is tied to a verified retail order. Recruitment alone is never rewarded.',
  tiersEyebrow: 'The ranks',
  tiersHeadline: 'Five ranks. One clear standard.',
  tiersLead:
    'Ranks are earned through personal bottles, Active Directs and group volume over time. They show progress in the business, not a promise of income.',
  tiersFootnote:
    'Pricing, retail margins, and complete earning information are shared with approved partners inside the portal.',
  storiesEyebrow: 'Partner stories',
  storiesHeadline: 'Real stories, when they are verified.',
  storiesBody:
    'We will publish partner stories only when they are verified and representative. Until then, we focus on the programme, the product, and the work of building a business.',
  startEyebrow: 'How to start',
  startHeadline: 'Join with the registration fee and one or more perfumes.',
  photo: {
    heroAlt: 'Loveli Luxury partner program editorial photograph',
    heroCaption: 'The partner programme',
    storiesAlt: 'Loveli Luxury partner community editorial photograph',
    storiesCaption: 'Life around the programme',
  },
}

// ---------------------------------------------------------------------
// Registry — single source of truth that ties each key to its schema,
// defaults, and editor metadata.
// ---------------------------------------------------------------------

type RegistryEntry<T extends z.ZodTypeAny> = {
  schema: T
  defaults: z.infer<T>
  /** Human-readable label shown on the admin index page. */
  label: string
  /** One-line description shown on the admin index page. */
  description: string
}

export const SECTIONS = {
  home_hero: {
    schema: heroSchema,
    defaults: HERO_DEFAULTS,
    label: 'Homepage hero',
    description: 'The headline section above the fold — eyebrow, headline, sub-text, primary CTA.',
  },
  home_trust_strip: {
    schema: trustStripSchema,
    defaults: TRUST_STRIP_DEFAULTS,
    label: 'Trust strip',
    description: 'The four pillars under the hero (authenticity, M-Pesa, concierge, delivery).',
  },
  home_story: {
    schema: storySchema,
    defaults: STORY_DEFAULTS,
    label: 'Story section',
    description: 'The brand-origin block on the homepage with the three stats.',
  },
  home_philosophy: {
    schema: philosophySchema,
    defaults: PHILOSOPHY_DEFAULTS,
    label: 'Philosophy section',
    description: 'The "Presence before words" editorial block on the homepage.',
  },
  home_faq: {
    schema: faqSchema,
    defaults: FAQ_DEFAULTS,
    label: 'FAQ',
    description: 'Frequently asked questions at the bottom of the homepage.',
  },
  footer: {
    schema: footerSchema,
    defaults: FOOTER_DEFAULTS,
    label: 'Footer',
    description: 'Footer brand intro, tagline, copyright line, and the closing tagline. Link columns stay in code (they tie to real routes).',
  },
  partner_landing: {
    schema: partnerLandingSchema,
    defaults: PARTNER_LANDING_DEFAULTS,
    label: 'Partner landing — hero',
    description: 'The hero block at the top of /partners. Eyebrow, headline, sub-text, microtag, primary and secondary CTAs, and the invite-only note. The rest of the page stays in code.',
  },
  policies_shell: {
    schema: policiesShellSchema,
    defaults: POLICIES_SHELL_DEFAULTS,
    label: 'Policies — page shell',
    description: 'The shared editorial hero, navigation labels, and update stamp used across the authenticity, delivery, and refund pages. Policy routes remain fixed in code.',
  },
  shop_landing: {
    schema: shopLandingSchema,
    defaults: SHOP_LANDING_DEFAULTS,
    label: 'Collection — page heading',
    description: 'The eyebrow, headline, introduction, availability line, and empty-state message at the top of /shop. Product names, images, and prices remain catalog-controlled.',
  },
  bundles_landing: {
    schema: bundlesLandingSchema,
    defaults: BUNDLES_LANDING_DEFAULTS,
    label: 'Bundles — page heading',
    description: 'The eyebrow, headline, introduction, availability line, and empty-state message at the top of /bundles. Bundle items and prices remain catalog-controlled.',
  },
  policies_authenticity: {
    schema: policiesAuthenticitySchema,
    defaults: POLICIES_AUTHENTICITY_DEFAULTS,
    label: 'Policy — Authenticity',
    description: 'The authenticity policy page body. Lead title, intro paragraph, then a list of titled sections. Each section can have a body paragraph and / or a bullet list.',
  },
  policies_delivery: {
    schema: policiesDeliverySchema,
    defaults: POLICIES_DELIVERY_DEFAULTS,
    label: 'Policy — Delivery',
    description: 'The delivery policy page body, including the zone-to-window table. Edit zone rows to update the table.',
  },
  policies_refund: {
    schema: policiesRefundSchema,
    defaults: POLICIES_REFUND_DEFAULTS,
    label: 'Policy — Refund',
    description: 'The refund policy page body, including the "What qualifies" bullet list.',
  },
  home_find_your_scent: {
    schema: findYourScentSchema,
    defaults: FIND_YOUR_SCENT_DEFAULTS,
    label: 'Find-your-scent quiz',
    description: 'The homepage quiz prompts and result labels. The matching engine stays in code (tags must remain valid fragrance vibes).',
  },
  home_marquee: {
    schema: marqueeSchema,
    defaults: MARQUEE_DEFAULTS,
    label: 'Homepage marquee',
    description: 'The brand marquee strip on the homepage. List items scroll across the band with the separator between them.',
  },
  partner_program: {
    schema: partnerProgramSchema,
    defaults: PARTNER_PROGRAM_DEFAULTS,
    label: 'Partner Program — editorial sections',
    description: 'The public /partners editorial copy and its two optional photography spaces. Rates, pricing, commission logic, KYC rules, and rank enforcement stay locked in code.',
  },
  partner_ids: {
    schema: partnerIdsSchema,
    defaults: PARTNER_IDS_DEFAULTS,
    label: 'Income Disclosure Statement (/ids)',
    description: 'The public Income Disclosure Statement page. Edit the eyebrow, headline, lead paragraph, reporting period label, methodology, the stats grid (median, % earning, recoup rate, etc.), the non-negotiable rules bullets, and the footnote. Keep figures factual; replace "DATA PENDING" placeholders with verified numbers before launch.',
  },
} as const satisfies Record<string, RegistryEntry<z.ZodTypeAny>>

export type SectionKey = keyof typeof SECTIONS
export type SectionContent<K extends SectionKey> = z.infer<
  (typeof SECTIONS)[K]['schema']
>

export const SECTION_KEYS = Object.keys(SECTIONS) as SectionKey[]

// ---------------------------------------------------------------------
// Reads
// ---------------------------------------------------------------------

/**
 * Fetch and parse a section's content. Falls back to the in-code default
 * if the DB row is missing or malformed — so a bad edit, a fresh install,
 * or a network blip can never break the site.
 */
export async function getSection<K extends SectionKey>(
  key: K,
): Promise<SectionContent<K>> {
  const service = createServiceClient()

  // TODO(types): regenerate database.ts post-035 to drop this cast.
  let res: { data: { body: unknown } | null; error: { message: string } | null }
  try {
    res = await (service.from('site_content' as never) as unknown as {
      select: (cols: string) => {
        eq: (col: string, val: unknown) => {
          maybeSingle: () => Promise<{
            data: { body: unknown } | null
            error: { message: string } | null
          }>
        }
      }
    })
      .select('body')
      .eq('section_key', key)
      .maybeSingle()
  } catch (e) {
    // postgrest-js re-throws on a network-level failure (DNS down,
    // Supabase outage, CI's placeholder URL) instead of returning it as
    // `{ error }` — it only normalises HTTP-level failures that way. This
    // was previously uncaught here, which directly contradicted this
    // function's own contract above ("a network blip can never break the
    // site") and, because this is awaited directly in the public route
    // group layout for EVERY page, took down the entire storefront on any
    // Supabase network hiccup. Fail closed to the in-code default, same
    // as the DB-error and validation-failure paths below.
    console.warn(
      `[site-content] '${key}' fetch failed, falling back to defaults:`,
      (e as Error).message,
    )
    return SECTIONS[key].defaults as SectionContent<K>
  }

  if (res.error || !res.data) {
    return SECTIONS[key].defaults as SectionContent<K>
  }

  const parsed = SECTIONS[key].schema.safeParse(res.data.body)
  if (!parsed.success) {
    // eslint-disable-next-line no-console
    console.warn(
      `[site-content] '${key}' failed schema validation, falling back to defaults:`,
      parsed.error.message,
    )
    return SECTIONS[key].defaults as SectionContent<K>
  }

  return parsed.data as SectionContent<K>
}

/**
 * Bulk read — fetch every section for the admin index page in one round
 * trip. Returns a map keyed by section_key; missing keys silently fall
 * back to defaults via getSection on render.
 */
export async function getAllSectionMetas(): Promise<
  Array<{ key: SectionKey; label: string; description: string; updatedAt: string | null }>
> {
  const service = createServiceClient()

  const res = (await (service.from('site_content' as never) as unknown as {
    select: (cols: string) => Promise<{
      data: Array<{ section_key: string; updated_at: string }> | null
      error: { message: string } | null
    }>
  })
    .select('section_key, updated_at'))

  const rowByKey = new Map<string, string>(
    (res.error ? [] : res.data ?? []).map((r) => [r.section_key, r.updated_at]),
  )

  return SECTION_KEYS.map((key) => ({
    key,
    label: SECTIONS[key].label,
    description: SECTIONS[key].description,
    updatedAt: rowByKey.get(key) ?? null,
  }))
}
