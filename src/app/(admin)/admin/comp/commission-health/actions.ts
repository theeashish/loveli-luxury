'use server'

import { revalidatePath } from 'next/cache'
import { authorize, PERMISSIONS } from '@/lib/auth'
import { createServiceClient } from '@/lib/supabase/service'
import { reconcileMissingCommissions } from '@/lib/mlm/commission-reconcile'

export async function runReconcileNow(): Promise<void> {
  await authorize(PERMISSIONS.PAYMENTS_VERIFY)

  const service = createServiceClient()
  await reconcileMissingCommissions(service)

  revalidatePath('/admin/comp/commission-health')
}