const CODES: Record<string, string> = { english: 'en', japanese: 'ja', chinese: 'zh', korean: 'ko', thai: 'th' }

/** A `lang` attribute for a transcript, so screen readers pronounce it correctly. Mixed -> none. */
export function langAttr(language: string | null | undefined): string | undefined {
  if (!language) return undefined
  const parts = language.toLowerCase().split(/\s*(?:;|,|\band\b)\s*/).filter(Boolean)
  return parts.length === 1 ? CODES[parts[0]] : undefined
}
