import { redirect } from 'next/navigation'

export const metadata = { title: 'Policies' }

/**
 * /policies — no body of its own. Redirect to the authenticity page
 * (the page customers most want to see when they're checking us out).
 */
export default function PoliciesIndex() {
  redirect('/policies/authenticity')
}
