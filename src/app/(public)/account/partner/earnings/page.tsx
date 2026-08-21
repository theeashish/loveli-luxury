import { createServiceClient } from "@/lib/supabase/service";
import { getSession, isInternalViewer } from "@/lib/auth/roles";
import { formatBasisPoints, formatKes } from "@/lib/money";
import { ALL_PARTNER_TIERS } from "@/lib/partners/tiers";

export const metadata = {
  title: "Earnings & pricing",
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

type LivePricingRow = {
  id: number;
  productName: string;
  sizeMl: number;
  purchaseMinor: bigint;
  retailMinor: bigint;
  marginMinor: bigint;
  pvPerBottle: number;
  internalPvPerBottle: number | null;
};

type InternalAllocationRow = {
  id: number;
  sourceOrderId: number;
  sourceOrderItemId: number;
  variantId: number | null;
  quantity: number;
  internalPv: number;
  allocatedAt: string;
};

type LiveCommissionRate = {
  level: number;
  rateBasisPoints: number;
};

async function getLiveEarningsData(): Promise<{
  pricing: LivePricingRow[];
  rates: LiveCommissionRate[];
  internalAllocations: InternalAllocationRow[];
  canViewInternal: boolean;
}> {
  const session = await getSession();
  const canViewInternal = session !== null && isInternalViewer(session);
  const service = createServiceClient();
  const now = new Date().toISOString();

  const [productsRes, variantsRes, ratesRes, internalAllocationsRes] =
    await Promise.all([
      service
        .from("products")
        .select("id, name")
        .eq("is_active", true)
        .order("name", { ascending: true }),
      service
        .from("product_variants")
        .select(
          "id, product_id, size_ml, distributor_price_minor, retail_price_minor, pv_per_bottle, internal_pv_per_bottle",
        )
        .eq("is_active", true)
        .order("size_ml", { ascending: true }),
      service
        .from("config_commission_rates")
        .select("level, rate_basis_points, effective_from, effective_until")
        .lte("effective_from", now)
        .order("effective_from", { ascending: false })
        .order("level", { ascending: true }),
      canViewInternal
        ? service
            .from("internal_pv_allocations")
            .select(
              "id, source_order_id, source_order_item_id, variant_id, quantity, internal_pv, allocated_at",
            )
            .order("allocated_at", { ascending: false })
            .limit(100)
        : Promise.resolve({ data: [], error: null }),
    ]);

  if (productsRes.error) throw productsRes.error;
  if (variantsRes.error) throw variantsRes.error;
  if (ratesRes.error) throw ratesRes.error;
  if (internalAllocationsRes.error) throw internalAllocationsRes.error;

  const productById = new Map(
    (productsRes.data ?? []).map((product) => [product.id, product.name]),
  );
  const pricing = (variantsRes.data ?? []).map((variant) => {
    const purchaseMinor = BigInt(variant.distributor_price_minor);
    const retailMinor = BigInt(variant.retail_price_minor);

    return {
      id: variant.id,
      productName:
        productById.get(variant.product_id) ?? `Product ${variant.product_id}`,
      sizeMl: variant.size_ml,
      purchaseMinor,
      retailMinor,
      marginMinor: retailMinor - purchaseMinor,
      pvPerBottle: variant.pv_per_bottle,
      internalPvPerBottle: canViewInternal
        ? variant.internal_pv_per_bottle
        : null,
    };
  });

  const latestRateByLevel = new Map<
    number,
    { level: number; rateBasisPoints: number; effectiveFrom: string }
  >();
  for (const rate of ratesRes.data ?? []) {
    if (rate.effective_until !== null && rate.effective_until <= now) continue;

    const current = latestRateByLevel.get(rate.level);
    if (!current || rate.effective_from > current.effectiveFrom) {
      latestRateByLevel.set(rate.level, {
        level: rate.level,
        rateBasisPoints: rate.rate_basis_points,
        effectiveFrom: rate.effective_from,
      });
    }
  }

  const rates = Array.from(latestRateByLevel.values())
    .sort((a, b) => a.level - b.level)
    .map(({ level, rateBasisPoints }) => ({ level, rateBasisPoints }));

  const internalAllocations = canViewInternal
    ? (internalAllocationsRes.data ?? []).map((row) => ({
        id: row.id,
        sourceOrderId: row.source_order_id,
        sourceOrderItemId: row.source_order_item_id,
        variantId: row.variant_id,
        quantity: row.quantity,
        internalPv: row.internal_pv,
        allocatedAt: row.allocated_at,
      }))
    : [];

  return { pricing, rates, internalAllocations, canViewInternal };
}

export default async function PartnerEarningsPage() {
  const { pricing, rates, internalAllocations, canViewInternal } =
    await getLiveEarningsData();

  return (
    <div className="space-y-12">
      <div className="rounded-md border border-[hsl(var(--primary))]/30 bg-[hsl(var(--primary))]/5 px-4 py-3 text-xs text-[hsl(var(--muted-foreground))]">
        These figures are confidential to Loveli Luxury partners. Please keep
        them within the partner community.
      </div>

      <section>
        <h2 className="font-serif text-2xl">
          Product pricing &amp; your retail margin
        </h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Prices, PV, and margins below are read from the current active
          catalog. They update when the catalog is changed.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {pricing.length === 0 ? (
            <p className="text-sm text-[hsl(var(--muted-foreground))]">
              No active product variants are configured yet.
            </p>
          ) : (
            pricing.map((product) => (
              <div
                key={product.id}
                className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-6"
              >
                <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                  {product.productName}
                </p>
                <p className="mt-2 font-serif text-4xl">
                  {product.sizeMl}
                  <span className="text-lg text-[hsl(var(--muted-foreground))]">
                    ml
                  </span>
                </p>
                <dl className="mt-5 space-y-2 text-sm">
                  <div className="flex justify-between border-b border-[hsl(var(--border))]/60 pb-2">
                    <dt className="text-[hsl(var(--muted-foreground))]">
                      Your purchase price
                    </dt>
                    <dd className="font-medium">
                      {formatKes(product.purchaseMinor)}
                    </dd>
                  </div>
                  <div className="flex justify-between border-b border-[hsl(var(--border))]/60 pb-2">
                    <dt className="text-[hsl(var(--muted-foreground))]">
                      Mandatory retail price
                    </dt>
                    <dd className="font-medium text-[hsl(var(--brand-gold))]">
                      {formatKes(product.retailMinor)}
                    </dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-[hsl(var(--muted-foreground))]">
                      Participant PV per bottle
                    </dt>
                    <dd className="font-medium">{product.pvPerBottle}</dd>
                  </div>
                  {product.internalPvPerBottle !== null ? (
                    <div className="flex justify-between border-t border-[hsl(var(--border))]/60 pt-2">
                      <dt className="text-[hsl(var(--muted-foreground))]">
                        Internal marketing &amp; management PV
                      </dt>
                      <dd className="font-medium">
                        {product.internalPvPerBottle}
                      </dd>
                    </div>
                  ) : null}
                </dl>
                <div className="mt-4 flex items-center justify-between rounded-md border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/10 px-4 py-3">
                  <span className="text-[10px] uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
                    Your margin per bottle
                  </span>
                  <span className="font-serif text-2xl text-[hsl(var(--brand-gold))]">
                    {formatKes(product.marginMinor)}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Retail margin at a glance</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Examples use the current margin for each active catalog variant.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-5 md:grid-cols-2">
          {pricing.map((product) => (
            <MarginTable key={product.id} product={product} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="font-serif text-2xl">Commission by level</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Commission rates are read from the active database configuration and
          applied to PV by the compensation engine.
        </p>
        <div className="mt-6 overflow-hidden rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40">
          {rates.length === 0 ? (
            <p className="px-5 py-4 text-sm text-[hsl(var(--muted-foreground))]">
              No active commission rates are configured yet.
            </p>
          ) : (
            <ul className="divide-y divide-[hsl(var(--border))]/60 text-sm">
              {rates.map((rate) => (
                <li
                  key={rate.level}
                  className="flex items-center justify-between px-5 py-3"
                >
                  <span className="text-[hsl(var(--muted-foreground))]">
                    Level {rate.level}
                  </span>
                  <span className="font-medium text-[hsl(var(--brand-gold))]">
                    {formatBasisPoints(rate.rateBasisPoints)} of PV
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {canViewInternal ? (
        <InternalAllocationSection
          pricing={pricing}
          allocations={internalAllocations}
        />
      ) : null}

      <section>
        <h2 className="font-serif text-2xl">What each rank means</h2>
        <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
          Your rank is based on the plan requirements for personal bottles,
          Active Directs, group volume and qualifying months.
        </p>
        <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
          {ALL_PARTNER_TIERS.map((tier) => (
            <div
              key={tier.code}
              className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-5"
            >
              <div className="flex items-baseline justify-between">
                <p className="font-serif text-lg">{tier.displayName}</p>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                  Rank {tier.position} of 5
                </p>
              </div>
              <p className="mt-2 text-sm text-[hsl(var(--muted-foreground))]">
                {tier.tagline}
              </p>
              <ul className="mt-3 space-y-1 text-xs text-[hsl(var(--foreground))]/90">
                <li>Commission: {tier.commissionLabel}</li>
                <li>Bonus: {tier.bonusLabel}</li>
              </ul>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function InternalAllocationSection({
  pricing,
  allocations,
}: {
  pricing: LivePricingRow[];
  allocations: InternalAllocationRow[];
}) {
  const totalInternalPv = allocations.reduce(
    (sum, row) => sum + row.internalPv,
    0,
  );
  const pricingById = new Map(pricing.map((product) => [product.id, product]));

  return (
    <section className="rounded-lg border border-[hsl(var(--primary))]/40 bg-[hsl(var(--primary))]/5 p-6">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[hsl(var(--primary))]">
        Restricted internal view
      </p>
      <h2 className="mt-2 font-serif text-2xl">
        Marketing &amp; management allocation
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
        This section is visible only to the founder admin and Ruth Karimi. It
        shows the separate internal PV allocation recorded after an order is
        paid. It is not participant commission and is excluded from the
        participant commission ledger.
      </p>

      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
            Recorded internal PV
          </p>
          <p className="mt-2 font-serif text-3xl">{totalInternalPv}</p>
        </div>
        <div className="rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-4">
          <p className="text-xs uppercase tracking-[0.15em] text-[hsl(var(--muted-foreground))]">
            Ledger status
          </p>
          <p className="mt-2 text-sm font-medium">
            Paid orders only; historical rows are unchanged
          </p>
        </div>
      </div>

      <div className="mt-5 overflow-x-auto rounded-md border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
        {allocations.length === 0 ? (
          <p className="px-4 py-4 text-sm text-[hsl(var(--muted-foreground))]">
            No paid-order internal allocations have been recorded yet.
          </p>
        ) : (
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-[hsl(var(--border))] text-xs uppercase tracking-[0.12em] text-[hsl(var(--muted-foreground))]">
              <tr>
                <th className="px-4 py-3">Order</th>
                <th className="px-4 py-3">Variant</th>
                <th className="px-4 py-3">Quantity</th>
                <th className="px-4 py-3">Internal PV</th>
                <th className="px-4 py-3">Allocated</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[hsl(var(--border))]/60">
              {allocations.map((row) => {
                const variant =
                  row.variantId === null
                    ? null
                    : pricingById.get(row.variantId);
                return (
                  <tr key={row.id}>
                    <td className="px-4 py-3">#{row.sourceOrderId}</td>
                    <td className="px-4 py-3">
                      {variant
                        ? `${variant.productName} ${variant.sizeMl}ml`
                        : "Order allocation"}
                    </td>
                    <td className="px-4 py-3">{row.quantity}</td>
                    <td className="px-4 py-3 font-medium">{row.internalPv}</td>
                    <td className="px-4 py-3 text-[hsl(var(--muted-foreground))]">
                      {new Date(row.allocatedAt).toLocaleString("en-KE")}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}

function MarginTable({ product }: { product: LivePricingRow }) {
  const rows = [1, 5, 10, 20, 50, 100].map((qty) => ({
    qty,
    totalMinor: product.marginMinor * BigInt(qty),
  }));

  return (
    <div className="rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 p-6">
      <h3 className="border-b border-[hsl(var(--border))] pb-3 font-serif text-lg">
        {product.productName} {product.sizeMl}ml: retail margin examples
      </h3>
      <ul className="mt-2 divide-y divide-[hsl(var(--border))]/60 text-sm">
        {rows.map((row) => (
          <li key={row.qty} className="flex items-center justify-between py-2">
            <span className="text-[hsl(var(--muted-foreground))]">
              Sell {row.qty} bottles
            </span>
            <span className="font-medium text-[hsl(var(--brand-gold))]">
              {formatKes(row.totalMinor)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
