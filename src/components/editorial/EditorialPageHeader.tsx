import type { ReactNode } from 'react'

export function EditorialPageHeader({
  eyebrow,
  title,
  description,
  detail,
  children,
}: {
  eyebrow: string
  title: string
  description: string
  detail?: ReactNode
  children?: ReactNode
}) {
  return (
    <header className="relative overflow-hidden border-b border-[hsl(var(--border))]/70">
      <div className="pointer-events-none absolute inset-0" aria-hidden="true">
        <div className="absolute -left-20 top-0 h-56 w-56 rounded-full bg-[hsl(var(--primary))]/[0.06] blur-3xl" />
        <div className="absolute right-[8%] top-[-7rem] h-64 w-64 rounded-full border border-[hsl(var(--primary))]/15" />
      </div>
      <div className="relative mx-auto max-w-7xl px-6 py-10 md:py-14">
        <div className="max-w-3xl">
          <p className="text-eyebrow">{eyebrow}</p>
          <h1 className="mt-5 font-serif text-5xl leading-[0.98] tracking-tight text-[hsl(var(--foreground))] md:text-6xl">
            {title}
          </h1>
          <p className="mt-6 max-w-2xl text-base leading-8 text-[hsl(var(--muted-foreground))] md:text-lg">
            {description}
          </p>
          {detail ? (
            <div className="mt-8 text-[10px] font-medium uppercase tracking-[0.27em] text-[hsl(var(--primary))]">
              {detail}
            </div>
          ) : null}
          {children ? <div className="mt-8">{children}</div> : null}
        </div>
      </div>
    </header>
  )
}
