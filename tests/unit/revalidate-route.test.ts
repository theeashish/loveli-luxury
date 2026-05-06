import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { validateRevalidatePath } from '../../src/lib/catalog/revalidate-paths'

const SECRET = 'a'.repeat(48)

const revalidatePath = vi.fn<(path: string) => void>()

vi.mock('next/cache', () => ({
  revalidatePath: (p: string) => revalidatePath(p),
}))

describe('validateRevalidatePath', () => {
  it.each(['/', '/shop', '/bundles'])('accepts static surface %s', (p) => {
    expect(validateRevalidatePath(p)).toEqual({ ok: true, path: p })
  })

  it.each(['/p/rose-noir', '/bundles/starter-30ml-x3', '/p/x'])(
    'accepts dynamic surface %s',
    (p) => {
      expect(validateRevalidatePath(p)).toEqual({ ok: true, path: p })
    },
  )

  it.each([
    'no-leading-slash',
    '/admin',
    '/admin/catalog',
    '/api/revalidate',
    '/p',
    '/p/',
    '/p/Bad-Slug',
    '/p/has space',
    '/p/has?query',
    '/p/has#frag',
    '/p/../etc',
    '/bundles/UPPER',
  ])('rejects %s', (p) => {
    const v = validateRevalidatePath(p)
    expect(v.ok).toBe(false)
  })

  it('rejects non-string input', () => {
    expect(validateRevalidatePath(undefined).ok).toBe(false)
    expect(validateRevalidatePath(123).ok).toBe(false)
    expect(validateRevalidatePath(null).ok).toBe(false)
  })
})

describe('POST /api/revalidate', () => {
  beforeEach(() => {
    revalidatePath.mockReset()
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000'
    process.env.NEXT_PUBLIC_APP_NAME = 'Loveli Luxury'
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co'
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key-stub-1234567890'
    process.env.NEXT_PUBLIC_FLUTTERWAVE_PUBLIC_KEY = 'FLWPUBK_TEST-stub'
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-role-key-stub-12345'
    process.env.FLUTTERWAVE_SECRET_KEY = 'FLWSECK_TEST-stub'
    process.env.FLUTTERWAVE_ENCRYPTION_KEY = 'FLWSECK_TEST-stub-enc'
    process.env.FLUTTERWAVE_WEBHOOK_SECRET_HASH = 'webhook-hash-stub-12345'
    process.env.REVALIDATE_SECRET = SECRET
    vi.resetModules()
  })

  afterEach(() => {
    delete process.env.REVALIDATE_SECRET
  })

  async function loadRoute() {
    return import('../../src/app/api/revalidate/route')
  }

  function makeRequest(init: {
    body?: unknown
    auth?: string | null
    method?: string
    rawBody?: string
  }) {
    const headers = new Headers({ 'content-type': 'application/json' })
    if (init.auth !== null && init.auth !== undefined) {
      headers.set('authorization', init.auth)
    }
    const body =
      init.rawBody !== undefined
        ? init.rawBody
        : init.body !== undefined
          ? JSON.stringify(init.body)
          : undefined
    return new Request('http://localhost/api/revalidate', {
      method: init.method ?? 'POST',
      headers,
      body,
    }) as unknown as Parameters<Awaited<ReturnType<typeof loadRoute>>['POST']>[0]
  }

  it('rejects missing Authorization header with 401', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ body: { paths: ['/shop'] }, auth: null }))
    expect(res.status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects malformed Authorization header with 401', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ body: { paths: ['/shop'] }, auth: SECRET }))
    expect(res.status).toBe(401)
  })

  it('rejects wrong bearer token with 401', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { paths: ['/shop'] }, auth: `Bearer ${'b'.repeat(48)}` }),
    )
    expect(res.status).toBe(401)
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('rejects bearer of different length without throwing (timing-safe guard)', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ body: { paths: ['/shop'] }, auth: 'Bearer short' }))
    expect(res.status).toBe(401)
  })

  it('rejects invalid JSON with 400', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ rawBody: '{not-json', auth: `Bearer ${SECRET}` }),
    )
    expect(res.status).toBe(400)
  })

  it('rejects body with no paths array', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ body: {}, auth: `Bearer ${SECRET}` }))
    expect(res.status).toBe(400)
  })

  it('rejects body with empty paths', async () => {
    const { POST } = await loadRoute()
    const res = await POST(makeRequest({ body: { paths: [] }, auth: `Bearer ${SECRET}` }))
    expect(res.status).toBe(400)
  })

  it('rejects when any path is outside the allow-list', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({
        body: { paths: ['/shop', '/admin/catalog'] },
        auth: `Bearer ${SECRET}`,
      }),
    )
    expect(res.status).toBe(400)
    const json = (await res.json()) as { rejected: Array<{ path: string }> }
    expect(json.rejected.map((r) => r.path)).toEqual(['/admin/catalog'])
    expect(revalidatePath).not.toHaveBeenCalled()
  })

  it('revalidates each accepted path on the happy path', async () => {
    const { POST } = await loadRoute()
    const paths = ['/', '/shop', '/p/rose-noir', '/bundles/starter-30ml-x3']
    const res = await POST(makeRequest({ body: { paths }, auth: `Bearer ${SECRET}` }))
    expect(res.status).toBe(200)
    const json = (await res.json()) as { revalidated: boolean; paths: string[] }
    expect(json.revalidated).toBe(true)
    expect(json.paths).toEqual(paths)
    expect(revalidatePath).toHaveBeenCalledTimes(paths.length)
    for (const p of paths) {
      expect(revalidatePath).toHaveBeenCalledWith(p)
    }
  })

  it('deduplicates nothing — same path twice triggers two revalidations', async () => {
    const { POST } = await loadRoute()
    const res = await POST(
      makeRequest({ body: { paths: ['/shop', '/shop'] }, auth: `Bearer ${SECRET}` }),
    )
    expect(res.status).toBe(200)
    expect(revalidatePath).toHaveBeenCalledTimes(2)
  })
})
