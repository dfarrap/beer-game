import { useEffect, useState } from 'react'

interface NodeState {
  role: string
  inventory: number
  backorder: number
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

// Layout — left to right: Materia Prima → Fábrica → Mayorista → Distribuidor → Minorista → Cliente
const NODE_CONFIG = [
  { key: 'materiaprima', label: 'Materia Prima', emoji: '🌾', cx: 75  },
  { key: 'factory',      label: 'Fábrica',        emoji: '🏭', cx: 230 },
  { key: 'distributor',  label: 'Mayorista',       emoji: '📦', cx: 390 },
  { key: 'wholesaler',   label: 'Distribuidor',    emoji: '🏪', cx: 550 },
  { key: 'retailer',    label: 'Minorista',       emoji: '🏬', cx: 710 },
  { key: 'customer',    label: 'Cliente',         emoji: '👥', cx: 870 },
]

const CY       = 155   // node center y
const SHIP_Y   = CY + 32   // shipment truck road level
const ORDER_Y  = CY + 60   // order arrow level

// ── Bottle caps ──────────────────────────────────────────────────
function BottleCaps({ x, y, count }: { x: number; y: number; count: number }) {
  const max = 15
  const show = Math.min(count, max)
  const cols = 3

  return (
    <g>
      {Array.from({ length: show }).map((_, i) => {
        const col = i % cols
        const row = Math.floor(i / cols)
        const cx = x - ((cols - 1) * 12) / 2 + col * 12
        const cy = y - row * 12
        return (
          <g key={i}>
            <circle cx={cx} cy={cy} r={5.5} fill="#00ACAC" opacity={0.92} />
            <circle cx={cx - 1.5} cy={cy - 1.5} r={2} fill="white" opacity={0.28} />
          </g>
        )
      })}
      {count > max && (
        <text x={x} y={y - Math.floor((max - 1) / cols) * 12 - 16}
          textAnchor="middle" fill="#00ACAC" fontSize={10} fontWeight="bold">
          +{count - max}
        </text>
      )}
    </g>
  )
}

// ── Shipment truck (going RIGHT →) ───────────────────────────────
function ShipTruck({ x, y, units, idx }: { x: number; y: number; units: number; idx: number }) {
  const label = units
  return (
    <g style={{ animation: `truckRight 0.6s cubic-bezier(.34,1.56,.64,1) ${idx * 0.12}s both` }}>
      {/* body */}
      <rect x={x - 22} y={y - 11} width={29} height={16} rx={3} fill="#3a3939" stroke="#A6A7A2" strokeWidth={0.8} />
      {/* cab */}
      <rect x={x + 7}  y={y - 14} width={15} height={19} rx={3} fill="#2a2a2a" stroke="#A6A7A2" strokeWidth={0.8} />
      {/* windshield */}
      <rect x={x + 9}  y={y - 12} width={9}  height={7}  rx={1} fill="#00ACAC" opacity={0.55} />
      {/* wheels */}
      <circle cx={x - 11} cy={y + 7} r={5} fill="#1a1a1a" stroke="#666" strokeWidth={0.8} />
      <circle cx={x - 11} cy={y + 7} r={2} fill="#555" />
      <circle cx={x + 14} cy={y + 7} r={5} fill="#1a1a1a" stroke="#666" strokeWidth={0.8} />
      <circle cx={x + 14} cy={y + 7} r={2} fill="#555" />
      {/* unit badge */}
      <circle cx={x - 5} cy={y - 20} r={10} fill="#00ACAC" />
      <text x={x - 5} y={y - 16} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">{label}</text>
    </g>
  )
}

// ── Order mini-truck (going LEFT ←) ──────────────────────────────
function OrderTruck({ x, y, units, idx }: { x: number; y: number; units: number; idx: number }) {
  return (
    <g style={{ animation: `truckLeft 0.6s cubic-bezier(.34,1.56,.64,1) ${idx * 0.12}s both` }}>
      {/* body (mirrored) */}
      <rect x={x - 7}  y={y - 8} width={22} height={12} rx={2} fill="#2e2e2e" stroke="#666" strokeWidth={0.8} />
      {/* cab on left side */}
      <rect x={x - 18} y={y - 10} width={12} height={14} rx={2} fill="#222" stroke="#666" strokeWidth={0.8} />
      {/* windshield */}
      <rect x={x - 17} y={y - 9}  width={8}  height={5}  rx={1} fill="#A6A7A2" opacity={0.45} />
      {/* wheels */}
      <circle cx={x + 8}  cy={y + 6} r={4} fill="#1a1a1a" stroke="#555" strokeWidth={0.7} />
      <circle cx={x - 12} cy={y + 6} r={4} fill="#1a1a1a" stroke="#555" strokeWidth={0.7} />
      {/* badge */}
      <circle cx={x + 8} cy={y - 13} r={8} fill="#464545" stroke="#A6A7A2" strokeWidth={0.8} />
      <text x={x + 8} y={y - 10} textAnchor="middle" fill="#DFDEDC" fontSize={8} fontWeight="bold">{units}</text>
    </g>
  )
}

// ── Core SVG map ─────────────────────────────────────────────────
function MapSVG({ states, round, demandPattern, animKey }: {
  states: NodeState[]
  round: number
  demandPattern: number[]
  animKey: number
}) {
  const byRole = Object.fromEntries(states.map(s => [s.role, s]))
  const demand = demandPattern[round - 1] ?? 0

  // Shipments in transit (→ right): index 0 = closest to DESTINATION (arrives soonest)
  // factory.shipment_pipeline = raw materials coming FROM Materia Prima TO Fábrica
  const shipSegments = [
    { pipeline: byRole['factory']?.shipment_pipeline     ?? [], from: 0, to: 1 },
    { pipeline: byRole['distributor']?.shipment_pipeline ?? [], from: 1, to: 2 },
    { pipeline: byRole['wholesaler']?.shipment_pipeline  ?? [], from: 2, to: 3 },
    { pipeline: byRole['retailer']?.shipment_pipeline   ?? [], from: 3, to: 4 },
    { pipeline: [byRole['retailer']?.order_placed ?? 0],        from: 4, to: 5 },
  ]

  // Orders in transit (← left): index 0 = closest to UPSTREAM supplier (arrives soonest)
  // factory.order_pipeline = raw material orders that factory sent upstream to Materia Prima
  const orderSegments = [
    { pipeline: byRole['factory']?.order_pipeline    ?? [], to: 0, from: 1 },
    { pipeline: byRole['distributor']?.order_pipeline ?? [], to: 1, from: 2 },
    { pipeline: byRole['wholesaler']?.order_pipeline  ?? [], to: 2, from: 3 },
    { pipeline: byRole['retailer']?.order_pipeline   ?? [], to: 3, from: 4 },
    { pipeline: [demand],                                    to: 4, from: 5 },
  ]

  return (
    <svg key={animKey} viewBox="0 0 960 290" width="100%" style={{ minWidth: 640 }}>
      <defs>
        <style>{`
          @keyframes truckRight {
            from { opacity:0; transform:translateX(18px); }
            to   { opacity:1; transform:translateX(0); }
          }
          @keyframes truckLeft {
            from { opacity:0; transform:translateX(-14px); }
            to   { opacity:1; transform:translateX(0); }
          }
          @keyframes nodeIn {
            from { opacity:0; transform:scale(0.85); }
            to   { opacity:1; transform:scale(1); }
          }
        `}</style>
        <marker id="arrL" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
          <path d="M6,0 L0,3 L6,6 Z" fill="#666" />
        </marker>
      </defs>

      {/* ── Road ── */}
      <rect x={73} y={SHIP_Y - 7} width={799} height={15} rx={4} fill="#222" />
      <line x1={73} y1={SHIP_Y} x2={872} y2={SHIP_Y}
        stroke="#3a3939" strokeWidth={1} strokeDasharray="14,8" />

      {/* ── Shipment trucks (→) ── */}
      {shipSegments.map((seg) => {
        const x1 = NODE_CONFIG[seg.from].cx
        const x2 = NODE_CONFIG[seg.to].cx
        const n  = seg.pipeline.length || 1
        return seg.pipeline.map((units, i) => {
          // i=0 closest to destination (x2), i=n-1 closest to origin (x1)
          const t  = 1 - (i + 0.5) / n          // 0=origin side, 1=dest side
          const tx = x1 + (x2 - x1) * t
          return <ShipTruck key={`sh-${seg.from}-${i}`} x={tx} y={SHIP_Y - 1} units={units} idx={i} />
        })
      })}

      {/* ── Order trucks (←) ── */}
      {orderSegments.map((seg) => {
        const xFrom = NODE_CONFIG[seg.from].cx   // downstream (right)
        const xTo   = NODE_CONFIG[seg.to].cx     // upstream   (left)
        const n     = seg.pipeline.length || 1
        return seg.pipeline.map((units, i) => {
          // i=0 closest to upstream dest (xTo), i=n-1 closest to downstream origin (xFrom)
          const t  = 1 - (i + 0.5) / n
          const tx = xFrom + (xTo - xFrom) * t
          return <OrderTruck key={`ord-${seg.from}-${i}`} x={tx} y={ORDER_Y} units={units} idx={i} />
        })
      })}

      {/* Order road line */}
      <line x1={73} y1={ORDER_Y + 6} x2={872} y2={ORDER_Y + 6}
        stroke="#333" strokeWidth={1} strokeDasharray="5,6" />

      {/* ── Direction labels ── */}
      <text x={73} y={SHIP_Y - 10} fill="#A6A7A2" fontSize={8}>→ envíos</text>
      <text x={73} y={ORDER_Y - 4} fill="#666" fontSize={8}>← pedidos</text>

      {/* ── Nodes ── */}
      {NODE_CONFIG.map((node) => {
        const s            = byRole[node.key]
        const inventory    = s?.inventory  ?? 0
        const backorder    = s?.backorder  ?? 0
        const isCustomer   = node.key === 'customer'
        const isSupplier   = node.key === 'materiaprima'
        const isExternal   = isCustomer || isSupplier
        const capsRows     = Math.ceil(Math.min(inventory, 15) / 3)

        return (
          <g key={node.key} style={{ animation: 'nodeIn 0.4s ease both', transformOrigin: `${node.cx}px ${CY}px` }}>
            {/* Inventory caps */}
            {!isExternal && inventory > 0 && (
              <BottleCaps x={node.cx} y={CY - 44 - (capsRows - 1) * 4} count={inventory} />
            )}

            {/* Node circle */}
            <circle cx={node.cx} cy={CY} r={isExternal ? 25 : 31}
              fill={isExternal ? '#1a1a1a' : '#464545'}
              stroke={backorder > 0 ? '#ef4444' : '#00ACAC'}
              strokeWidth={backorder > 0 ? 2.5 : 1.5}
            />

            {/* Emoji */}
            <text x={node.cx} y={CY + 7} textAnchor="middle" fontSize={isExternal ? 17 : 21}>
              {node.emoji}
            </text>

            {/* Label */}
            <text x={node.cx} y={CY + 44} textAnchor="middle" fill="#DFDEDC" fontSize={9.5} fontWeight="600">
              {node.label}
            </text>

            {/* Inventory count */}
            {!isExternal && (
              <text x={node.cx} y={CY + 55} textAnchor="middle" fill="#A6A7A2" fontSize={8.5}>
                inv: {inventory}
              </text>
            )}

            {/* Backorder badge */}
            {!isExternal && backorder > 0 && (
              <g>
                <circle cx={node.cx + 26} cy={CY - 26} r={11} fill="#ef4444" />
                <text x={node.cx + 26} y={CY - 22} textAnchor="middle" fill="white" fontSize={9} fontWeight="bold">
                  -{backorder}
                </text>
              </g>
            )}

            {/* Customer demand */}
            {isCustomer && (
              <>
                <rect x={node.cx - 22} y={CY + 30} width={44} height={14} rx={3} fill="#00ACAC" opacity={0.8} />
                <text x={node.cx} y={CY + 40} textAnchor="middle" fill="white" fontSize={8.5} fontWeight="bold">
                  pide: {demand}
                </text>
              </>
            )}
          </g>
        )
      })}

      {/* ── Legend ── */}
      <g transform="translate(16,274)">
        <circle cx={4} cy={4} r={4} fill="#00ACAC" />
        <text x={12} y={8} fill="#666" fontSize={7.5}>tapitas = inventario</text>

        <circle cx={120} cy={4} r={4} fill="#ef4444" />
        <text x={128} y={8} fill="#666" fontSize={7.5}>rojo = backorder</text>

        <rect x={225} y={1} width={13} height={7} rx={1} fill="#3a3939" stroke="#666" strokeWidth={0.5} />
        <text x={242} y={8} fill="#666" fontSize={7.5}>camión grande = envío</text>

        <rect x={370} y={1} width={10} height={7} rx={1} fill="#2e2e2e" stroke="#555" strokeWidth={0.5} />
        <text x={384} y={8} fill="#666" fontSize={7.5}>camión peq. = pedido</text>

        <text x={495} y={8} fill="#666" fontSize={7.5}>más cerca al destino = llega antes</text>
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
      onNavChange(displayRound >= totalRounds ? 1 : displayRound + 1)
    }, 1800)
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
            Ronda {displayRound} / {totalRounds}
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
                  onClick={() => { setPlaying(false); onNavChange(displayRound === 1 ? totalRounds : displayRound - 1) }}
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
                    R{displayRound} / {totalRounds}
                  </span>
                </div>

                <button
                  onClick={() => { setPlaying(false); onNavChange(displayRound === totalRounds ? 1 : displayRound + 1) }}
                  className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-1.5 rounded-lg text-sm transition"
                >
                  Siguiente ▶
                </button>
              </div>

              {/* Round dots */}
              <div className="flex gap-1 flex-wrap">
                {Array.from({ length: totalRounds }, (_, i) => i + 1).map(r => (
                  <button
                    key={r}
                    onClick={() => { setPlaying(false); onNavChange(r) }}
                    title={`Ronda ${r}`}
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
