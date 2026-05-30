'use server'

import { revalidatePath } from 'next/cache'
import { requireAdmin } from '@/lib/auth/roles'
import { createServiceClient } from '@/lib/supabase/service'
import { reconcileMissingCommissions } from '@/lib/mlm/commission-reconcile'

export async function runReconcileNow(): Promise<void> {
  await requireAdmin()
  const service = createServiceClient()
  await reconcileMissingCommissions(service)
  revalidatePath('/admin/comp/commission-health')
}
