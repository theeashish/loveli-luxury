'use server'

/**
 * Admin server actions for the monthly close + auto-drafted payouts flow.
 *
 * Both actions delegate to src/lib/close/orchestrate.ts so the cron
 * endpoint shares one source of truth for the iteration logic. These
 * action wrappers add the admin gate, parse FormData, and redirect with
 * summary query params after the work completes.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireAdmin } from '@/lib/auth/roles'
import {
  runCloseForPeriod,
  draftPayoutsForPeriod,
} from '@/lib/close/orchestrate'

const periodSchema = z.object({
  year: z.coerce.number().int().min(2024).max(2099),
  month: z.coerce.number().int().min(1).max(12),
})

export async function runMonthlyClose(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const parsed = periodSchema.safeParse({
    year: formData.get('year'),
    month: formData.get('month'),
  })
  if (!parsed.success) throw new Error('Invalid period')
  const { year, month } = parsed.data

  const result = await runCloseForPeriod(year, month, session.userId)

  revalidatePath('/admin/close')
  revalidatePath('/admin/payouts')
  redirect(
    `/admin/close?ran=${year}-${String(month).padStart(2, '0')}` +
      `&processed=${result.processed}` +
      `&failed=${result.failed}` +
      `&promoted=${result.promoted}`,
  )
}

export async function draftPayoutsForPeriodAction(formData: FormData): Promise<void> {
  const session = await requireAdmin()
  const parsed = periodSchema.safeParse({
    year: formData.get('year'),
    month: formData.get('month'),
  })
  if (!parsed.success) throw new Error('Invalid period')
  const { year, month } = parsed.data

  const result = await draftPayoutsForPeriod(year, month, session.userId)

  revalidatePath('/admin/close')
  revalidatePath('/admin/payouts')
  redirect(
    `/admin/close?drafted=${year}-${String(month).padStart(2, '0')}` +
      `&created=${result.drafted}` +
      `&existed=${result.skippedExisting}` +
      `&zero=${result.skippedZero}` +
      `&failed=${result.failed}`,
  )
}
