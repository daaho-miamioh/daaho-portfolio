/**
 * The small Markdown used by the LivedMU stories — paragraphs, *italic*, **bold**, and bare web
 * addresses — as Lexical rich text for Payload, so the text can be edited in the admin afterwards.
 *
 * Addresses are found first and become links whole: the sources' URLs are full of underscores
 * (`&_phsrc=…&_phstart=…`), which a general Markdown parser reads as italics, breaking the links.
 *
 * `refs` turns item IDs written in the text (e.g. "AAMU-0061" in a story's sources) into links to
 * those items on this site; give only IDs that exist.
 */

type TextNode = { type: 'text'; text: string; format: number; detail: 0; mode: 'normal'; style: ''; version: 1 }
type LinkNode = {
  type: 'link'
  version: 3
  direction: 'ltr'
  format: ''
  indent: 0
  fields: { linkType: 'custom'; url: string; newTab: boolean }
  children: TextNode[]
}
type Inline = TextNode | LinkNode
type Paragraph = { type: 'paragraph'; version: 1; direction: 'ltr'; format: ''; indent: 0; textFormat: 0; textStyle: ''; children: Inline[] }
export type LexicalDoc = { root: { type: 'root'; version: 1; direction: 'ltr'; format: ''; indent: 0; children: Paragraph[] } }

const BOLD = 1
const ITALIC = 2
const URL = /https?:\/\/[^\s<>"]+/g
const ITEM_ID = /\b(?:AAMU|BC)-\d{4}[a-z]?\b/g

const text = (t: string, format = 0): TextNode => ({ type: 'text', text: t, format, detail: 0, mode: 'normal', style: '', version: 1 })

/** *italic* and **bold** within a run of text that contains no URL. */
function emphasis(run: string): TextNode[] {
  const out: TextNode[] = []
  const re = /(\*\*([^*]+)\*\*|\*([^*\n]+)\*)/g
  let last = 0
  for (const m of run.matchAll(re)) {
    if (m.index! > last) out.push(text(run.slice(last, m.index)))
    out.push(m[2] !== undefined ? text(m[2], BOLD) : text(m[3], ITALIC))
    last = m.index! + m[0].length
  }
  if (last < run.length) out.push(text(run.slice(last)))
  return out
}

type Refs = Map<string, string>

const link = (url: string, label: string, newTab: boolean): LinkNode => ({
  type: 'link',
  version: 3,
  direction: 'ltr',
  format: '',
  indent: 0,
  fields: { linkType: 'custom', url, newTab },
  children: [text(label)],
})

/** Item IDs in a run of text without URLs, as links where the item exists. */
function withRefs(run: string, refs?: Refs): Inline[] {
  if (!refs?.size) return emphasis(run)
  const out: Inline[] = []
  let last = 0
  for (const m of run.matchAll(ITEM_ID)) {
    const href = refs.get(m[0])
    if (!href) continue
    if (m.index! > last) out.push(...emphasis(run.slice(last, m.index)))
    out.push(link(href, m[0], false))
    last = m.index! + m[0].length
  }
  if (last < run.length) out.push(...emphasis(run.slice(last)))
  return out
}

function inline(para: string, refs?: Refs): Inline[] {
  const out: Inline[] = []
  let last = 0
  for (const m of para.matchAll(URL)) {
    // Sentence punctuation after an address is not part of it.
    const url = m[0].replace(/[.,;:)\]]+$/, '')
    if (m.index! > last) out.push(...withRefs(para.slice(last, m.index), refs))
    out.push(link(url, url, true))
    last = m.index! + url.length
  }
  if (last < para.length) out.push(...withRefs(para.slice(last), refs))
  return out
}

export function markdownToLexical(markdown: string, refs?: Refs): LexicalDoc {
  const paragraphs = markdown
    .replace(/\r\n?/g, '\n')
    .split(/\n\s*\n/)
    .map((p) => p.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
  return {
    root: {
      type: 'root',
      version: 1,
      direction: 'ltr',
      format: '',
      indent: 0,
      children: paragraphs.map((p) => ({ type: 'paragraph', version: 1, direction: 'ltr', format: '', indent: 0, textFormat: 0, textStyle: '', children: inline(p, refs) })),
    },
  }
}
