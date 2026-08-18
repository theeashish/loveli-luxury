import Link from 'next/link'

export function AccountProtectionNotice() {
  return (
    <section
      className="rounded-2xl border border-[hsl(var(--primary))]/20 bg-[hsl(var(--muted))] p-6"
      aria-labelledby="account-protection-heading"
    >
      <p className="text-[10px] uppercase tracking-[0.3em] text-[hsl(var(--brand-champagne-deep))]">
        Your privacy matters
      </p>
      <h2 id="account-protection-heading" className="mt-2 font-serif text-2xl tracking-tight">
        How we protect your account
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[hsl(var(--muted-foreground))]">
        We verify only what is needed to protect your account, M-Pesa payouts, and partner access. We do not sell your personal information, and sensitive verification details are visible only to authorised reviewers.
      </p>
      <div className="mt-4 grid gap-3 text-xs text-[hsl(var(--muted-foreground))] sm:grid-cols-3">
        <p>
          <strong className="text-[hsl(var(--foreground))]">Secure access.</strong> Email and phone checks help keep accounts in the right hands.
        </p>
        <p>
          <strong className="text-[hsl(var(--foreground))]">Private review.</strong> Partner checks are handled by authorised staff.
        </p>
        <p>
          <strong className="text-[hsl(var(--foreground))]">Human support.</strong> If something needs attention, we explain why and how to fix it.
        </p>
      </div>
      <Link
        href="/policies/privacy"
        className="mt-4 inline-flex text-xs uppercase tracking-[0.15em] text-[hsl(var(--brand-champagne-deep))] underline-offset-4 hover:underline"
      >
        Read our privacy promise
      </Link>
    </section>
  )
}
