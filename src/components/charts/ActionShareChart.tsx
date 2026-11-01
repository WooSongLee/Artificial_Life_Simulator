import { ACTION_COLORS, ACTION_LABELS } from '../../learning/constants'
import { AGENT_ACTIONS } from '../../learning/types'
import type { AgentAction } from '../../learning/types'
import { formatSimulationTime } from '../../utils/time'
import { EmptyState } from '../ui/EmptyState'

export interface ActionSharePoint {
  time: number
  counts: Record<AgentAction, number>
}

interface MappedSample {
  x: number
  time: number
  shares: number[]
}

export function ActionShareChart({
  points,
  emptyLabel,
  height = 120,
}: {
  points: ActionSharePoint[]
  emptyLabel: string
  height?: number
}) {
  const samples = points.flatMap((point) => {
    const total = AGENT_ACTIONS.reduce((sum, action) => sum + (point.counts[action] ?? 0), 0)
    if (total <= 0) return []
    return [
      {
        time: point.time,
        shares: AGENT_ACTIONS.map((action) => (point.counts[action] ?? 0) / total),
      },
    ]
  })

  if (samples.length === 0) {
    return <EmptyState>{emptyLabel}</EmptyState>
  }

  const width = 280
  const padding = { top: 8, right: 8, bottom: 18, left: 36 }
  const innerWidth = width - padding.left - padding.right
  const innerHeight = height - padding.top - padding.bottom
  const minX = samples[0]?.time ?? 0
  const maxX = samples[samples.length - 1]?.time ?? 1
  const spanX = maxX === minX ? 1 : maxX - minX

  const mapped: MappedSample[] = samples.map((sample) => ({
    x: padding.left + ((sample.time - minX) / spanX) * innerWidth,
    time: sample.time,
    shares: sample.shares,
  }))

  const layers = AGENT_ACTIONS.map((action, actionIndex) => {
    const top = mapped.map((sample) => {
      let cumulative = 0
      for (let index = 0; index <= actionIndex; index += 1) {
        cumulative += sample.shares[index] ?? 0
      }
      return {
        x: sample.x,
        y: padding.top + (1 - cumulative) * innerHeight,
      }
    })
    const bottom = mapped.map((sample) => {
      let cumulative = 0
      for (let index = 0; index < actionIndex; index += 1) {
        cumulative += sample.shares[index] ?? 0
      }
      return {
        x: sample.x,
        y: padding.top + (1 - cumulative) * innerHeight,
      }
    })

    const path =
      mapped.length === 1
        ? rectanglePath(top[0]?.x ?? padding.left, top[0]?.y ?? padding.top, bottom[0]?.y ?? padding.top + innerHeight, innerWidth)
        : [
            `M${top[0]?.x.toFixed(2) ?? 0} ${top[0]?.y.toFixed(2) ?? 0}`,
            ...top.slice(1).map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
            ...bottom
              .slice()
              .reverse()
              .map((point) => `L${point.x.toFixed(2)} ${point.y.toFixed(2)}`),
            'Z',
          ].join(' ')

    return { action, path }
  })

  const first = samples[0]
  const last = samples[samples.length - 1]

  return (
    <div>
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
        {layers.map((layer) => (
          <path key={layer.action} d={layer.path} fill={ACTION_COLORS[layer.action]} opacity="0.85" />
        ))}
        <text x={4} y={padding.top + 8} fill="#8b97a8" fontSize="9" fontFamily="ui-monospace, monospace">
          100%
        </text>
        <text
          x={4}
          y={height - padding.bottom - 2}
          fill="#8b97a8"
          fontSize="9"
          fontFamily="ui-monospace, monospace"
        >
          0%
        </text>
        {first ? (
          <text
            x={padding.left}
            y={height - 4}
            fill="#8b97a8"
            fontSize="9"
            fontFamily="ui-monospace, monospace"
          >
            {formatSimulationTime(first.time)}
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
            {formatSimulationTime(last.time)}
          </text>
        ) : null}
      </svg>
      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-lab-muted">
        {AGENT_ACTIONS.map((action) => (
          <span key={action} className="inline-flex items-center gap-1">
            <span className="inline-block h-2 w-2" style={{ backgroundColor: ACTION_COLORS[action] }} />
            {ACTION_LABELS[action]}
          </span>
        ))}
      </div>
    </div>
  )
}

function rectanglePath(x: number, top: number, bottom: number, width: number): string {
  const left = x - 4
  const right = x + Math.min(width * 0.08, 10)
  return `M${left.toFixed(2)} ${top.toFixed(2)} L${right.toFixed(2)} ${top.toFixed(2)} L${right.toFixed(2)} ${bottom.toFixed(2)} L${left.toFixed(2)} ${bottom.toFixed(2)} Z`
}
