/** Plain text from a textarea, with blank lines as paragraph breaks. */
export function Paragraphs({ text, className }: { text?: string | null; className?: string }) {
  const parts = (text ?? '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  if (!parts.length) return null
  return (
    <div className={className}>
      {parts.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  )
}
