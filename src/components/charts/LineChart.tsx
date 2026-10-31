import { EmptyState } from '../ui/EmptyState'

export interface ChartPoint {
  x: number
  y: number
}

interface LineChartProps {
  points: ChartPoint[]
  color?: string
  height?: number
  xFormat?: (value: number) => string
  yFormat?: (value: number) => string
  emptyLabel: string
}

function domain(values: number[]): [number, number] {
  let min = Number.POSITIVE_INFINITY
  let max = Number.NEGATIVE_INFINITY

  for (const value of values) {
    if (!Number.isFinite(value)) continue
    if (value < min) min = value
    if (value > max) max = value
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return [0, 1]
  }

  const allNonNegative = values.every((value) => value >= 0)

  if (min === max) {
    const pad = Math.abs(min) * 0.12 || 1
    return [allNonNegative ? Math.max(0, min - pad) : min - pad, max + pad]
  }

  const pad = (max - min) * 0.08
  return [allNonNegative ? Math.max(0, min - pad) : min - pad, max + pad]
}

export function LineChart({
  points,
  color = '#5aa0d6',
  height = 92,
  xFormat = String,
  yFormat = (value) => value.toFixed(2),
  emptyLabel,
}: LineChartProps) {
  if (points.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>
  }

  const width = 280
  const padding = { top: 8, right: 8, bottom: 18, left: 36 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const [minY, maxY] = domain(points.map((point) => point.y))
  const minX = points[0]?.x ?? 0
  const maxX = points[points.length - 1]?.x ?? 1
  const spanX = maxX === minX ? 1 : maxX - minX
  const spanY = maxY - minY

  const mapped = points.map((point) => ({
    x: padding.left + ((point.x - minX) / spanX) * innerWidth,
    y: padding.top + (1 - (point.y - minY) / spanY) * innerHeight,
  }))

  const path = mapped
    .map((point, index) => `${index === 0 ? 'M' : 'L'}${point.x.toFixed(2)} ${point.y.toFixed(2)}`)
    .join(' ')

  const first = points[0]
  const last = points[points.length - 1]

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="block h-auto w-full" role="img">
      <line
        x1={padding.left}
        y1={padding.top}
        x2={padding.left}
        y2={height - padding.bottom}
        stroke="#2a3648"
        strokeWidth="1"
      />
      <line
        x1={padding.left}
        y1={height - padding.bottom}
        x2={width - padding.right}
        y2={height - padding.bottom}
        stroke="#2a3648"
        strokeWidth="1"
      />
      <line
        x1={padding.left}
        y1={padding.top + innerHeight / 2}
        x2={width - padding.right}
        y2={padding.top + innerHeight / 2}
        stroke="#2a3648"
        strokeWidth="1"
        strokeDasharray="2 3"
      />
      {mapped.length > 1 ? (
        <path d={path} fill="none" stroke={color} strokeWidth="1.6" />
      ) : null}
      {mapped.map((point, index) => (
        <circle key={`${point.x}-${point.y}-${index}`} cx={point.x} cy={point.y} r="1.7" fill={color} />
      ))}
      <text x={4} y={padding.top + 8} fill="#8b97a8" fontSize="9" fontFamily="ui-monospace, monospace">
        {yFormat(maxY)}
      </text>
      <text
        x={4}
        y={height - padding.bottom - 2}
        fill="#8b97a8"
        fontSize="9"
        fontFamily="ui-monospace, monospace"
      >
        {yFormat(minY)}
      </text>
      {first ? (
        <text
          x={padding.left}
          y={height - 4}
          fill="#8b97a8"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          {xFormat(first.x)}
        </text>
      ) : null}
      {last ? (
        <text
          x={width - padding.right}
          y={height - 4}
          fill="#8b97a8"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
          textAnchor="end"
        >
          {xFormat(last.x)}
        </text>
      ) : null}
    </svg>
  )
}
