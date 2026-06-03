import { useEffect, useState } from 'react'

interface NodeState {
  role: string
  inventory: number
  backorder: number
  shipped: number
  shipment_pipeline: number[]
  order_pipeline: number[]
  incoming_order: number
  order_placed: number | null
}

interface Props {
  states: NodeState[]
  round: number
  totalRounds: number
  demandPattern: number[]
  navRound?: number
  onNavChange?: (r: number) => void
}

// ── Zigzag layout ─────────────────────────────────────────────────
const TOP_Y = 65
const BOT_Y = 220

const NODE_CONFIG = [
  { key: 'materiaprima', label: 'Materia Prima', emoji: '🌾', cx:  75, cy: TOP_Y },
  { key: 'factory',      label: 'Fábrica',        emoji: '🏭', cx: 230, cy: BOT_Y },
  { key: 'distributor',  label: 'Mayorista',       emoji: '📦', cx: 390, cy: TOP_Y },
  { key: 'wholesaler',   label: 'Distribuidor',    emoji: '🏪', cx: 550, cy: BOT_Y },
  { key: 'retailer',    label: 'Minorista',       emoji: '🏬', cx: 710, cy: TOP_Y },
  { key: 'customer',    label: 'Cliente',         emoji: '👥', cx: 870, cy: BOT_Y },
]

// Unit vector from node[i] to node[i+1]
function segUnit(i: number) {
  const a = NODE_CONFIG[i], b = NODE_CONFIG[i + 1]
  const dx = b.cx - a.cx, dy = b.cy - a.cy
  const L  = Math.sqrt(dx * dx + dy * dy)
  return { ux: dx / L, uy: dy / L, L }
}

// CW perpendicular (visually "above" the line in screen coords)
function cwPerp(ux: number, uy: number) {
  return { px: uy, py: -ux }
}

// ── Shipment truck (slides along the diagonal toward customer) ────
function ShipTruck({
  x, y, units, ux, uy, delay, fromLabel, toLabel, arrivesIn, sentInRound, extraInfo,
}: {
  x: number; y: number; units: number; ux: number; uy: number; delay: number
  fromLabel: string; toLabel: string; arrivesIn: number; sentInRound: number; extraInfo?: string
}) {
  const travel = 70
  const fromX  = -(ux * travel)
  const fromY  = -(uy * travel)
  const arrivesRound = sentInRound + arrivesIn   // approx round when it arrives
  const sentTxt   = sentInRound > 0 ? `R${sentInRound}` : 'inicio'
  const arrivesTxt = arrivesIn === 1 ? `próxima ronda (R${arrivesRound})` : `en ${arrivesIn} rondas (R${arrivesRound})`
  const lines = [
    `🚚 Envío: ${units} u.`,
    `De: ${fromLabel}  →  ${toLabel}`,
    `Despachado en: ${sentTxt}`,
    `Llega: ${arrivesTxt}`,
    ...(extraInfo ? [extraInfo] : []),
  ]
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: 'help' }}>
      <title>{lines.join('\n')}</title>
      {/* invisible hit area for easier hover */}
      <rect x={-24} y={-24} width={48} height={40} fill="transparent" />
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          from={`${fromX} ${fromY}`}
          to="0 0"
          dur="1.6s"
          calcMode="spline"
          keySplines="0.25 0.1 0.1 1"
          keyTimes="0;1"
          begin={`${delay}s`}
          fill="freeze"
        />
        <rect x={-20} y={-9}  width={25} height={14} rx={2} fill="#3a3939" stroke="#A6A7A2" strokeWidth={0.8} />
        <rect x={5}   y={-12} width={13} height={17} rx={2} fill="#2a2a2a" stroke="#A6A7A2" strokeWidth={0.8} />
        <rect x={7}   y={-10} width={8}  height={6}  rx={1} fill="#00ACAC" opacity={0.65} />
        <circle cx={-9}  cy={7} r={4.5} fill="#111" stroke="#555" strokeWidth={0.8} />
        <circle cx={-9}  cy={7} r={1.8} fill="#444" />
        <circle cx={12}  cy={7} r={4.5} fill="#111" stroke="#555" strokeWidth={0.8} />
        <circle cx={12}  cy={7} r={1.8} fill="#444" />
        <circle cx={-7}  cy={-19} r={9}  fill="#00ACAC" />
        <text   x={-7}   y={-15} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">{units}</text>
      </g>
    </g>
  )
}

