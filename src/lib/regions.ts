/**
 * Which Asian countries an item concerns, for matching historical context.
 *
 * Place headings record where a document was written — 91 of 128 items say Ohio — so a 1937 letter
 * from a Chinese student at Miami carries no "China" there. Nationality subjects are rare (15 items).
 * The title and description name the country far more often: matching them finds a region for 77 of
 * 128 items. The result is stored on the item and editable, because a passing mention ("a Japanese
 * garden") is not the same as an item about Japan.
 */

export const REGIONS = ['China', 'Japan', 'Korea', 'Philippines', 'Thailand', 'Burma', 'Singapore'] as const
export type Region = (typeof REGIONS)[number]

const KEYWORDS: Record<Region, RegExp> = {
  China: /\b(china|chinese|peking|peiping|beijing|shanghai|canton|nanking|nanjing|tsing ?hua|hong kong)\b/i,
  Japan: /\b(japan|japanese|tokyo|kobe|k[oō]be|osaka|yokohama|kyoto|waseda)\b/i,
  Korea: /\b(korea|korean|seoul)\b/i,
  Philippines: /\b(philippines|philippine|filipino|manila)\b/i,
  Thailand: /\b(siam|siamese|thai|thailand|bangkok)\b/i,
  Burma: /\b(burma|burmese|rangoon)\b/i,
  Singapore: /\bsingapore\b/i,
}

export function detectRegions(input: {
  title?: string | null
  description?: string | null
  places?: string[]
  subjects?: string[]
  language?: string | null
}): Region[] {
  const text = [input.title, input.description, ...(input.places ?? []), ...(input.subjects ?? []), input.language]
    .filter(Boolean)
    .join(' \n ')
  return REGIONS.filter((region) => KEYWORDS[region].test(text))
}
