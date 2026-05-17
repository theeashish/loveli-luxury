'use server'

/**
 * Sign-out server action. Invoked by a form POST from the header (and
 * any other surface that wants to expose a Sign out control).
 *
 * Steps:
 *   1. Supabase signOut() — clears the auth cookies server-side.
 *   2. revalidatePath('/', 'layout') — re-renders header/footer with
 *      the now-unauthenticated state.
 *   3. redirect('/') — drops the user back on the homepage where the
 *      Log in / Sign up links are visible.
 */

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'

export async function signOutAction() {
  const supabase = createClient()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/')
}