// ── Order envelope (slides along the diagonal toward supplier) ────
function OrderEnvelope({
  x, y, units, ux, uy, delay, fromLabel, toLabel, arrivesIn, sentInRound, extraInfo,
}: {
  x: number; y: number; units: number; ux: number; uy: number; delay: number
  fromLabel: string; toLabel: string; arrivesIn: number; sentInRound: number; extraInfo?: string
}) {
  const travel = 70
  const fromX  = -(ux * travel)
  const fromY  = -(uy * travel)
  const arrivesRound = sentInRound + arrivesIn
  const sentTxt    = sentInRound > 0 ? `R${sentInRound}` : 'inicio'
  const arrivesTxt = arrivesIn === 1 ? `próxima ronda (R${arrivesRound})` : `en ${arrivesIn} rondas (R${arrivesRound})`
  const lines = [
    `✉️ Pedido: ${units} u.`,
    `De: ${fromLabel}  →  ${toLabel}`,
    `Colocado en: ${sentTxt}`,
    `Llega: ${arrivesTxt}`,
    ...(extraInfo ? [extraInfo] : []),
  ]
  return (
    <g transform={`translate(${x},${y})`} style={{ cursor: 'help' }}>
      <title>{lines.join('\n')}</title>
      {/* invisible hit area */}
      <rect x={-18} y={-24} width={40} height={40} fill="transparent" />
      <g>
        <animateTransform
          attributeName="transform"
          type="translate"
          from={`${fromX} ${fromY}`}
          to="0 0"
          dur="1.6s"
          calcMode="spline"
          keySplines="0.25 0.1 0.1 1"
          keyTimes="0;1"
          begin={`${delay}s`}
          fill="freeze"
        />
        <rect x={-13} y={-9} width={26} height={18} rx={2} fill="#2e2e2e" stroke="#A6A7A2" strokeWidth={0.8} />
        <polyline points="-13,-9 0,2 13,-9" fill="none" stroke="#A6A7A2" strokeWidth={0.9} />
        <line x1={-13} y1={9}  x2={-1} y2={0}  stroke="#555" strokeWidth={0.7} />
        <line x1={13}  y1={9}  x2={1}  y2={0}  stroke="#555" strokeWidth={0.7} />
        <circle cx={11}  cy={-17} r={9}  fill="#464545" stroke="#A6A7A2" strokeWidth={0.8} />
        <text   x={11}   y={-13} textAnchor="middle" fill="#DFDEDC" fontSize={9} fontWeight="bold">{units}</text>
      </g>
    </g>
  )
}

// ── Bottle caps (inventory) ───────────────────────────────────────
function BottleCaps({ x, y, count }: { x: number; y: number; count: number }) {
  const max  = 12
  const show = Math.min(count, max)
  const cols = 3
  return (
    <g>
      {Array.from({ length: show }).map((_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const cx  = x - ((cols - 1) * 11) / 2 + col * 11
        const cy  = y - row * 11
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5} fill="#00ACAC" opacity={0.9} />
            <circle cx={cx - 1.5} cy={cy - 1.5} r={1.8} fill="white" opacity={0.28} />
          </g>
        )
      })}
      {count > max && (
        <text x={x} y={y - Math.floor((max - 1) / cols) * 11 - 14}
          textAnchor="middle" fill="#00ACAC" fontSize={9} fontWeight="bold">
          +{count - max}
        </text>
      )}
    </g>
  )
}

