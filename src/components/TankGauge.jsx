import { timeAgo, minutesSince } from '../lib/timeAgo.js'

// Sensor is expected to write every ~1 min; flag it once readings go quiet.
const STALE_AFTER_MIN = 10

function levelColor(pct) {
  if (pct <= 20) return 'var(--red)'
  if (pct <= 45) return 'var(--amber)'
  return 'var(--green)'
}

export default function TankGauge({ label, data, loading }) {
  if (loading) {
    return <div className="tank-card tank-loading">···</div>
  }
  if (!data || !data.ok) {
    return null // sensor sheet not set up yet — stay quiet rather than show an error
  }
  if (!data.hasData) {
    return (
      <div className="tank-card">
        <div className="tank-label">{label}</div>
        <div className="tank-empty">No readings yet</div>
      </div>
    )
  }

  const pct = Math.round(data.waterLevel)
  const color = levelColor(pct)
  const stale = minutesSince(data.timestamp) > STALE_AFTER_MIN
  const fillY = 100 - pct // svg y-origin is top

  return (
    <div className="tank-card">
      <div className="tank-visual">
        <svg viewBox="0 0 60 100" className="tank-svg">
          <defs>
            <clipPath id={`tank-clip-${label}`}>
              <rect x="4" y="4" width="52" height="92" rx="8" />
            </clipPath>
          </defs>
          <rect x="4" y="4" width="52" height="92" rx="8" className="tank-outline" />
          <g clipPath={`url(#tank-clip-${label})`}>
            <rect x="0" y={fillY} width="60" height={pct + 4} fill={color} className="tank-fill" />
            <path
              d={`M0,${fillY} Q15,${fillY - 3} 30,${fillY} T60,${fillY} V${fillY + 6} H0 Z`}
              fill={color}
              opacity="0.55"
              className="tank-wave"
            />
          </g>
        </svg>
      </div>
      <div className="tank-info">
        <div className="tank-pct-big" style={{ color }}>{pct}<span className="tank-pct-sign">%</span></div>
        <div className="tank-label">{label}</div>
        <div className={`tank-synced${stale ? ' stale' : ''}`}>
          {stale && <span className="tank-offline-dot" />}
          {stale ? 'Offline · ' : ''}{timeAgo(data.timestamp)}
        </div>
      </div>
    </div>
  )
}
