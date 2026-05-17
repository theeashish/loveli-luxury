/**
 * `next` parameter sanitiser. Used by /login, /signup, /post-login.
 *
 * Allows only in-app paths starting with a single '/'. Rejects '//foo'
 * (which would open-redirect to //foo). Returns '' when the input is
 * unsafe or missing — callers fall back to their own default.
 */

export function safeNext(raw: string | undefined | null): string {
  if (typeof raw !== 'string' || raw.length === 0) return ''
  if (!raw.startsWith('/') || raw.startsWith('//')) return ''
  return raw
}
