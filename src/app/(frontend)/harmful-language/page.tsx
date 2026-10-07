import { RichText } from '@payloadcms/richtext-lexical/react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { getViewer } from '@/lib/viewer'

export const metadata: Metadata = { title: 'Statement on potentially harmful language' }

/**
 * The statement drafted with the site. Site settings can replace it with the project's own wording;
 * until then this text stands, so the page is never empty.
 */
function DefaultStatement() {
  return (
    <>
      <p>
        The documents in this collection were written across the twentieth century, and some reflect the racism and
        prejudice of their time. They include slurs, stereotypes and demeaning descriptions of Asian and Asian
        American people, and of others.
      </p>
      <p>
        We present these documents as they were written. Transcripts follow the DAAHO Transcription Policy, which
        keeps each document&rsquo;s original wording. Removing or softening that language would hide part of the
        history this collection exists to document, including the discrimination that Asian American students,
        faculty and families encountered in Ohio.
      </p>
      <p>
        The titles, descriptions and subject terms we add are meant to use present-day language. Where a
        document&rsquo;s own words are needed to understand it, we quote them as the document&rsquo;s words, not
        ours.
      </p>
      <p>
        Those descriptions are generated with AI and are being reviewed by project staff. AI can repeat outdated or
        harmful terms from the documents it reads, and standard library vocabularies sometimes use terms that the
        communities they describe no longer accept. Each item page says whether its description has been reviewed.
      </p>
      <p>
        If you find harmful language in our descriptions, or a description that is inaccurate, please tell us
        through <a href="https://lib.miamioh.edu">Miami University Libraries</a>. We welcome corrections and
        context, especially from people connected to the individuals and communities in these documents.
      </p>
    </>
  )
}

export default async function HarmfulLanguagePage() {
  const { payload } = await getViewer()
  const settings = await payload.findGlobal({ slug: 'settings', depth: 0 })
  return (
    <article className="statement">
      <h1>Statement on potentially harmful language</h1>
      <div className="prose">
        {settings.harmfulLanguageStatement ? <RichText data={settings.harmfulLanguageStatement} /> : <DefaultStatement />}
      </div>
      <p>
        <Link href="/items">Return to the collection</Link>
      </p>
    </article>
  )
}
