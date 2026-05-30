import { describe, it, expect } from 'vitest'
import { renderReceiptHtml, type ReceiptData } from '@/lib/email/receipt'

const base: ReceiptData = {
  orderNumber: 'LL-2026-000011',
  customerName: 'Ada',
  totalMinor: 210000n,
  items: [{ name: 'Rose Noir 50ml', quantity: 1, lineTotalMinor: 200000n }],
}

describe('renderReceiptHtml', () => {
  it('includes the order number, item, customer name, and track link', () => {
    const html = renderReceiptHtml(base, 'https://loveli-luxury.vercel.app')
    expect(html).toContain('LL-2026-000011')
    expect(html).toContain('Rose Noir 50ml')
    expect(html).toContain('Ada')
    expect(html).toContain('/track/LL-2026-000011')
  })

  it('escapes HTML in customer-controlled fields (no injection)', () => {
    const html = renderReceiptHtml({ ...base, customerName: '<script>x</script>' }, 'https://x')
    expect(html).not.toContain('<script>x</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('handles a missing customer name', () => {
    const html = renderReceiptHtml({ ...base, customerName: null }, 'https://x')
    expect(html).toContain('Hi,')
  })
})
