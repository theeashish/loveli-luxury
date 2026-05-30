'use server'

/**
 * Server actions for editing a site_content section.
 *
 * Flow: form posts the raw JSON body → we parse it → validate against the
 * section's Zod schema → upsert the row → revalidate the public homepage so
 * the new copy lands without a redeploy.
 *
 * Errors come back as form-friendly { ok: false, error } shapes so the page
 * can render them next to the textarea without throwing.
 */

import { revalidatePath } from 'next/cache'
import { requireAdmin, AuthError } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { SECTIONS, type SectionKey } from '@/lib/content/site'

export type SaveResult =
  | { ok: true }
  | { ok: false; error: string }

export async function saveSectionContent(
  sectionKey: string,
  rawJson: string,
): Promise<SaveResult> {
  let session
  try {
    session = await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden' }
    throw err
  }

  if (!(sectionKey in SECTIONS)) {
    return { ok: false, error: `Unknown section: ${sectionKey}` }
  }
  const key = sectionKey as SectionKey

  let parsed: unknown
  try {
    parsed = JSON.parse(rawJson)
  } catch (err) {
    return {
      ok: false,
      error: `Invalid JSON: ${err instanceof Error ? err.message : String(err)}`,
    }
  }

  const schemaResult = SECTIONS[key].schema.safeParse(parsed)
  if (!schemaResult.success) {
    return {
      ok: false,
      error: `Schema validation failed: ${schemaResult.error.issues
        .map((i) => `${i.path.join('.') || '(root)'} — ${i.message}`)
        .join('; ')}`,
    }
  }

  const service = createServiceClient()

  // TODO(types): regenerate database.ts post-035 to drop the cast.
  const upsertRes = (await (service.from('site_content' as never) as unknown as {
    upsert: (
      v: Record<string, unknown>,
      opts?: { onConflict?: string },
    ) => Promise<{ error: { message: string } | null }>
  }).upsert(
    {
      section_key: key,
      body: schemaResult.data,
      updated_by: session.userId,
    },
    { onConflict: 'section_key' },
  ))

  if (upsertRes.error) {
    return {
      ok: false,
      error: `Database write failed: ${upsertRes.error.message}`,
    }
  }

  // The homepage is statically cached (revalidate=false). Bust it so the
  // change is visible immediately.
  revalidatePath('/')
  revalidatePath(`/admin/content/site/${key}`)
  revalidatePath('/admin/content/site')

  return { ok: true }
}

export async function resetSectionToDefaults(
  sectionKey: string,
): Promise<SaveResult> {
  try {
    await requireAdmin()
  } catch (err) {
    if (err instanceof AuthError) return { ok: false, error: 'Forbidden' }
    throw err
  }

  if (!(sectionKey in SECTIONS)) {
    return { ok: false, error: `Unknown section: ${sectionKey}` }
  }
  const key = sectionKey as SectionKey

  const service = createServiceClient()

  // Deleting the row makes getSection() fall back to the in-code default.
  const delRes = (await (service.from('site_content' as never) as unknown as {
    delete: () => {
      eq: (col: string, val: unknown) => Promise<{ error: { message: string } | null }>
    }
  })
    .delete()
    .eq('section_key', key))

  if (delRes.error) {
    return { ok: false, error: `Reset failed: ${delRes.error.message}` }
  }

  revalidatePath('/')
  revalidatePath(`/admin/content/site/${key}`)
  revalidatePath('/admin/content/site')

  return { ok: true }
}
