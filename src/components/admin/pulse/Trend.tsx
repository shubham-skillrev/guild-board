/**
 * One measure across eight weeks: a 2px line, the latest week as a dot with
 * its value beside it, and every week's value on hover (each point carries
 * its own title and a hit area wider than the line). One series per chart;
 * two measures are two charts, never two axes.
 */
export function Trend({
  title,
  points,
  unit,
}: {
  title: string
  points: { label: string; value: number }[]
  unit: string
}) {
  const W = 320
  const H = 72
  const PAD = 6
  const max = Math.max(1, ...points.map(p => p.value))
  const x = (i: number) => PAD + (i * (W - PAD * 2 - 40)) / Math.max(1, points.length - 1)
  const y = (v: number) => H - PAD - (v / max) * (H - PAD * 2)
  const path = points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join(' ')
  const last = points[points.length - 1]

  return (
    <figure className="elev-1 rounded-(--radius-card) p-4">
      <figcaption className="flex items-baseline justify-between gap-3">
        <span className="text-footnote font-medium text-ink">{title}</span>
        <span className="text-meta text-ink-muted">last 8 weeks</span>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-3 w-full h-[72px] overflow-visible" role="img" aria-label={`${title}: ${points.map(p => `${p.label} ${p.value}`).join(', ')}`}>
        <line x1={PAD} x2={W - 40} y1={H - PAD} y2={H - PAD} className="stroke-border" strokeWidth={1} />
        <path d={path} fill="none" className="stroke-ink" strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        {points.map((p, i) => (
          <g key={p.label}>
            <title>{`Week of ${p.label}: ${p.value} ${unit}`}</title>
            <rect x={x(i) - 12} y={0} width={24} height={H} fill="transparent" />
          </g>
        ))}
        {last && (
          <>
            <circle cx={x(points.length - 1)} cy={y(last.value)} r={4} className="fill-ink stroke-paper" strokeWidth={2} />
            <text x={x(points.length - 1) + 9} y={y(last.value) + 4} className="fill-ink text-[12px] font-medium">{last.value}</text>
          </>
        )}
      </svg>
    </figure>
  )
}

/** A single headline number with its meaning. */
export function Figure({ label, value, sub }: { label: string; value: number | string; sub?: string }) {
  return (
    <div className="rounded-(--radius-card) border border-border bg-paper/60 px-4 py-3.5">
      <p className="text-meta text-ink-muted">{label}</p>
      <p className="mt-1.5 text-[26px] leading-none font-semibold tracking-tight text-ink">{value}</p>
      {sub && <p className="mt-1.5 text-meta text-ink-muted">{sub}</p>}
    </div>
  )
}
