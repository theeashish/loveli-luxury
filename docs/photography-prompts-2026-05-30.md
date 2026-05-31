# Loveli Luxury — Ready-to-paste AI image prompts

Generated 2026-05-30. Companion to `docs/photography-render-brief-2026-05.md`
(the brand brief that informed these prompts).

**How to use:** pick a tool (Midjourney, ChatGPT image, Imagen, Firefly, Ideogram,
Flux), paste the prompt for the fragrance you're rendering, and you get one image
in the right style. Each prompt is the brand brief's base prompt + the
per-scent backdrop line, pre-assembled. **Negative prompt** lines work where the
tool supports them (Stable Diffusion, Flux, ComfyUI, some Midjourney `--no`
syntax — adjust to your tool).

After generation, run `scripts/optimize-product-images.mjs` to crop to 3:4 and
compress to the perf budget (see "Optimization pipeline" at the bottom).
`scripts/verify-product-images.mjs` then checks every image against the brand
rules (size, format, dimensions, presence of legible text via OCR if available).

---

## The 9 production fragrances

For each: target file = `public/products/{slug}.jpg`, 3:4 vertical
(1200×1600 px target), 150–250 KB JPG. The optimizer enforces all of this.

---

### `ocean-desire.jpg` — Ocean Desire

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Pale sea-glass
> blue seamless backdrop, a faint cool tonal wash, optionally one small smooth
> pebble.** Soft directional daylight from the left, one long soft shadow,
> calm and minimal, warm muted color, shallow depth of field, medium-format
> still-life, photoreal. Vertical 3:4. No text, no words, no logo, no
> watermark, no sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, gold drench, multiple bottles.

---

### `coastal-sage.jpg` — Coastal Sage

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Soft sage-grey
> backdrop, a single dried sage sprig lying flat to one side.** Soft
> directional daylight from the left, one long soft shadow, calm and minimal,
> warm muted color, shallow depth of field, medium-format still-life,
> photoreal. Vertical 3:4. No text, no words, no logo, no watermark, no
> sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, gold drench, multiple bottles.

---

### `crimson-noir.jpg` — Crimson Noir

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Warm deep-taupe
> backdrop (still light, not black), a faint amber tonal wash.** Soft
> directional daylight from the left, one long soft shadow, calm and minimal,
> warm muted color, shallow depth of field, medium-format still-life,
> photoreal. Vertical 3:4. No text, no words, no logo, no watermark, no
> sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, gold drench, multiple bottles,
black/dark background.

---

### `black-torque.jpg` — Black Torque

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Cool
> slate-stone backdrop, polished surface, no props.** Soft directional
> daylight from the left, one long soft shadow, calm and minimal, warm muted
> color, shallow depth of field, medium-format still-life, photoreal.
> Vertical 3:4. No text, no words, no logo, no watermark, no sparkle, no
> diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, gold drench, multiple bottles.

---

### `afar.jpg` — Afar

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Warm
> sand-beige backdrop, a faint saffron-gold wash, optionally one dried
> rosebud.** Soft directional daylight from the left, one long soft shadow,
> calm and minimal, warm muted color, shallow depth of field, medium-format
> still-life, photoreal. Vertical 3:4. No text, no words, no logo, no
> watermark, no sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, multiple bottles.

---

### `vanilla-smoke.jpg` — Vanilla Smoke

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Soft warm
> ivory backdrop, one vanilla pod lying flat, gentle warmth.** Soft
> directional daylight from the left, one long soft shadow, calm and minimal,
> warm muted color, shallow depth of field, medium-format still-life,
> photoreal. Vertical 3:4. No text, no words, no logo, no watermark, no
> sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, gold drench, multiple bottles,
actual smoke.

---

