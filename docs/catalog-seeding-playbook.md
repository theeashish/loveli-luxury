# Catalog Seeding Playbook — Launch Catalog (9 Fragrances)

For: Ruth (data entry) + Ashish (sign-off) · Written: 2026-05-31.
Companion: `scripts/catalog-preflight.mjs` — run after each batch to see
what's still missing.

## What this playbook does

Walks you through entering the **9 launch fragrances** into the live catalog
via `/admin/catalog` so the home grid, PDPs, and partner-signup starter
package all work on the day Daraja Go-Live clears.

**Current state (as of 2026-05-31, verified via the preflight script):**

- ✗ Zero of the 9 launch slugs exist (`ocean-desire`, `coastal-sage`,
  `crimson-noir`, `black-torque`, `afar`, `vanilla-smoke`, `sunset-bliss`,
  `pink-allure`, `orange-aura`).
- ⚠ Two **test products** are active: `loveli-signature` (id 2) and
  `rose-noir` (id 1). These must be deactivated (not deleted — refunds
  + audit need them) before launch.
- The home grid + the `FRAGRANCES` marketing constant in
  `src/lib/catalog/fragrance-meta.ts` already point at the 9 expected
  slugs. So once the rows are seeded, the homepage starts working
  without any code change.

## The locked spec — every fragrance gets this exact shape

