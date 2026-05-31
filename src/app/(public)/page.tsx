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
import { publicEnv } from '@/lib/env'

// Cached forever; admin save actions call revalidatePath('/') to refresh.
export const revalidate = false

/**
 * Homepage structured data. Organization + WebSite let Google render brand-name
 * search results with the proper sitelink box and a search action. Mirrors
 * the per-PDP JSON-LD already shipped at /p/[slug]. Keeping the two graph nodes
 * in one @graph keeps payload small and references easy.
 */
function buildHomeJsonLd(baseUrl: string) {
  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Organization',
        '@id': `${baseUrl}#organization`,
        name: 'Loveli Luxury Scents',
        alternateName: 'Loveli Luxury International',
        url: baseUrl,
        logo: `${baseUrl}/products/loveli-signature.jpg`,
        description:
          'Premium African fragrance commerce. Eau de Parfum blended in small batches, bottled with intention. Kenya-first, M-Pesa-native.',
        slogan: 'Where Love Meets Luxury',
        areaServed: ['Kenya', 'East Africa'],
      },
      {
        '@type': 'WebSite',
        '@id': `${baseUrl}#website`,
        url: baseUrl,
        name: 'Loveli Luxury Scents',
        publisher: { '@id': `${baseUrl}#organization` },
        inLanguage: 'en-KE',
        potentialAction: {
          '@type': 'SearchAction',
          target: {
            '@type': 'EntryPoint',
            urlTemplate: `${baseUrl}/shop?q={search_term_string}`,
          },
          'query-input': 'required name=search_term_string',
        },
      },
    ],
  }
}

export default async function HomePage() {
  const [heroCopy, findYourScentCopy] = await Promise.all([
    getSection('home_hero'),
    getSection('home_find_your_scent'),
  ])
  const baseUrl = publicEnv.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')
  const jsonLd = buildHomeJsonLd(baseUrl)
  return (
    <>
      {/* Organization + WebSite JSON-LD for brand SERPs + sitelink search box. */}
      <script
        type="application/ld+json"
        // eslint-disable-next-line react/no-danger
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
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
