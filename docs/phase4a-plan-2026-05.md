# Phase 4a plan — Trust infrastructure

**Reference:** §8 of the original transformation prompt + the brand brief sections on Trust Engineering and "Cheap brands scream luxury / real luxury removes friction."

Phase 4 is too wide to do in one session — its nine bullets span 4–6 weeks of work in a typical org. Splitting:

| Sub-phase | Scope | This session? |
|---|---|---|
| **4a — Trust infrastructure** | WhatsApp Concierge button, 3 policy pages (authenticity / refund / delivery), order tracking page, founder story scaffold, header + footer integration | ✅ Yes |
| **4b — Discovery + retention** | Wishlist, recently viewed, abandoned cart recovery (email + WhatsApp option) | Follow-up |
| **4c — Engagement** | Fragrance finder quiz (6–8 questions), discovery kits (sample set SKU), AI recommendation placeholder | Follow-up |
| **4d — Loyalty + referral** | Customer loyalty points (verified-orders only), customer-to-customer referral (discount codes, NOT commissions — distinct from the partner program) | Follow-up |

Each follow-up sub-phase needs its own plan.

This document is the §11.1 plan for **Phase 4a only**. No source files modified until approved.

---

## 1. WhatsApp Concierge floating button

### Component shape

New file: `src/components/concierge/WhatsAppConcierge.tsx`

- Client component, fixed bottom-right, z-50.
- Round button, 56 × 56 px, brand-aware border (subtle `--primary` ring), WhatsApp logo svg inline.
- Tap → opens `https://wa.me/<NUMBER>?text=<URL-encoded prefilled message>` in a new tab.
- **Prefilled message is product-aware** when rendered on a PDP — `useState(window.location.pathname)` reads the path and the surrounding `<ProductContext>` (or `data-product-slug` attribute on the body) injects the product name.
- Off the PDP, the message is generic: *"Hi Loveli Concierge — I'd like help choosing a fragrance."*
- On the PDP: *"Hi Loveli Concierge — I'm browsing {{Product Name}} and have a question."*

### Layout integration

- Mount in `src/app/(public)/layout.tsx` so it appears on every public page (cart, checkout, account, distributor signup get it too — luxury demands consistent availability).
- Do NOT mount in `(admin)` — admins don't need the concierge.

### Configuration