| Field | Value | Why locked |
|---|---|---|
| `slug` | one of the 9 above | The home grid + image filenames already align |
| `name` | from the `FRAGRANCES` constant | Owner-confirmed marketing names |
| `is_active` | TRUE | Otherwise it won't render anywhere |
| `description` | min 10 chars, ideally 60–200 words | PDP, SEO, plus the FragranceDetail block reads from this |
| **Variant — required**, 50ml: | | |
| &nbsp;&nbsp;&nbsp;`sku` | unique, free-form (e.g. `LL-OD-50`) | DB UNIQUE constraint |
| &nbsp;&nbsp;&nbsp;`size_ml` | 50 | The adopted comp plan is 50ml-only at launch |
| &nbsp;&nbsp;&nbsp;`retail_price_minor` | 280000 (= KES 2,800) | Per migration 029 (Ruth's adopted plan) |
| &nbsp;&nbsp;&nbsp;`distributor_price_minor` | 140000 (= KES 1,400 / IBO price) | Same |
| &nbsp;&nbsp;&nbsp;`pv_per_bottle` | 700 | The commission-engine multiplier; changing this changes every commission |
| &nbsp;&nbsp;&nbsp;`inventory_qty` | however many bottles you actually have | The `mark_order_paid` RPC enforces inventory_qty >= 0 — overselling rolls the whole transaction back |
| **Variant — optional**, 30ml: | | |
| &nbsp;&nbsp;&nbsp;`size_ml` | 30 | If you stock both sizes |
| &nbsp;&nbsp;&nbsp;`retail_price_minor` | 150000 (= KES 1,500) | Per masterplan §5 |
| &nbsp;&nbsp;&nbsp;`distributor_price_minor` | 70000 (= KES 700) | Per masterplan §5 |
| &nbsp;&nbsp;&nbsp;`pv_per_bottle` | 350 | Per masterplan §5 |
| **Image** | at least one upload via the admin image picker | Goes to the catalog Storage bucket; URL stored in `product_images` |
| **Fragrance meta** | top/heart/base notes + longevity + projection + occasions + (optionally) inspired-by | PDP detail block — without this it renders nothing |

If you set the wrong PV, every commission ever earned on that variant is
wrong. There is **no automatic recompute**. Get this right the first time.

## The 9 fragrances — copy/paste source data

This is what to paste into each form. Names + marketing text from
`src/lib/catalog/fragrance-meta.ts` (canonical). Update only if Ruth
prefers different copy.

| Slug | Name | Marketing notes line (descriptions can be longer) |
|---|---|---|
| `ocean-desire` | Ocean Desire | Sea salt, bergamot, white amber. *For mornings that taste of horizon.* |
| `coastal-sage` | Coastal Sage | Mediterranean sage, driftwood, sea breeze. *For long walks that end in salt-silver light.* |
| `crimson-noir` | Crimson Noir | Smoked oud, leather, aged whiskey. *For rooms warmed by candlelight and conversation.* |
| `black-torque` | Black Torque | Black amber, polished leather, bronzed musk. *For the cut of a tailored shoulder.* |
| `afar` | Afar | Saffron, frankincense, gilded rose. *For the romance of distant rooms.* |
| `vanilla-smoke` | Vanilla Smoke | Madagascan vanilla, cured tobacco, sandalwood. *For nights that stretch into stories.* |
| `sunset-bliss` | Sunset Bliss | Damask rose, jasmine sambac, soft musk. *For laughter on a balcony as the day softens.* |
| `pink-allure` | Pink Allure | Peony, lychee, powdered iris. *For the hush before being seen.* |
| `orange-aura` | Orange Aura | Blood orange, neroli, gilded vetiver. *For doorways flung open and rooms pulled close.* |

## Step-by-step (do this ONCE per fragrance, ~5 minutes each)

**Before you start the first one:** make sure the 9 product images exist
locally per `docs/photography-render-brief-2026-05.md` →
`docs/photography-prompts-2026-05-30.md`. They land in `public/products/`
and the admin image picker uploads them to the Storage bucket. If they
are not yet generated, you can seed everything else first and circle back
for images.

### Step 1 — Create the product

Browser → `https://loveli-luxury.vercel.app/admin/catalog/products/new`.

- **Slug:** the exact one from the table above. Lowercase, hyphens.
- **Name:** the exact one from the table above.
- **Description:** 60–200 words. The "notes line" above is a starting
  seed — expand into a short paragraph in Loveli's voice. Avoid the
  copy-purge banned words: *Discover, Hand-crafted, craft / craftsmanship,
  journey, unlock,* and no em-dashes (`—`).
- **Is active:** TRUE.

Save. You're back on the product detail page.

### Step 2 — Add the 50ml variant

From the product detail page, scroll to the Variants section, click
**Add variant**.

- **SKU:** e.g. `LL-OD-50` (Loveli, Ocean Desire, 50ml). Must be globally
  unique.
- **Size ml:** 50.
- **Retail price (KES):** 2800. (The admin form takes display KES; the DB
  stores minor units. Don't paste 280000 here — the form would interpret
  it as KES 280,000.)
- **Distributor price (KES):** 1400.
- **PV per bottle:** 700. **DO NOT CHANGE THIS** — see warning above.
- **Inventory qty:** the real bottle count you have. Can be 0 at first,
  but the variant must be created so the product is buyable when stock
  arrives.
- **Is active:** TRUE.

Save.

### Step 3 — (Optional) Add the 30ml variant

Only if you stock 30ml. Same form, with: size_ml=30, retail=1500,
distributor=700, pv_per_bottle=350.

### Step 4 — Upload the image

Same product detail page → Images → choose file → upload. The image
goes to the `catalog` Storage bucket and a `product_images` row is
written automatically. Use the exact filename from
`docs/photography-prompts-2026-05-30.md` (e.g. `ocean-desire.jpg`) so the
homepage card and the PDP gallery render the same image.

If you have multiple shots, mark the best one **primary** (the primary
is what the homepage grid + the PDP hero crop both use).

### Step 5 — Fill the fragrance-meta detail block

Product detail page → scroll to **Fragrance detail** → fill:

- **Top notes:** comma-separated (e.g. `bergamot, sea salt, lemon`)
- **Heart notes:** comma-separated
- **Base notes:** comma-separated
- **Longevity:** one short phrase (e.g. `6–8 hours on skin`)
- **Projection:** one short phrase (e.g. `intimate, close to skin`)
- **Climate note:** optional (e.g. `breathes best in warm air`)
- **Occasions:** comma-separated (e.g. `daytime, weekend brunch, travel`)
- **Story:** 1–2 short paragraphs of Loveli-voice copy that goes deeper
  than the description. This is the moody bit.
- **Scent family:** one of `fresh / floral / woody / oriental / gourmand`.
  Match the value in `FRAGRANCES` for the same slug (see
  `src/lib/catalog/fragrance-meta.ts`).
- **Inspired by:** optional. If the fragrance has an inspiration, name it.

Save.

### Step 6 — Re-run the preflight

After the first 1–2 fragrances, run:

```bash
npm run catalog:preflight
```

Confirm the seeded slug shows `✓ OK` and the others still show
`✗ MISSING`. If a seeded slug shows `⚠ INCOMPLETE`, the script names the
exact field that's wrong — fix and re-run.

Repeat steps 1–5 for every remaining slug, running preflight between
batches as a quick reality check.

## After all 9 are seeded

### Retire the test products

```
/admin/catalog/products/1   (rose-noir)        → set is_active = FALSE
/admin/catalog/products/2   (loveli-signature) → set is_active = FALSE
```

Do NOT delete them — the existing `order_items` rows reference them and
those orders must stay reconcilable. Deactivation just hides them from
the storefront. Run preflight again; the "Active products NOT in the
launch set" warning should clear.

### Final preflight

```bash
npm run catalog:preflight
```

Expected output: `9/9 launch slugs ready. Catalog is launch-ready.` Exit
code 0. If anything is yellow, the script names the field — go fix it.

### Visual smoke check (no code change required)

After 9/9 OK:

1. `https://loveli-luxury.vercel.app/` — homepage grid shows all 9 cards
   with their images and names.
2. `https://loveli-luxury.vercel.app/p/ocean-desire` — PDP renders:
   name, price (KES 2,800), description, fragrance detail block (notes
   pyramid, longevity, projection), and the Add-to-cart variant picker
   reads "50ml — KES 2,800".
3. Repeat for one or two other slugs as a spot-check.
4. `https://loveli-luxury.vercel.app/shop` — list view shows all 9.

If any PDP renders blank in the fragrance detail block, that product
is missing its `product_fragrance_meta` row — preflight will catch this.

## Things to NOT do

- **Don't change pv_per_bottle after the first paid order on that
  variant.** Every existing commission_ledger row was computed from the
  PV at the time of the order. Changing PV doesn't recompute history. If
  you really need to change PV: deactivate the existing variant, create
  a fresh one with the new PV, leave the old one as audit.
- **Don't delete a product or variant that has any order_items.** The FK
  prevents it (you'll get a constraint error). Deactivate instead.
- **Don't set inventory_qty to a negative number.** The CHECK constraint
  (`inventory_qty >= 0`) blocks it, but it's worth knowing why: the
  `mark_order_paid` RPC decrements inventory atomically. If a payment
  arrives for a quantity that would overshoot, the whole transaction
  rolls back and the order stays `pending` — which means the customer
  paid but didn't get charged on our side. Stay positive.

## Cross-references

- `scripts/catalog-preflight.mjs` — the audit you run between batches.
- `src/lib/catalog/fragrance-meta.ts` — marketing copy seed.
- `docs/photography-render-brief-2026-05.md` + `docs/photography-prompts-2026-05-30.md` —
  what the images should look like and how to generate them.
- `docs/go-live-mpesa.md` — the M-Pesa Go-Live runbook; the catalog must
  be seeded *before* you fire the smoke test in §6 there.
- `supabase/migrations/029_comp_plan_client_2026_05.sql` — the source of
  truth on PV and pricing.