### `sunset-bliss.jpg` — Sunset Bliss

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Blush-cream
> backdrop, golden-hour side light, a few loose rose petals.** Soft
> directional daylight from the left, one long soft shadow, calm and minimal,
> warm muted color, shallow depth of field, medium-format still-life,
> photoreal. Vertical 3:4. No text, no words, no logo, no watermark, no
> sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, gold drench, multiple bottles,
actual sunset/sky.

---

### `pink-allure.jpg` — Pink Allure

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Pale
> powder-pink backdrop, one peony bud, very soft and clean.** Soft
> directional daylight from the left, one long soft shadow, calm and minimal,
> warm muted color, shallow depth of field, medium-format still-life,
> photoreal. Vertical 3:4. No text, no words, no logo, no watermark, no
> sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, gold drench, multiple bottles,
hot/saturated pink.

---

### `orange-aura.jpg` — Orange Aura

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Centered with generous empty space above and below. **Warm
> pale-apricot backdrop, a faint citrus tonal wash, no props.** Soft
> directional daylight from the left, one long soft shadow, calm and minimal,
> warm muted color, shallow depth of field, medium-format still-life,
> photoreal. Vertical 3:4. No text, no words, no logo, no watermark, no
> sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, multiple bottles, actual
oranges/fruit.

---

## Optional: hero shot (`hero.jpg`)

If you want a dedicated hero (instead of using one of the nine), use any of
the above with **wider headroom and more empty space on the LEFT** (desktop
headline sits over the left half). Same rules otherwise.

> Editorial product photograph of a single clear rectangular glass perfume
> bottle with a faceted clear cap and a slim metal atomizer collar, a small
> black oval label bearing only a gold heart-shaped "L" monogram (NO other
> text). Bottle positioned on the RIGHT third with generous empty space on
> the LEFT for headline text. **Soft warm ivory backdrop, no props.** Soft
> directional daylight from the upper right, one long soft shadow falling
> left, calm and minimal, warm muted color, shallow depth of field,
> medium-format still-life, photoreal. Vertical 3:4. No text, no words, no
> logo, no watermark, no sparkle, no diamonds, no busy props.

**Negative:** text, words, letters, logo, watermark, sparkles, glitter,
diamonds, cluttered background, harsh glare, multiple bottles, centered
composition.

---

## Optimization pipeline

Once you have raw AI outputs:

1. **Drop into `public/_inbox/`** with their `{slug}.{ext}` name (any common
   format — png/jpg/webp).
2. **Run `node scripts/optimize-product-images.mjs`** — this:
   - Auto-crops to 3:4 (centered)
   - Resizes longest edge to 1600 px
   - Re-encodes as JPG with quality tuned for 150–250 KB
   - Writes the result to `public/products/{slug}.jpg`
   - Reports each file's final size and dimensions
3. **Run `node scripts/verify-product-images.mjs`** — this:
   - Confirms every expected slug has a file
   - Confirms the file is JPG, 3:4 ratio (within tolerance), under 300 KB
   - Flags suspicious files (way over budget, wrong dimensions, etc.)
4. **Commit, deploy, run Lighthouse** — the perf budget is `LCP < 2.5s` on a
   simulated Kenyan 4G mobile profile.

Both scripts are pure-Node (use the `sharp` dep that already ships); no extra
install. Run from the `loveli-luxury/` directory.

## Quick QA checklist (30 seconds per image)

Before you trust an image, verify:

- [ ] **No legible text anywhere** — label is monogram only, no slogans, no
      watermarks, no URLs, no AI-tool signatures in corners.
- [ ] **Background is calm and neutral** — no diamonds, no gold drench, no
      whiskey decanters, no busy scene props.
- [ ] **One bottle**, calm daylight, one soft shadow.
- [ ] Approximately 3:4 vertical, bottle has breathing room above and below.
- [ ] Saved at the **exact slug name** (the verifier will yell if not).

The verifier script catches several of these mechanically; for the
text-presence check, the verifier looks for high-contrast regions in the
bottle area that often correlate with burned-in text. It's a hint, not a
guarantee — the human eye is the final gate.