- Env var: `NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER` (E.164, e.g. `+254712345678`).
- If unset, the component returns null silently (don't break the layout if env is incomplete).
- Validated in `src/lib/env.ts`'s public schema (optional, but warns in `/admin/diagnostics`).

### Accessibility

- `aria-label="Concierge support — chat on WhatsApp"`
- `role="button"`
- Focus ring matches `--primary` hsl on focus.
- Hidden via `prefers-reduced-motion` only for the pulse animation, not the button itself.

---

## 2. Policy pages — authenticity / refund / delivery

Three new pages at `/policies/authenticity`, `/policies/refund`, `/policies/delivery`.

### File layout

```
src/app/(public)/policies/
├── layout.tsx       — shared sidebar with the three policies + last-updated stamp
├── authenticity/page.tsx
├── refund/page.tsx
└── delivery/page.tsx
```

### Copy direction (editorial, Kenyan-real)

I'll draft conservative defaults. **Owner reviews + tweaks the numbers before they go live.**

**Authenticity** — sourcing claim, packaging integrity, sealed dispatch, post-arrival authenticity recourse. Copy seed from the brand brief: *"Every fragrance is authenticity verified before dispatch."*

**Refund** — 7-day refund window from delivery for unopened bottles; opened bottles non-refundable per industry norm (fragrance is a hygiene product); refund initiated via Concierge WhatsApp; M-Pesa reversal within 5 business days; clear escalation path.

**Delivery** — Kenyan zones with realistic times:
- Nairobi & Kiambu: 24–48h
- Mombasa, Kisumu, Nakuru: 2–3 days
- Western Kenya (Kakamega, Kisii, Eldoret) & Coast: 2–4 days
- Far-flung counties: 3–7 days
- Riders for Nairobi metro, G4S Courier or Wells Fargo for cross-county, EMS for everywhere else.
- Tracking: order number can be checked at `/track/<order-number>`.

### Footer + link integration

- Add **Policies** column to `src/components/footer/PublicFooter.tsx` linking the three.
- Add references inline:
  - Authenticity badge linked from product page + cart + checkout (`/policies/authenticity`).
  - Refund + Delivery linked from `/checkout/return` and from `/cart`.

---

## 3. Order tracking page

New page: `src/app/(public)/track/[orderNumber]/page.tsx`

### Behaviour

- Public route — **does not require login**. Just the `order_number` in the URL.
- Reads from the `orders` table via service-role client (RLS bypass with explicit scope check on order_number).
- Displays:
  - Order number, kind, status (pending / paid / fulfilled / shipped / delivered / refunded / failed / cancelled / expired)
  - Customer name (masked: "A**** A****" — first letter + asterisks per word for privacy on a public URL)
  - Total, paid_at timestamp if paid
  - Delivery target zone (city only — no street address on a public page)
  - Status timeline: visual stepper with the standard transitions
  - If shipped: courier name + tracking number from `orders.notes` if present
  - WhatsApp Concierge link for help

### Security note

- Order number is the only auth — anyone with the URL sees the order. Mitigate by:
  - Order numbers are unguessable enough (`LL-YYYY-NNNNNN`) for sandbox testing
  - Production: append a 4-character random suffix at order_number generation time (deferred to Phase 4b — for now Phase 4a accepts the existing numbering)
- No `/track/list` or wildcard route — must know the exact number.

---

## 4. Founder story scaffold

New page: `src/app/(public)/story/page.tsx`

### Structure (editorial, no payment / no MLM)

1. Eyebrow: "About Loveli Luxury"
2. Headline (h1): brand vision — owner's wording. Draft seed: *"Modern African luxury, told in scent."*
3. Founder portrait + name block. Draft placeholder image; owner replaces.
4. Three editorial paragraphs (placeholder copy; owner refines):
   - Origin story — why this brand exists
   - Sourcing + craft philosophy — why these specific fragrances
   - Vision — where Loveli Luxury is going (regional expansion, fragrance education, partner program as career path)
5. Pull-quote
6. Closing CTA: explore the collection (`/shop`) + WhatsApp Concierge link.

### Footer + nav integration

- Add **Story** to the public header nav (replacing the current `Story` link if it exists, or adding it cleanly).
- Footer "About" column links here.

### Copy authoring

- I draft. Owner reviews. Until the owner replaces, the draft is marked with a small `[draft — owner review pending]` ribbon. The ribbon hides automatically once the owner edits the file and removes the placeholder marker.

---

## 5. Header + footer integration

### Header
- Add a small **Concierge** text link in the desktop nav next to the existing nav items, mobile-menu drawer too. Distinct from the floating WhatsApp button for users who prefer text links.

### Footer (`src/components/footer/PublicFooter.tsx`)
- New columns:
  - **Shop** — existing links
  - **Brand** — Story, Journal (placeholder for §10 content engine)
  - **Policies** — Authenticity, Refund, Delivery, Order tracking
  - **Concierge** — WhatsApp link, email (if env'd), business hours
- Brand mark at the bottom-left, small social icons (Instagram / TikTok placeholders) at the bottom-right.

---

## 6. Tests

Pure functions + integration where it matters:

- `tests/unit/whatsapp-link.test.ts` — pure function `buildConciergeLink(phone, message)` → encoded `https://wa.me/...?text=...` URL. Boundary cases: missing phone, special chars in message.
- `tests/unit/order-tracking-mask.test.ts` — pure function `maskRecipientName('Mary Akinyi Achieng')` → `'M*** A***** A******'`. Verifies single-word, multi-word, special chars.
- No tests for the policy pages (pure content).

---

## 7. Verification

- `npx tsc --noEmit`
- `npm test` (~309 tests total expected — 304 prior + 5 new)
- `npm run build` — assert all new routes register: `/policies/authenticity`, `/policies/refund`, `/policies/delivery`, `/track/[orderNumber]`, `/story`
- Smoke after deploy: hit each policy URL, verify the WhatsApp button appears on `/`, `/shop`, `/cart`, `/checkout`, `/account/*`.

---

## 8. Open questions for the owner

These need answers before code starts:

1. **WhatsApp number** — what's the E.164 number for the Concierge? Sample: `+254712345678`. Will be set as `NEXT_PUBLIC_WHATSAPP_CONCIERGE_NUMBER` on Vercel.
2. **Refund window** — default proposal is 7 days from delivery. Override?
3. **Delivery zones + times** — defaults proposed in §2 above. Override any of the zone times or add/remove zones?
4. **Founder content** — do you have founder paragraphs you want me to use verbatim, or should I draft Kenyan-luxury-tone placeholders for you to refine in the file?
5. **Founder portrait + brand mark** — do you have these assets, or use a neutral placeholder for now?

---

## 9. What I need from the owner to start

- WhatsApp number (#1 above) is the only **hard blocker** — without it the Concierge button can't function. Other defaults can ship and you tweak them later.
- Other answers are nice-to-have; safe defaults will ship if you say "use defaults."
