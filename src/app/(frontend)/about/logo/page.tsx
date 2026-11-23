import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { Paragraphs } from '@/components/Paragraphs'
import { asMedia, src } from '@/lib/media'
import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'About our logo' }

/** The logo and what it means, edited in the admin under About → About our logo. */
export default async function LogoPage() {
  const { payload, access } = await getViewer()
  const about = await payload.findGlobal({ slug: 'about', depth: 1, ...access })
  if (!about.logo?.text) notFound()
  const logo = asMedia(about.logo.image)

  return (
    <article className="logo-page">
      <p className="eyebrow">About</p>
      <h1>{about.logo.heading || 'About our logo'}</h1>
      <div className="logo-page-body">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={src(logo, 'card')} alt={logo.alt} width={logo.width ?? 320} height={logo.height ?? 320} />
        )}
        <Paragraphs text={about.logo.text} className="prose" />
      </div>
    </article>
  )
}
