/**
 * Static marketing metadata for the founding nine Loveli Luxury fragrances.
 *
 * The DB is the source of truth for price, inventory, and active status.
 * This file is the source of truth for the *story* — image, tagline, scent
 * notes, mood — that drive the home-page experience. Joined by `slug`.
 *
 * Adding a fragrance: drop the photo at `public/products/{slug}.jpg`, add a
 * row here, optionally create the matching DB product via admin.
 */

export type FragranceMeta = {
  slug: string
  name: string
  /** Short poetic tagline shown under the name. */
  tagline: string
  /** One-line scent character ("smoky vanilla & cured tobacco"). */
  notes: string
  /** Mood / use case ("for late nights and quiet rebellion"). */
  mood: string
  /** Image at /public/products/{slug}.jpg */
  image: string
  /** Category for the "Find your scent" filter. */
  family: 'fresh' | 'floral' | 'woody' | 'oriental' | 'gourmand'
  /** Vibe word used in the quiz output. */
  vibe: 'bold' | 'soft' | 'fresh' | 'warm' | 'mysterious'
}

export const FRAGRANCES: readonly FragranceMeta[] = [
  {
    slug: 'ocean-desire',
    name: 'Ocean Desire',
    tagline: 'The essence of a luxury escape.',
    notes: 'Sea salt, bergamot, white amber.',
    mood: 'For mornings that taste of horizon.',
    image: '/products/ocean-desire.jpg',
    family: 'fresh',
    vibe: 'fresh',
  },
  {
    slug: 'coastal-sage',
    name: 'Coastal Sage',
    tagline: 'The essence of the coast.',
    notes: 'Mediterranean sage, driftwood, sea breeze.',
    mood: 'For long walks that end in salt-silver light.',
    image: '/products/coastal-sage.jpg',
    family: 'fresh',
    vibe: 'fresh',
  },
  {
    slug: 'crimson-noir',
    name: 'Crimson Noir',
    tagline: 'Dark, warm, unhurried.',
    notes: 'Smoked oud, leather, aged whiskey.',
    mood: 'For rooms warmed by candlelight and conversation.',
    image: '/products/crimson-noir.jpg',
    family: 'woody',
    vibe: 'mysterious',
  },
  {
    slug: 'black-torque',
    name: 'Black Torque',
    tagline: 'Experience true elegance.',
    notes: 'Black amber, polished leather, bronzed musk.',
    mood: 'For the cut of a tailored shoulder.',
    image: '/products/black-torque.jpg',
    family: 'woody',
    vibe: 'bold',
  },
  {
    slug: 'afar',
    name: 'Afar',
    tagline: 'The romance of far places.',
    notes: 'Saffron, frankincense, gilded rose.',
    mood: 'For the romance of distant rooms.',
    image: '/products/afar.jpg',
    family: 'oriental',
    vibe: 'warm',
  },
  {
    slug: 'vanilla-smoke',
    name: 'Vanilla Smoke',
    tagline: 'Soft fire, slow burn.',
    notes: 'Madagascan vanilla, cured tobacco, sandalwood.',
    mood: 'For nights that stretch into stories.',
    image: '/products/vanilla-smoke.jpg',
    family: 'gourmand',
    vibe: 'warm',
  },
  {
    slug: 'sunset-bliss',
    name: 'Sunset Bliss',
    tagline: 'Petals at golden hour.',
    notes: 'Damask rose, jasmine sambac, soft musk.',
    mood: 'For laughter on a balcony as the day softens.',
    image: '/products/sunset-bliss.jpg',
    family: 'floral',
    vibe: 'soft',
  },
  {
    slug: 'pink-allure',
    name: 'Pink Allure',
    tagline: 'A whisper, a promise.',
    notes: 'Peony, lychee, powdered iris.',
    mood: 'For the hush before being seen.',
    image: '/products/pink-allure.jpg',
    family: 'floral',
    vibe: 'soft',
  },
  {
    slug: 'orange-aura',
    name: 'Orange Aura',
    tagline: 'Sunlight, but woven.',
    notes: 'Blood orange, neroli, gilded vetiver.',
    mood: 'For doorways flung open and rooms pulled close.',
    image: '/products/orange-aura.jpg',
    family: 'oriental',
    vibe: 'bold',
  },
] as const

export function getFragrance(slug: string): FragranceMeta | undefined {
  return FRAGRANCES.find((f) => f.slug === slug)
}
