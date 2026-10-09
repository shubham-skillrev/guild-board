/** The title with its accent word (first match, any case) in the display italic. */
export function AccentTitle({ title, accent }: { title: string; accent?: string }) {
  const at = accent ? title.toLowerCase().indexOf(accent.toLowerCase()) : -1
  if (!accent || at < 0) return <>{title}</>
  return (
    <>
      {title.slice(0, at)}
      <span className="accent-word">{title.slice(at, at + accent.length)}</span>
      {title.slice(at + accent.length)}
    </>
  )
}
