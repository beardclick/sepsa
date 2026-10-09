export function Donut({ data, center, sub }) {
  const total = data.reduce((s, d) => s + d.value, 0) || 1
  const R = 70,
    C = 2 * Math.PI * R
  let acc = 0
  return (
    <svg
      viewBox="0 0 200 200"
      className="block w-full min-w-0 max-w-[210px]"
      role="img"
      aria-label="Gráfico de dona"
    >
      <circle
        cx="100"
        cy="100"
        r={R}
        fill="none"
        stroke="var(--soft)"
        strokeWidth="26"
      />
      {data.map((d, i) => {
        const len = (d.value / total) * C
        const el = (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={R}
            fill="none"
            stroke={d.color}
            strokeWidth="26"
            strokeDasharray={`${Math.max(0, len - 2)} ${C}`}
            strokeDashoffset={-acc}
            transform="rotate(-90 100 100)"
          >
            <title>{`${d.label}: ${d.value}`}</title>
          </circle>
        )
        acc += len
        return el
      })}
      <text
        x="100"
        y="104"
        textAnchor="middle"
        fontSize="28"
        fontWeight="800"
        fill="var(--fg)"
      >
        {center}
      </text>
      <text
        x="100"
        y="124"
        textAnchor="middle"
        fontSize="11"
        fill="var(--muted)"
      >
        {sub}
      </text>
    </svg>
  )
}

export function BarList({ data, format = (v) => v }) {
  const max = Math.max(1, ...data.map((d) => d.value))
  return (
    <ul className="space-y-3.5">
      {data.map((d) => (
        <li key={d.label}>
          <div className="mb-1 flex flex-wrap justify-between gap-x-3 gap-y-1 text-sm">
            <span className="font-medium">{d.label}</span>
            <span className="text-muted">{format(d.value)}</span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-soft">
            <div
              className="h-full rounded-full"
              style={{
                width: `${(d.value / max) * 100}%`,
                background: d.color || 'var(--c1)',
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  )
}
