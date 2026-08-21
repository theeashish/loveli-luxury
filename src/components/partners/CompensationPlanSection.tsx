import { LOVELI_COMPENSATION } from "@/lib/partners/compensation-plan";

function kes(value: number): string {
  return `KES ${value.toLocaleString("en-KE")}`;
}

const prestigeClass = {
  standard: "border-[hsl(var(--border))] bg-[hsl(var(--background))]",
  gold: "border-amber-400/60 bg-amber-50/40",
  platinum: "border-slate-300/80 bg-slate-50/70",
  crown: "border-[hsl(var(--primary))] bg-[hsl(var(--primary))]/10",
} as const;

type LiveProductPv = {
  sizeMl: number;
  pv: number;
  internalPv: number;
};

export function CompensationPlanSection({
  liveProduct,
}: {
  liveProduct: LiveProductPv | null;
}) {
  const plan = LOVELI_COMPENSATION;
  const product = liveProduct ?? {
    sizeMl: plan.product.sizeMl,
    pv: 400,
    internalPv: 100,
  };

  return (
    <section className="border-t border-[hsl(var(--border))]/70 bg-[hsl(var(--muted))]/20">
      <div className="mx-auto max-w-7xl px-6 py-16 md:py-24">
        <div className="max-w-3xl">
          <p className="text-eyebrow">The Loveli compensation plan</p>
          <h2 className="mt-5 font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-6xl">
            The Loveli leadership journey
          </h2>
          <p className="mt-5 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
            Five ranks. Five levels of growth. One luxury legacy. Every rank
            reflects personal bottles, Active Directs, group volume and
            qualifying months.
          </p>
        </div>
        <ol className="mt-10 grid gap-3 md:grid-cols-5">
          {plan.ranks.map((rank) => (
            <li
              key={rank.position}
              className={`rounded-xl border p-5 ${prestigeClass[rank.prestige]}`}
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-[hsl(var(--primary))]">
                Rank {rank.position}
              </p>
              <h3 className="mt-3 font-serif text-2xl text-[hsl(var(--foreground))]">
                {rank.name}
              </h3>
              <p className="mt-3 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
                {rank.commissionLevels}
              </p>
            </li>
          ))}
        </ol>

        <div className="mt-16 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="rounded-2xl border border-[hsl(var(--primary))]/30 bg-[hsl(var(--background))] p-7 md:p-9">
            <p className="text-eyebrow">The {product.sizeMl}ml product</p>

            <h3 className="mt-4 font-serif text-3xl text-[hsl(var(--foreground))] md:text-4xl">
              The product at the centre of the plan
            </h3>
            <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              The plan uses a fragrance with a clear partner price, retail
              price, retail margin and PV allocation. Participant commissions
              use only the commissionable PV shown here.
            </p>

            <dl className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  Registration
                </dt>
                <dd className="mt-2 text-xl font-semibold">
                  {kes(plan.registrationFeeKes)}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  Product
                </dt>
                <dd className="mt-2 text-xl font-semibold">
                  {product.sizeMl}ml
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  Commissionable PV
                </dt>
                <dd className="mt-2 text-xl font-semibold">{product.pv} PV</dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-[0.18em] text-[hsl(var(--muted-foreground))]">
                  Internal allocation
                </dt>
                <dd className="mt-2 text-xl font-semibold">
                  {product.internalPv} PV
                </dd>
              </div>
            </dl>
            <div className="mt-8 grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-[hsl(var(--muted))]/50 p-4">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  IBO price
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {kes(plan.product.iboPriceKes)}
                </p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--muted))]/50 p-4">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Suggested retail
                </p>
                <p className="mt-1 text-2xl font-semibold">
                  {kes(plan.product.suggestedRetailKes)}
                </p>
              </div>
              <div className="rounded-xl bg-[hsl(var(--primary))]/10 p-4">
                <p className="text-xs text-[hsl(var(--muted-foreground))]">
                  Retail profit
                </p>
                <p className="mt-1 text-2xl font-semibold text-[hsl(var(--primary))]">
                  {kes(plan.product.retailProfitKes)}
                </p>
              </div>
            </div>
            <p className="mt-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              {plan.retailDisclaimer}
            </p>
            <p className="mt-3 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              For the current {product.sizeMl}ml configuration, {product.pv} PV
              is available for participant commissions and {product.internalPv}{" "}
              PV is allocated separately to marketing and management. The
              internal allocation is not hidden from partners, but it is not a
              participant commission.
            </p>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-7 md:p-9">
            <p className="text-eyebrow">The Loveli commission structure</p>
            <h3 className="mt-4 font-serif text-3xl text-[hsl(var(--foreground))]">
              Earn through multiple levels of growth
            </h3>
            <p className="mt-3 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              Commissions are calculated strictly from Point Value (PV), not
              from retail price, partner price, registration fees or company
              profit. The applicable levels are listed for each rank below.
            </p>
            <div className="mt-7 space-y-3">
              {plan.commissionLevels.map((level) => (
                <div
                  key={level.level}
                  className="flex items-center justify-between border-b border-[hsl(var(--border))]/70 pb-3"
                >
                  <span className="text-sm font-medium">
                    Level {level.level}
                  </span>
                  <span className="font-serif text-2xl text-[hsl(var(--primary))]">
                    {level.percentage}%
                  </span>
                </div>
              ))}
            </div>
            <p className="mt-6 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Actual earnings depend on product sales, customer demand, team
              performance and qualification requirements.
            </p>
          </div>
        </div>

        <div className="mt-16">
          <p className="text-eyebrow">Rank comparison</p>
          <h3 className="mt-4 font-serif text-3xl text-[hsl(var(--foreground))] md:text-4xl">
            Recognition for consistent leadership
          </h3>
          <div className="mt-8 overflow-x-auto rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))]">
            <table
              className="min-w-[900px] w-full text-left text-sm"
              aria-label="Loveli rank comparison"
            >
              <thead className="border-b border-[hsl(var(--border))] bg-[hsl(var(--muted))]/40 text-xs uppercase tracking-[0.14em] text-[hsl(var(--muted-foreground))]">
                <tr>
                  <th className="px-5 py-4">Rank</th>
                  <th className="px-5 py-4">Personal bottles</th>
                  <th className="px-5 py-4">Active directs</th>
                  <th className="px-5 py-4">Group target</th>
                  <th className="px-5 py-4">Commission levels</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[hsl(var(--border))]/70">
                {plan.ranks.map((rank) => (
                  <tr key={rank.position}>
                    <th className="px-5 py-4 font-serif text-lg font-normal">
                      {rank.name}
                    </th>
                    <td className="px-5 py-4">{rank.personalBottles}</td>
                    <td className="px-5 py-4">{rank.activeDirects}</td>
                    <td className="px-5 py-4">{kes(rank.groupTargetKes)}</td>
                    <td className="px-5 py-4">{rank.commissionLevels}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="mt-16 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
          {plan.ranks.map((rank) => (
            <article
              key={rank.position}
              className={`rounded-xl border p-5 ${prestigeClass[rank.prestige]}`}
            >
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[hsl(var(--primary))]">
                {rank.name}
              </p>
              <p className="mt-4 font-serif text-2xl">
                {kes(rank.rankBonusKes)}
              </p>
              <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                Rank bonus after {rank.rankBonusMonths} qualifying month
                {rank.rankBonusMonths === 1 ? "" : "s"}
              </p>
              {rank.lifestyleBonusKes ? (
                <>
                  <p className="mt-5 font-serif text-xl">
                    {kes(rank.lifestyleBonusKes)}
                  </p>
                  <p className="mt-1 text-xs text-[hsl(var(--muted-foreground))]">
                    Monthly Luxury Lifestyle Bonus
                  </p>
                </>
              ) : (
                <p className="mt-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
                  No monthly lifestyle bonus is specified for this rank.
                </p>
              )}
            </article>
          ))}
        </div>
        <p className="mt-6 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
          All rewards are subject to qualification requirements and company
          terms and conditions.
        </p>

        <div className="mt-16 grid gap-6 lg:grid-cols-2">
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-7 md:p-9">
            <p className="text-eyebrow">
              Maintenance and commission eligibility
            </p>
            <h3 className="mt-4 font-serif text-3xl text-[hsl(var(--foreground))]">
              Maintain. Qualify. Earn.
            </h3>
            <div className="mt-6 space-y-5 text-sm leading-7 text-[hsl(var(--muted-foreground))]">
              <p>
                <strong className="text-[hsl(var(--foreground))]">
                  Day 1 to Day 10:
                </strong>{" "}
                {plan.maintenance.earlyWindow}
              </p>
              <p>
                <strong className="text-[hsl(var(--foreground))]">
                  After Day 10:
                </strong>{" "}
                {plan.maintenance.afterWindow}
              </p>
            </div>
            <div className="mt-7 grid grid-cols-2 gap-3 text-center text-xs font-semibold uppercase tracking-[0.14em]">
              <div className="rounded-xl bg-[hsl(var(--primary))]/10 p-4">
                Day 1 to 10
                <br />
                <span className="mt-2 block text-[hsl(var(--primary))]">
                  Full month eligibility
                </span>
              </div>
              <div className="rounded-xl bg-[hsl(var(--muted))]/60 p-4">
                After Day 10
                <br />
                <span className="mt-2 block text-[hsl(var(--primary))]">
                  Eligibility starts on the maintenance date
                </span>
              </div>
            </div>
          </div>
          <div className="rounded-2xl border border-[hsl(var(--border))] bg-[hsl(var(--background))] p-7 md:p-9">
            <p className="text-eyebrow">Terms and conditions</p>
            <h3 className="mt-4 font-serif text-3xl text-[hsl(var(--foreground))]">
              Keep the plan clear
            </h3>
            <ol className="mt-6 list-decimal space-y-3 pl-5 text-sm leading-6 text-[hsl(var(--muted-foreground))]">
              {plan.terms.map((term) => (
                <li key={term}>{term}</li>
              ))}
              <li>{plan.maintenance.earlyWindow}</li>
              <li>{plan.maintenance.afterWindow}</li>
            </ol>
            <p className="mt-6 border-t border-[hsl(var(--border))] pt-5 text-xs leading-5 text-[hsl(var(--muted-foreground))]">
              Terms, qualifications, products, PV values, bonuses and
              compensation structures are subject to the official Loveli Luxury
              International policies and applicable laws.
            </p>
          </div>
        </div>

        <div className="mt-16 border-y border-[hsl(var(--primary))]/40 py-10 text-center">
          <p className="font-serif text-2xl uppercase tracking-[0.12em] text-[hsl(var(--foreground))] md:text-4xl">
            Start as a partner. Grow as an entrepreneur. Lead as a director.
            Build as a Crown President.
          </p>
          <p className="mt-5 text-sm font-semibold uppercase tracking-[0.24em] text-[hsl(var(--primary))]">
            Create your Loveli legacy.
          </p>
          <p className="mx-auto mt-5 max-w-3xl text-xs leading-5 text-[hsl(var(--muted-foreground))]">
            {plan.incomeDisclaimer}
          </p>
        </div>
      </div>
    </section>
  );
}