// ── Core SVG ──────────────────────────────────────────────────────
function MapSVG({ states, round, demandPattern, animKey }: {
  states: NodeState[]
  round: number
  demandPattern: number[]
  animKey: number
}) {
  const byRole = Object.fromEntries(states.map(s => [s.role, s]))
  const demand = round > 0 ? (demandPattern[round - 1] ?? 0) : (demandPattern[0] ?? 0)

  // Perpendicular offset to keep trucks/envelopes on separate lanes of the same road
  const PERP = 14

  // Build per-segment data (0=MP→Fábrica, 1=Fábrica→Mayorista, …, 4=Minorista→Cliente)
  const shipSegments = [
    { si: 0, fromLabel: 'Materia Prima', toLabel: 'Fábrica',      pipeline: byRole['factory']?.shipment_pipeline     ?? [] },
    { si: 1, fromLabel: 'Fábrica',       toLabel: 'Mayorista',    pipeline: byRole['distributor']?.shipment_pipeline ?? [] },
    { si: 2, fromLabel: 'Mayorista',     toLabel: 'Distribuidor', pipeline: byRole['wholesaler']?.shipment_pipeline  ?? [] },
    { si: 3, fromLabel: 'Distribuidor',  toLabel: 'Minorista',    pipeline: byRole['retailer']?.shipment_pipeline   ?? [] },
    { si: 4, fromLabel: 'Minorista',     toLabel: 'Cliente',      pipeline: [byRole['retailer']?.shipped ?? 0]            },
  ]

  // Order segments travel from downstream → upstream (reversed direction)
  const orderSegments = [
    { fromI: 1, toI: 0, fromLabel: 'Fábrica',      toLabel: 'Materia Prima', pipeline: byRole['factory']?.order_pipeline    ?? [] },
    { fromI: 2, toI: 1, fromLabel: 'Mayorista',     toLabel: 'Fábrica',       pipeline: byRole['distributor']?.order_pipeline ?? [] },
    { fromI: 3, toI: 2, fromLabel: 'Distribuidor',  toLabel: 'Mayorista',     pipeline: byRole['wholesaler']?.order_pipeline  ?? [] },
    { fromI: 4, toI: 3, fromLabel: 'Minorista',     toLabel: 'Distribuidor',  pipeline: byRole['retailer']?.order_pipeline   ?? [] },
    { fromI: 5, toI: 4, fromLabel: 'Cliente',       toLabel: 'Minorista',     pipeline: [demand]                                    },
  ]

  return (
    <svg key={animKey} viewBox="0 0 960 330" width="100%" style={{ minWidth: 620 }}>
      <defs>
        <style>{`
          @keyframes nodeIn {
            from { opacity: 0; transform: scale(0.82); }
            to   { opacity: 1; transform: scale(1); }
          }
        `}</style>
      </defs>

      {/* ── Road segments (thick dark band) ── */}
      {NODE_CONFIG.slice(0, -1).map((n, i) => {
        const n2 = NODE_CONFIG[i + 1]
        return (
          <line key={i}
            x1={n.cx} y1={n.cy} x2={n2.cx} y2={n2.cy}
            stroke="#252525" strokeWidth={22} strokeLinecap="round"
          />
        )
      })}

      {/* ── Lane dividers ── */}
      {NODE_CONFIG.slice(0, -1).map((n, i) => {
        const n2 = NODE_CONFIG[i + 1]
        return (
          <line key={`div-${i}`}
            x1={n.cx} y1={n.cy} x2={n2.cx} y2={n2.cy}
            stroke="#444" strokeWidth={1} strokeDasharray="8,8"
          />
        )
      })}

      {/* ── Shipment trucks (CW lane — "upper" side of each diagonal) ── */}
      {shipSegments.map(({ si, pipeline, fromLabel, toLabel }) => {
        const { ux, uy } = segUnit(si)
        const { px, py } = cwPerp(ux, uy)
        const a = NODE_CONFIG[si], b = NODE_CONFIG[si + 1]
        const n = pipeline.length
        return pipeline.map((units, i) => {
          const arrivesIn    = i + 1
          // sentInRound: item dispatched at round = current_round + arrivesIn - delay
          // delay ≈ n for pipeline-based segments; 1 for the shipped-to-customer segment
          const delay_periods = n > 1 ? n : 1
          const sentInRound   = round + arrivesIn - delay_periods - 1
          const t  = 1 - (i + 0.5) / (n || 1)
          const x  = a.cx + t * (b.cx - a.cx) + px * PERP
          const y  = a.cy + t * (b.cy - a.cy) + py * PERP
          // Extra info for retailer→customer: show backorder if any
          let extraInfo: string | undefined
          if (si === 4) {
            const bo  = byRole['retailer']?.backorder ?? 0
            const inc = byRole['retailer']?.incoming_order ?? demand
            if (bo > 0) extraInfo = `⚠️ Se pidió: ${inc} u. | Faltante (backorder): ${bo} u.`
          }
          return (
            <ShipTruck
              key={`sh-${si}-${i}`}
              x={x} y={y} units={units}
              ux={ux} uy={uy}
              delay={i * 0.12}
              fromLabel={fromLabel} toLabel={toLabel}
              arrivesIn={arrivesIn} sentInRound={sentInRound}
              extraInfo={extraInfo}
            />
          )
        })
      })}

      {/* ── Order envelopes (CCW lane — "lower" side of each diagonal) ── */}
      {orderSegments.map(({ fromI, toI, pipeline, fromLabel, toLabel }) => {
        const dx = NODE_CONFIG[toI].cx - NODE_CONFIG[fromI].cx
        const dy = NODE_CONFIG[toI].cy - NODE_CONFIG[fromI].cy
        const L  = Math.sqrt(dx * dx + dy * dy)
        const ux = dx / L, uy = dy / L
        const shipUx = -ux, shipUy = -uy
        const { px, py } = cwPerp(shipUx, shipUy)
        const a = NODE_CONFIG[fromI], b = NODE_CONFIG[toI]
        const n = pipeline.length
        return pipeline.map((units, i) => {
          const arrivesIn    = i + 1
          const delay_periods = n > 1 ? n : 1
          const sentInRound   = round + arrivesIn - delay_periods - 1
          const t  = 1 - (i + 0.5) / (n || 1)
          const x  = a.cx + t * (b.cx - a.cx) - px * PERP
          const y  = a.cy + t * (b.cy - a.cy) - py * PERP
          // Extra info: backorder on the role receiving this order
          let extraInfo: string | undefined
          const receiverKey = NODE_CONFIG[toI].key  // upstream node receiving the order
          const receiverState = byRole[receiverKey]
          if (receiverState && receiverState.backorder > 0) {
            extraInfo = `⚠️ Proveedor con backorder: ${receiverState.backorder} u.`
          }
          return (
            <OrderEnvelope
              key={`ord-${fromI}-${i}`}
              x={x} y={y} units={units}
              ux={ux} uy={uy}
              delay={i * 0.12}
              fromLabel={fromLabel} toLabel={toLabel}
              arrivesIn={arrivesIn} sentInRound={sentInRound}
              extraInfo={extraInfo}
            />
          )
        })
      })}

      {/* ── Nodes ── */}
      {NODE_CONFIG.map((node) => {
        const s          = byRole[node.key]
        const inventory  = s?.inventory  ?? 0
        const backorder  = s?.backorder  ?? 0
        const isExternal = node.key === 'customer' || node.key === 'materiaprima'
        const isCustomer = node.key === 'customer'
        const R          = isExternal ? 24 : 30
        const capsRows   = Math.ceil(Math.min(inventory, 12) / 3)
        const capsY      = node.cy === BOT_Y
          ? node.cy - R - 8  - (capsRows - 1) * 11
          : node.cy + R + 20 + (capsRows - 1) * 11

        return (
          <g key={node.key} style={{ animation: 'nodeIn 0.4s ease both', transformOrigin: `${node.cx}px ${node.cy}px` }}>

            {/* Bottle caps */}
            {!isExternal && inventory > 0 && (
              <BottleCaps x={node.cx} y={capsY} count={inventory} />
            )}

            {/* Node circle */}
            <circle cx={node.cx} cy={node.cy} r={R}
              fill={isExternal ? '#1c1c1c' : '#464545'}
              stroke={backorder > 0 ? '#ef4444' : '#00ACAC'}
              strokeWidth={backorder > 0 ? 2.5 : 1.5}
            />

            {/* Emoji */}
            <text x={node.cx} y={node.cy + 7} textAnchor="middle" fontSize={isExternal ? 16 : 20}>
              {node.emoji}
            </text>

            {/* Label */}
            <text
              x={node.cx}
              y={node.cy === BOT_Y ? node.cy + R + 14 : node.cy - R - 6}
              textAnchor="middle" fill="#DFDEDC" fontSize={9.5} fontWeight="600"
            >
              {node.label}
            </text>

            {/* Inventory count */}
            {!isExternal && (
              <text
                x={node.cx}
                y={node.cy === BOT_Y ? node.cy + R + 25 : node.cy - R - 17}
                textAnchor="middle" fill="#A6A7A2" fontSize={8.5}
              >
                inv: {inventory}
              </text>
            )}

            {/* Backorder badge */}
            {!isExternal && backorder > 0 && (
              <g>
                <circle cx={node.cx + R - 4} cy={node.cy - R + 4} r={10} fill="#ef4444" />
                <text x={node.cx + R - 4} y={node.cy - R + 8}
                  textAnchor="middle" fill="white" fontSize={8} fontWeight="bold">
                  -{backorder}
                </text>
              </g>
            )}

            {/* Customer demand */}
            {isCustomer && (
              <>
                <rect x={node.cx - 21} y={node.cy + R + 5} width={42} height={15} rx={7} fill="#00ACAC" opacity={0.85} />
                <text x={node.cx} y={node.cy + R + 16} textAnchor="middle" fill="white" fontSize={8.5} fontWeight="bold">
                  pide: {demand}
                </text>
              </>
            )}
          </g>
        )
      })}

      {/* ── Legend ── */}
      <g transform="translate(12,316)">
        <rect x={0}   y={1} width={16} height={10} rx={1.5} fill="#3a3939" stroke="#A6A7A2" strokeWidth={0.6} />
        <rect x={16}  y={0} width={9}  height={12} rx={1.5} fill="#2a2a2a" stroke="#A6A7A2" strokeWidth={0.6} />
        <text x={30}  y={9} fill="#555" fontSize={7.5}>camión = envío →</text>

        <rect x={142} y={1} width={18} height={12} rx={1.5} fill="#2e2e2e" stroke="#A6A7A2" strokeWidth={0.6} />
        <polyline points="142,1 151,8 160,1" fill="none" stroke="#A6A7A2" strokeWidth={0.7} />
        <text x={166} y={9} fill="#555" fontSize={7.5}>sobre = ← pedido</text>

        <circle cx={275} cy={6} r={4} fill="#00ACAC" opacity={0.8} />
        <text   x={283} y={9} fill="#555" fontSize={7.5}>tapitas = inventario</text>

        <circle cx={398} cy={6} r={4} fill="#ef4444" />
        <text   x={406} y={9} fill="#555" fontSize={7.5}>rojo = backorder</text>
      </g>
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────
export default function SupplyChainMap({ states, round, totalRounds, demandPattern, navRound, onNavChange }: Props) {
  const [expanded, setExpanded] = useState(false)
  const [animKey,  setAnimKey]  = useState(0)
  const [playing,  setPlaying]  = useState(false)

  const displayRound = navRound ?? round
  const isNavMode    = onNavChange !== undefined

  useEffect(() => { setAnimKey(k => k + 1) }, [displayRound])

  useEffect(() => {
    if (!playing || !onNavChange) return
    const id = setInterval(() => {
      onNavChange(displayRound >= totalRounds ? 0 : displayRound + 1)
    }, 2800)
    return () => clearInterval(id)
  }, [playing, displayRound, totalRounds, onNavChange])

  return (
    <div className="bg-gray-800 rounded-2xl overflow-hidden">
      {/* Toggle header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full flex items-center justify-between px-5 py-3 hover:bg-gray-700 transition"
      >
        <div className="flex items-center gap-2">
          <span className="text-white font-semibold">🗺 Mapa de cadena de suministro</span>
          <span className="text-xs text-gray-400 bg-gray-700 px-2 py-0.5 rounded-full">
            {displayRound === 0 ? 'Estado inicial' : `Ronda ${displayRound} / ${totalRounds}`}
          </span>
        </div>
        <span className="text-gray-400">{expanded ? '▲' : '▼'}</span>
      </button>

      {expanded && (
        <div className="px-4 pb-5 flex flex-col gap-3">

          {/* Nav controls */}
          {isNavMode && (
            <>
              <div className="flex items-center justify-between bg-gray-900 rounded-xl px-4 py-2">
                <button
                  onClick={() => { setPlaying(false); onNavChange(displayRound === 0 ? totalRounds : displayRound - 1) }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition"
                >
                  ◀ Anterior
                </button>

                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setPlaying(p => !p)}
                    className={`px-5 py-1.5 rounded-lg text-sm font-semibold transition ${
                      playing ? 'bg-red-700 hover:bg-red-600 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'
                    }`}
                  >
                    {playing ? '⏹ Pausar' : '▶ Reproducir'}
                  </button>
                  <span className="text-white font-bold tabular-nums text-sm">
                    {displayRound === 0 ? 'Inicio' : `R${displayRound} / ${totalRounds}`}
                  </span>
                </div>

                <button
                  onClick={() => { setPlaying(false); onNavChange(displayRound === totalRounds ? 0 : displayRound + 1) }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition"
                >
                  Siguiente ▶
                </button>
              </div>

              {/* Round dots */}
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: totalRounds + 1 }, (_, i) => i).map(r => (
                  <button
                    key={r}
                    onClick={() => { setPlaying(false); onNavChange(r) }}
                    title={r === 0 ? 'Estado inicial' : `Ronda ${r}`}
                    className={`h-2 flex-1 rounded-full transition ${
                      r === displayRound ? 'bg-blue-500' :
                      r < displayRound   ? 'bg-blue-900' : 'bg-gray-700'
                    }`}
                    style={{ minWidth: 6 }}
                  />
                ))}
              </div>
            </>
          )}

          {/* Map */}
          <div className="overflow-x-auto">
            <MapSVG
              states={states}
              round={displayRound}
              demandPattern={demandPattern}
              animKey={animKey}
            />
          </div>
        </div>
      )}
    </div>
  )
}
