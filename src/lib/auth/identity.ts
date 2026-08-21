export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,39}$/
export const E164_PHONE_PATTERN = /^\+[1-9][0-9]{7,14}$/

export function normalizeUsername(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizeEmail(value: string): string {
  return value.trim().toLowerCase()
}

export function normalizePhone(value: string): string {
  return value.trim().replace(/[^0-9+]/g, '')
}

export function validateIdentityFields({
  username,
  email,
  phone,
}: {
  username: string
  email: string
  phone: string
}): string | null {
  if (!USERNAME_PATTERN.test(username)) {
    return 'Username must be 3 to 40 characters and use lowercase letters, numbers, dots, underscores, or hyphens.'
  }
  if (!email || !email.includes('@')) {
    return 'A valid email address is required.'
  }
  if (!E164_PHONE_PATTERN.test(phone)) {
    return 'Enter a valid phone number in international format, for example +254712345678.'
  }
  return null
}
