/**
 * Shared retail-size pricing helpers.
 *
 * Loveli's 100ml retail price is derived from the same product's 50ml retail
 * price. Distributor pricing is intentionally not derived here.
 */
export function doubleRetailMinor(value: string | number | bigint): string {
  return (BigInt(String(value)) * 2n).toString()
}