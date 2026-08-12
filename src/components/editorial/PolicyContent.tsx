import type { ReactNode } from 'react'

type PolicySectionData = {
  title: string
  body?: string
  bullets?: string[]
}

export function PolicyLead({ lead, intro }: { lead: string; intro: string }) {
  return (
    <div className="border-b border-[hsl(var(--border))] pb-10 md:pb-12">
      <p className="text-eyebrow">In detail</p>
      <h2 className="mt-5 max-w-4xl font-serif text-4xl leading-tight tracking-tight text-[hsl(var(--foreground))] md:text-5xl">
        {lead}
      </h2>
      <p className="mt-6 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
        {intro}
      </p>
    </div>
  )
}

export function PolicySection({
  index,
  section,
  children,
}: {
  index: number
  section: PolicySectionData
  children?: ReactNode
}) {
  return (
    <section className="grid gap-4 border-b border-[hsl(var(--border))] py-10 md:grid-cols-[3.75rem_minmax(0,1fr)] md:gap-7 md:py-12">
      <p className="pt-1 text-[10px] font-medium tracking-[0.18em] text-[hsl(var(--primary))]">
        {String(index + 1).padStart(2, '0')}
      </p>
      <div>
        <h3 className="font-serif text-3xl leading-tight italic tracking-tight text-[hsl(var(--foreground))] md:text-4xl">
          {section.title}
        </h3>
        {section.body ? (
          <p className="mt-5 max-w-3xl text-base leading-8 text-[hsl(var(--muted-foreground))]">
            {section.body}
          </p>
        ) : null}
        {section.bullets && section.bullets.length > 0 ? (
          <ul className="mt-5 space-y-3 border-l border-[hsl(var(--primary))]/35 pl-5 text-base leading-8 text-[hsl(var(--muted-foreground))]">
            {section.bullets.map((bullet) => (
              <li key={bullet}>{bullet}</li>
            ))}
          </ul>
        ) : null}
        {children ? <div className="mt-7">{children}</div> : null}
      </div>
    </section>
  )
}
