/**
 * Shared admin form primitives.
 *
 * Every admin form imports from here so they all share the same shape
 * and palette. Editing this file changes every admin form at once.
 *
 * Palette (darker, higher contrast — chosen 2026-05-17):
 *   - text-neutral-900  primary text (input values, page titles)
 *   - text-neutral-800  field labels
 *   - text-neutral-700  section headers, page subtitles
 *   - text-neutral-600  body copy, cancel links
 *   - text-neutral-500  helper / hint text
 *   - text-neutral-400  placeholders
 */

import Link from 'next/link'

export const adminInputCls =
  'w-full rounded-md border border-neutral-300 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm transition placeholder:text-neutral-400 focus:border-neutral-900 focus:outline-none focus:ring-1 focus:ring-neutral-900 disabled:opacity-60'

export const adminCheckboxCls =
  'h-4 w-4 rounded border-neutral-400 text-neutral-900 focus:ring-neutral-900'

export const adminPrimaryBtnCls =
  'rounded-md bg-neutral-900 px-6 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60'

export const adminDangerBtnCls =
  'rounded-md border border-red-200 bg-white px-4 py-2 text-sm font-medium text-red-700 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60'

export const adminSecondaryBtnCls =
  'rounded-md border border-neutral-300 bg-white px-4 py-2 text-sm font-medium text-neutral-800 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60'

/**
 * AdminPageHeader — title + breadcrumb + subtitle for any admin page.
 */
export function AdminPageHeader({
  eyebrow,
  eyebrowHref,
  title,
  subtitle,
}: {
  /** Optional crumb above the title, e.g. "← Bundles" */
  eyebrow?: string
  eyebrowHref?: string
  title: string
  subtitle?: string
}) {
  return (
    <header className="mb-8">
      {eyebrow ? (
        eyebrowHref ? (
          <Link
            href={eyebrowHref}
            className="inline-flex items-center gap-1 text-xs uppercase tracking-[0.2em] text-neutral-500 transition hover:text-neutral-900"
          >
            {eyebrow}
          </Link>
        ) : (
          <p className="text-xs uppercase tracking-[0.2em] text-neutral-500">
            {eyebrow}
          </p>
        )
      ) : null}
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
        {title}
      </h1>
      {subtitle ? (
        <p className="mt-2 max-w-xl text-sm text-neutral-700">{subtitle}</p>
      ) : null}
    </header>
  )
}

/**
 * AdminFormSection — a labelled card for one chunk of a form.
 *
 * Use to group related fields (e.g., Identity, Pricing, Visibility)
 * so the page reads as discrete sections instead of a flat field wall.
 */
export function AdminFormSection({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="rounded-lg border border-neutral-200 bg-white px-5 py-5 shadow-sm md:px-6 md:py-6">
      <div className="mb-4">
        <h2 className="text-[11px] font-semibold uppercase tracking-[0.2em] text-neutral-700">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>
        ) : null}
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  )
}

/**
 * AdminFormField — label + input wrapper with optional required marker,
 * error message, and helper hint.
 */
export function AdminFormField({
  label,
  required,
  error,
  hint,
  children,
}: {
  label: string
  required?: boolean
  error?: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium text-neutral-800">
        {label}
        {required ? <span className="ml-0.5 text-red-600">*</span> : null}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-sm text-red-600">{error}</p>
      ) : null}
      {hint && !error ? (
        <p className="mt-1 text-xs text-neutral-500">{hint}</p>
      ) : null}
    </div>
  )
}

/**
 * AdminActionBar — sticky bottom bar with optional cancel link,
 * optional secondary action, and a required primary action.
 *
 * Sticky bottom-0 keeps Save visible without scrolling on long forms.
 */
export function AdminActionBar({
  cancelHref,
  cancelLabel = 'Cancel',
  primary,
  secondary,
}: {
  cancelHref?: string
  cancelLabel?: string
  primary: React.ReactNode
  secondary?: React.ReactNode
}) {
  return (
    <div className="sticky bottom-0 -mx-1 mt-8 flex items-center justify-between gap-3 rounded-lg border border-neutral-200 bg-white px-5 py-4 shadow-sm">
      {cancelHref ? (
        <Link
          href={cancelHref}
          className="text-sm text-neutral-600 transition hover:text-neutral-900"
        >
          {cancelLabel}
        </Link>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-3">
        {secondary}
        {primary}
      </div>
    </div>
  )
}
