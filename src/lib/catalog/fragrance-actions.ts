'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'

const schema = z.object({
  productId: z.number().int().positive(),
  topNotes: z.array(z.string().min(1).max(80)).max(24),
  heartNotes: z.array(z.string().min(1).max(80)).max(24),
  baseNotes: z.array(z.string().min(1).max(80)).max(24),
  longevity: z.string().max(120).nullable(),
  projection: z.string().max(120).nullable(),
  climateNote: z.string().max(400).nullable(),
  occasions: z.array(z.string().min(1).max(40)).max(24),
  story: z.string().max(4000).nullable(),
  scentFamily: z.string().max(80).nullable(),
  inspiredBy: z.string().max(120).nullable(),
})

type FragranceMetaInput = z.infer<typeof schema>

/**
 * Upsert (1:1 by product_id) the fragrance detail rendered on /p/[slug].
 * Admin-only; audit-logged. product_fragrance_meta is not in the generated
 * Database types yet (regen pending, punch-list P3), so the write goes through
 * an untyped client.
 */
export async function upsertProductFragranceMeta(
  input: FragranceMetaInput,
): Promise<{ ok: true } | { error: string }> {
  const session = await requireAdmin()
  const parsed = schema.safeParse(input)
  if (!parsed.success) {
    return { error: parsed.error.issues.map((i) => i.message).join('; ') }
  }
  const d = parsed.data
  const service = createServiceClient()

  const meta = {
    product_id: d.productId,
    top_notes: d.topNotes,
    heart_notes: d.heartNotes,
    base_notes: d.baseNotes,
    longevity: d.longevity,
    projection: d.projection,
    climate_note: d.climateNote,
    occasions: d.occasions,
    story: d.story,
    scent_family: d.scentFamily,
    inspired_by: d.inspiredBy,
  }

  const res = await (service as unknown as SupabaseClient)
    .from('product_fragrance_meta')
    .upsert(
      { ...meta, updated_at: new Date().toISOString(), updated_by: session.userId },
      { onConflict: 'product_id' },
    )
  if (res.error) {
    return { error: res.error.message }
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'catalog.fragrance_meta_upserted',
    resource_type: 'product_fragrance_meta',
    resource_id: String(d.productId),
    after_data: meta,
  })

  revalidatePath(`/admin/catalog/products/${d.productId}`)
  // /p/[slug] is SSG — revalidate the whole route so an edit shows on the
  // live product page without a redeploy.
  revalidatePath('/p/[slug]', 'page')
  return { ok: true }
}
