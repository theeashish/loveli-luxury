/**
 * Slug helpers for catalog URLs.
 *
 * Rules:
 *  - lowercase ASCII alphanumerics and single hyphens, no leading/trailing hyphen
 *  - 1..80 characters
 *  - deterministic for a given input — same string always produces the same slug
 */

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
// U+0300..U+036F covers combining diacritical marks left over after NFKD.
const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g')
const NON_ALNUM = /[^a-z0-9]+/g
const TRIM_HYPHENS = /^-+|-+$/g
const MAX_LEN = 80

export function isValidSlug(s: string): boolean {
  return typeof s === 'string' && s.length >= 1 && s.length <= MAX_LEN && SLUG_RE.test(s)
}

export function slugify(input: string): string {
  const trimmed = input
    .normalize('NFKD')
    .replace(COMBINING_MARKS, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(NON_ALNUM, '-')
    .replace(TRIM_HYPHENS, '')
  return trimmed.slice(0, MAX_LEN).replace(/-+$/, '')
}
