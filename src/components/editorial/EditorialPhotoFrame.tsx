type EditorialPhotoFrameProps = {
  src?: string
  alt?: string
  label: string
  caption?: string
  monogram?: string
  className?: string
}

export function EditorialPhotoFrame({
  src,
  alt,
  label,
  caption,
  monogram = 'LL',
  className = '',
}: EditorialPhotoFrameProps) {
  const hasImage = Boolean(src)

  return (
    <figure className={`min-w-0 ${className}`}>
      <div className="relative aspect-[4/5] overflow-hidden border border-[hsl(var(--primary))]/25 bg-[linear-gradient(145deg,hsl(var(--muted))_0%,hsl(var(--background))_64%,hsl(var(--primary))_180%)] shadow-[0_22px_52px_-36px_hsl(var(--foreground)/0.65)]">
        {hasImage ? (
          // A standard img keeps an editor-provided HTTPS URL independent of
          // Next Image remote-host configuration. The URL is schema-validated
          // and writable only by a superadmin through the content console.
          <img
            src={src}
            alt={alt || label}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="absolute inset-0" aria-hidden="true">
            <div className="absolute inset-5 border border-[hsl(var(--primary))]/20" />
            <div className="absolute inset-x-0 top-[18%] h-px bg-[hsl(var(--primary))]/25" />
            <div className="absolute inset-x-0 bottom-[18%] h-px bg-[hsl(var(--primary))]/25" />
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
              <span className="font-serif text-7xl font-light italic tracking-tight text-[hsl(var(--primary))]/70">
                {monogram}
              </span>
              <span className="mt-4 text-[9px] font-medium uppercase tracking-[0.36em] text-[hsl(var(--foreground))]">
                {label}
              </span>
              <span className="mt-2 max-w-[13rem] text-[9px] uppercase tracking-[0.2em] text-[hsl(var(--muted-foreground))]">
                Photography space
              </span>
            </div>
          </div>
        )}
        <div className="pointer-events-none absolute inset-3 border border-[hsl(var(--primary))]/15" />
      </div>
      <figcaption className="mt-4 flex items-start justify-between gap-4 text-[9px] uppercase tracking-[0.22em] text-[hsl(var(--muted-foreground))]">
        <span>{label}</span>
        {caption ? <span className="text-right">{caption}</span> : null}
      </figcaption>
    </figure>
  )
}
