import { test, expect } from '@playwright/test'

test('homepage inline Next.js bootstrap scripts carry the CSP nonce', async ({ request }) => {
  const response = await request.get('/')
  const csp = response.headers()['content-security-policy'] ?? ''
  const nonce = csp.match(/'nonce-([^']+)'/)?.[1]
  expect(nonce).toBeTruthy()
  const html = await response.text()
  const scripts = [...html.matchAll(/<script[^>]*>.*?__next_f.*?<\/script>/gs)].map(([script]) => script)
  const nonces = scripts.map((script) => script.match(/nonce="([^"]*)"/)?.[1] ?? null)
  expect(scripts.length).toBeGreaterThan(0)
  expect(nonces.every((value) => value === nonce)).toBe(true)
})
