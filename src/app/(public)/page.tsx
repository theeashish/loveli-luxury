import { Hero } from '@/components/home/Hero'
import { TrustStrip } from '@/components/home/TrustStrip'
import { FeaturedGrid } from '@/components/home/FeaturedGrid'
import { FindYourScent } from '@/components/home/FindYourScent'
import { Story } from '@/components/home/Story'
import { Marquee } from '@/components/home/Marquee'
import { CustomerProof } from '@/components/home/CustomerProof'
import { FragrancePhilosophy } from '@/components/home/FragrancePhilosophy'
import { DistributorCTA } from '@/components/home/DistributorCTA'
import { SocialProof } from '@/components/home/SocialProof'
import { FAQ } from '@/components/home/FAQ'
import { getSection } from '@/lib/content/site'

// Cached forever; admin save actions call revalidatePath('/') to refresh.
export const revalidate = false

export default async function HomePage() {
  const [heroCopy, findYourScentCopy] = await Promise.all([
    getSection('home_hero'),
    getSection('home_find_your_scent'),
  ])
  return (
    <>
      <Hero copy={heroCopy} />
      <TrustStrip />
      <FeaturedGrid />
      <FindYourScent copy={findYourScentCopy} />
      <Story />
      <Marquee />
      <CustomerProof />
      <FragrancePhilosophy />
      <DistributorCTA />
      <SocialProof />
      <FAQ />
    </>
  )
}
