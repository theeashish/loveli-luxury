# Loveli Luxury — Product Image Render Brief

For: the owner. Written: 2026-05-27.
Goal: replace the current homepage product images with clean, on-brand renders so
the site can go to a large, photography-led layout (the mondedesparfum.com look).

## Why we are redoing these

The nine images in `public/products/` work against the premium, restrained look
the rest of the site is moving toward:

- **Marketing slogans are baked into the pixels** ("THE ESSENCE OF A LUXURY
  ESCAPE", "Experience the essence of craftsmanship"). "Craftsmanship" is a word we
  removed from the whole site in the May copy purge — but it is still inside these
  images. "INTRODUCING: VANILLA SMOKE" and similar advert text appears too.
- A **URL is burned in** on at least one (`www.loveliluxuryscents.com`), which is
  not the address the site is deployed at.
- Every image has a **✦ watermark** in a corner.
- Backgrounds are **busy** (whiskey decanters, loose diamonds, coral, pearls) and
  the mood is **inconsistent** — some dark, some bright. The brand brief asks for
  restraint (Aesop / Byredo, not a gold-and-diamonds catalogue).

None of that can be edited out of a finished image. It has to be regenerated.

> **Brand-name note.** The canonical name is **"Loveli Luxury Scents"** with the
> tagline **"Where Love Meets Luxury"** (confirmed 2026-05-27). So the name on the
> current labels is actually right — the problems are the slogans, watermark, and
> busy backgrounds, not the name. The render approach below still keeps the bottle
> **text-free** (monogram only): AI tools garble text, and a clean monogram bottle
> reads as more premium than a label full of small print.

## The one rule that fixes the biggest problem

**Generate the bottle with NO legible text on it.** AI image tools garble text and
that is exactly how the old name and slogans got baked in. Keep only the **gold
heart "L" monogram** on the label; drop every line of text ("Eau de parfum",
"30ml", the name, the tagline, the domain). A bottle that carries just the
monogram reads as *more* premium, not less, and it can never go stale. Put the
fragrance name in the website text next to the photo, where we can edit it freely.

Also: **no watermark, no logo lockup, no slogan, no border text.**

## The look (brand DNA for every shot)

One bottle. Clean. Calm. Lots of empty space. Think a quiet still-life in good
daylight, not a luxury advert.

- **One bottle per shot**, centered or slightly off-center, with room above and
  below it (we crop to a tall 3:4 frame).
- **Seamless backdrop** in a soft neutral — cream, oat, warm off-white, pale
  stone. A *subtle* tonal wash tied to the scent is fine (see each shot below).
  Never a literal scene.
- **Soft directional daylight** from one side, **one long soft shadow**. No harsh
  studio glare, no spotlight, no glow halo.
- **At most one restrained natural element** (a single stem, a few petals, a piece
  of pale driftwood) — or nothing. If in doubt, leave it out.
- **Muted, warm color.** No gold drench, no sparkle, no glitter, no diamonds.
- The bottle: clear rectangular glass flacon, faceted clear cap, slim metal
  atomizer collar, black oval label with the gold heart-"L" monogram only.

## Hard specs

- **Aspect ratio: 3:4 vertical** (e.g. 1200 × 1600 px). This is what the grid and
  hero expect. If your tool gives a different ratio, crop to 3:4 with the bottle
  centered.
- **Format / size:** export JPG, long edge ~1600 px, then compress to roughly
  150–250 KB each (the current ones are ~70–170 KB — keep it in that range so the
  Kenyan-4G performance budget holds).
- **File names — keep these exact names** so no code changes are needed. Drop the
  new files straight into `public/products/`, replacing the old ones:
  `ocean-desire.jpg`, `coastal-sage.jpg`, `crimson-noir.jpg`, `black-torque.jpg`,
  `afar.jpg`, `vanilla-smoke.jpg`, `sunset-bliss.jpg`, `pink-allure.jpg`,
  `orange-aura.jpg`.
- The three `WhatsApp Image …jpeg` files are not used by the site — you can ignore
  or delete them.

## Reusable base prompt

Paste this, then swap in the per-scent line from the next section. Works in
Midjourney, DALL·E, Firefly, Ideogram, etc.

> Editorial product photograph of a single clear rectangular glass perfume bottle
> with a faceted clear cap and a slim metal atomizer collar, a small black oval
> label bearing only a gold heart-shaped "L" monogram (NO other text). Centered
> with generous empty space above and below. **{SCENT BACKDROP LINE}** Soft
> directional daylight from the left, one long soft shadow, calm and minimal, warm
> muted color, shallow depth of field, medium-format still-life, photoreal.
> Vertical 3:4. No text, no words, no logo, no watermark, no sparkle, no diamonds,
> no busy props.

(If your tool supports negative prompts, add: `text, words, letters, logo,
watermark, sparkles, glitter, diamonds, cluttered background, harsh glare`.)

## Per-fragrance backdrop lines

Keep these restrained — the styling cue is a *whisper*, not a scene.

| File | `{SCENT BACKDROP LINE}` |
|---|---|
| `ocean-desire.jpg` | Pale sea-glass blue seamless backdrop, a faint cool tonal wash, optionally one small smooth pebble. |
| `coastal-sage.jpg` | Soft sage-grey backdrop, a single dried sage sprig lying flat to one side. |
| `crimson-noir.jpg` | Warm deep-taupe backdrop (still light, not black), a faint amber tonal wash. |
| `black-torque.jpg` | Cool slate-stone backdrop, polished surface, no props. |
| `afar.jpg` | Warm sand-beige backdrop, a faint saffron-gold wash, optionally one dried rosebud. |
| `vanilla-smoke.jpg` | Soft warm ivory backdrop, one vanilla pod lying flat, gentle warmth. |
| `sunset-bliss.jpg` | Blush-cream backdrop, golden-hour side light, a few loose rose petals. |
| `pink-allure.jpg` | Pale powder-pink backdrop, one peony bud, very soft and clean. |
| `orange-aura.jpg` | Warm pale-apricot backdrop, a faint citrus tonal wash, no props. |

## Hero shot (optional but ideal)

The homepage hero can use one of the above (it currently rotates five). If you want
a dedicated hero, generate one extra in the same style but **wider headroom** and
**more empty space on the left** (the headline sits over the left half on desktop).
Name it `hero.jpg`, 3:4, same rules. Tell me when it is in and I will wire the hero
to use it.

## Before you hand them back — 30-second checklist

For each image, confirm:

- [ ] **No readable text anywhere** (label, background, corners). Monogram only.
- [ ] **No watermark / ✦ / domain / slogan.**
- [ ] Background is soft and neutral, **not** a busy scene; no diamonds/gold drench.
- [ ] One bottle, calm daylight, one soft shadow.
- [ ] Cropped to **3:4 vertical**, bottle centered with breathing room.
- [ ] Saved with the **exact file name** above, ~150–250 KB JPG.

## What changes on the site once these land

With clean renders I can move the homepage from the current dark-overlay cards
(text sitting on a darkened photo, which we use today only to hide the old burned-in
text) to the reference's **image-above-text** cards: photo on cream, the fragrance
name and family in our serif below it. That, plus the wider spacing in this
session's layout pass, is what gets us to the mondedesparfum.com feel.
