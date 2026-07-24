'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import type { SupabaseClient } from '@supabase/supabase-js'

import { authorize, PERMISSIONS } from '@/lib/auth'
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
 *
 * Authorization is handled through the central RBAC service.
 * The write is audit logged and uses the service-role client because the
 * generated Database types do not yet include product_fragrance_meta.
 */
export async function upsertProductFragranceMeta(
  input: FragranceMetaInput,
): Promise<{ ok: true } | { error: string }> {
  const session = await authorize(PERMISSIONS.PRODUCTS_UPDATE)

  const parsed = schema.safeParse(input)

  if (!parsed.success) {
    return {
      error: parsed.error.issues.map((i) => i.message).join('; '),
    }
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

  const result = await (service as unknown as SupabaseClient)
    .from('product_fragrance_meta')
    .upsert(
      {
        ...meta,
        updated_at: new Date().toISOString(),
        updated_by: session.userId,
      },
      {
        onConflict: 'product_id',
      },
    )

  if (result.error) {
    return {
      error: result.error.message,
    }
  }

  await service.from('audit_log').insert({
    actor_id: session.userId,
    action: 'catalog.fragrance_meta_upserted',
    resource_type: 'product_fragrance_meta',
    resource_id: String(d.productId),
    after_data: meta,
  })

  revalidatePath(`/admin/catalog/products/${d.productId}`)

  // Product pages are statically generated.
  revalidatePath('/p/[slug]', 'page')

  return {
    ok: true,
  }
}