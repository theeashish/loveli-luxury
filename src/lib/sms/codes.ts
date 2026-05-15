/**
 * One-time numeric code helpers for MSISDN verification.
 *
 * Codes are 6 digits, generated from crypto.randomInt for unbiased
 * distribution. We never store the plaintext: only a SHA-256 of
 * `code + msisdn + APP_SECRET`. The APP_SECRET is the existing
 * REVALIDATE_SECRET (already required to be 32+ chars). This binds the
 * hash to a single deployment so codes leaked from one environment are
 * useless in another.
 */

import 'server-only'

import { createHash, randomInt } from 'node:crypto'
import { getServerEnv } from '../env'

const CODE_LENGTH = 6
const CODE_MIN = 0
const CODE_MAX = 1_000_000 // exclusive

export function generateCode(): string {
  const n = randomInt(CODE_MIN, CODE_MAX)
  return n.toString(10).padStart(CODE_LENGTH, '0')
}

export function hashCode(code: string, msisdn: string): string {
  const env = getServerEnv()
  return createHash('sha256')
    .update(`${code}:${msisdn}:${env.REVALIDATE_SECRET}`)
    .digest('hex')
}

/** Constant-time comparison of two hex hashes. */
export function compareCodeHash(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  }
  return diff === 0
}

export const CODE_TTL_MINUTES = 15
export const MAX_VERIFICATION_ATTEMPTS = 5
