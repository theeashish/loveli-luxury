import { Hero } from '@/components/home/Hero'
import { Marquee } from '@/components/home/Marquee'
import { FeaturedGrid } from '@/components/home/FeaturedGrid'
import { FindYourScent } from '@/components/home/FindYourScent'
import { Story } from '@/components/home/Story'
import { FAQ } from '@/components/home/FAQ'
import { DistributorCTA } from '@/components/home/DistributorCTA'

export const revalidate = false

export default function HomePage() {
  return (
    <>
      <Hero />
      <Marquee />
      <FeaturedGrid />
      <FindYourScent />
      <Story />
      <DistributorCTA />
      <FAQ />
    </>
  )
}
