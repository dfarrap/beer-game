import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import Logo from '../components/Logo'

const ROLE_LABELS: Record<string, string> = {
  retailer: 'Minorista',
  wholesaler: 'Distribuidor',
  distributor: 'Mayorista',
  factory: 'Fábrica',
}

const ROLE_COLORS: Record<string, string> = {
  retailer: 'bg-blue-600',
  wholesaler: 'bg-purple-600',
  distributor: 'bg-orange-600',
  factory: 'bg-red-600',
}

export default function GameRound() {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') ?? ''
  const teamId = searchParams.get('team') ?? ''

  const [session, setSession] = useState<any>(null)
  const [roundState, setRoundState] = useState<any>(null)
  const [teamStates, setTeamStates] = useState<any[]>([])
  const [orderInput, setOrderInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundStartRef = useRef<number>(Date.now())

  useEffect(() => {
    if (!sessionId) return
    loadData()

    const channel = supabase
      .channel(`game-${sessionId}-${teamId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round_states',
        filter: `team_id=eq.${teamId}`,
      }, () => loadData())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession(payload.new)
        if (payload.new.status === 'finished') {
          loadData()
        } else {
          setSubmitted(false)
          setOrderInput('')
          loadData()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  // Timer countdown
  useEffect(() => {
    if (!session || session.status !== 'running' || submitted) return
    const secs = session.config?.roundTimeSeconds ?? 0
    if (secs <= 0) { setTimeLeft(null); return }

    if (timerRef.current) clearInterval(timerRef.current)
    roundStartRef.current = Date.now()
    setTimeLeft(secs)

    timerRef.current = setInterval(() => {
      const elapsed = Math.floor((Date.now() - roundStartRef.current) / 1000)
      const remaining = secs - elapsed
      if (remaining <= 0) {
        setTimeLeft(0)
        clearInterval(timerRef.current!)
        // Auto-submit con el valor actual (o 0 si vacío)
        if (!submitted) {
          const val = parseInt(orderInput) >= 0 ? parseInt(orderInput) : 0
          autoSubmit(isNaN(val) ? 0 : val)
        }
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [session?.current_round, session?.status, submitted])

  async function autoSubmit(order: number) {
    if (!roundState) return
    await supabase.from('round_states').update({ order_placed: order }).eq('id', roundState.id)
    setSubmitted(true)
  }

  async function loadData() {
    const [{ data: sessionData }, { data: statesData }] = await Promise.all([
      supabase.from('sessions').select('*').eq('id', sessionId).single(),
      supabase.from('round_states').select('*').eq('team_id', teamId),
    ])

    if (sessionData) setSession(sessionData)
    if (statesData) {
      setTeamStates(statesData)
      const myState = statesData.find(
        s => s.role === role && s.round === sessionData?.current_round
      )
      setRoundState(myState ?? null)
      if (myState?.order_placed !== null && myState?.order_placed !== undefined) {
        setSubmitted(true)
      }
    }
    setLoading(false)
  }

  async function handleSubmitOrder() {
    const order = parseInt(orderInput)
    if (isNaN(order) || order < 0) return

    await supabase
      .from('round_states')
      .update({ order_placed: order })
      .eq('id', roundState.id)

    setSubmitted(true)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  // Pantalla final del jugador
  if (session?.status === 'finished') {
    const totalRounds = session?.config?.totalRounds ?? 0

    // Deduplicar por ronda: si hay duplicados quedarse con el que tiene order_placed
    const myStatesRaw = teamStates.filter(s => s.role === role && s.round <= totalRounds)
    const myStatesMap = new Map<number, any>()
    for (const s of myStatesRaw) {
      const existing = myStatesMap.get(s.round)
      if (!existing || (s.order_placed !== null && existing.order_placed === null)) {
        myStatesMap.set(s.round, s)
      }
    }
    const myStates = Array.from(myStatesMap.values())

    const lastState = myStates.sort((a, b) => b.round - a.round)[0]
    const totalCost = lastState?.cumulative_cost ?? 0
    const avgInventory = myStates.length > 0
      ? (myStates.reduce((sum, s) => sum + s.inventory, 0) / myStates.length).toFixed(1)
      : 0
    const totalBackorder = myStates.reduce((sum, s) => sum + s.backorder, 0)

    // Costo del equipo: usar solo rondas <= totalRounds, último estado por rol
    const validTeamStates = teamStates.filter(s => s.round <= totalRounds)
    const teamLastByRole = new Map<string, any>()
    for (const s of validTeamStates) {
      const key = `${s.team_id}-${s.role}`
      const existing = teamLastByRole.get(key)
      if (!existing || s.round > existing.round) teamLastByRole.set(key, s)
    }
    const teamTotalCost = Array.from(teamLastByRole.values()).reduce((sum, s) => sum + s.cumulative_cost, 0)

    return (
      <div className="min-h-screen bg-gray-900 p-6 flex flex-col items-center justify-center gap-6">
        <div className="text-center flex flex-col items-center gap-2">
          <Logo size="md" />
          <div className="text-4xl">🏁</div>
          <h1 className="text-3xl font-bold text-white">¡Juego terminado!</h1>
          <p className="text-gray-400 mt-1">{ROLE_LABELS[role]} — {totalRounds} rondas</p>
        </div>

        {/* Tu desempeño */}
        <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-5 flex flex-col gap-4">
          <h2 className="text-white font-semibold text-lg">Tu desempeño</h2>

          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-700 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Costo total</p>
              <p className="text-yellow-400 text-2xl font-bold">${totalCost.toFixed(2)}</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Inventario promedio</p>
              <p className="text-blue-400 text-2xl font-bold">{avgInventory}</p>
              <p className="text-gray-500 text-xs">u/ronda</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Backorder total</p>
              <p className={`text-2xl font-bold ${totalBackorder > 0 ? 'text-red-400' : 'text-green-400'}`}>
                {totalBackorder}
              </p>
              <p className="text-gray-500 text-xs">unidades</p>
            </div>
            <div className="bg-gray-700 rounded-xl p-3 text-center">
              <p className="text-gray-400 text-xs mb-1">Costo del equipo</p>
              <p className="text-purple-400 text-2xl font-bold">${teamTotalCost.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Historial de pedidos */}
        <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-5 flex flex-col gap-3">
          <h2 className="text-white font-semibold">Tus pedidos por ronda</h2>
          <div className="flex flex-wrap gap-2">
            {myStates.sort((a, b) => a.round - b.round).filter(s => s.order_placed !== null).map(s => (
              <div key={s.round} className="bg-gray-700 rounded-lg px-3 py-2 text-center min-w-12">
                <p className="text-gray-500 text-xs">R{s.round}</p>
                <p className="text-white font-bold">{s.order_placed}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-gray-500 text-sm text-center">
          El instructor mostrará el debrief completo con las gráficas del equipo.
        </p>
        <img src="/INALDE_Blanco.png" alt="INALDE" className="h-10 w-auto opacity-70" />
      </div>
    )
  }

  if (!roundState) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-white text-xl">Preparando ronda...</p>
        <p className="text-gray-400 text-sm mt-2">El instructor está iniciando el juego</p>
      </div>
    </div>
  )

  // Deduplicate: a role is only "pending" if it has NO confirmed entry for this round
  const currentRoundStates = teamStates.filter(s => s.round === session?.current_round)
  const confirmedRoles = new Set(
    currentRoundStates.filter(s => s.order_placed !== null && s.order_placed !== undefined).map(s => s.role)
  )
  const pendingRoles = currentRoundStates
    .filter(s => s.order_placed === null && !confirmedRoles.has(s.role))
    .map(s => ROLE_LABELS[s.role])
    .filter((v, i, arr) => arr.indexOf(v) === i)  // unique labels

  return (
    <div className="min-h-screen bg-gray-900 p-4 flex flex-col gap-4 max-w-sm mx-auto">

      {/* Encabezado */}
      <div className="flex items-center justify-between pt-2">
        <div className={`px-3 py-1 rounded-full ${ROLE_COLORS[role]}`}>
          <span className="text-white text-sm font-semibold">{ROLE_LABELS[role]}</span>
        </div>
        <span className="text-gray-400 text-sm">Ronda {session?.current_round} / {session?.config?.totalRounds}</span>
      </div>

      {/* Tarjetas de estado */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Recibiste</p>
          <p className="text-white text-3xl font-bold">{roundState.incoming_shipment}</p>
          <p className="text-gray-500 text-xs">unidades</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Inventario</p>
          <p className="text-white text-3xl font-bold">{roundState.inventory}</p>
          <p className="text-gray-500 text-xs">unidades</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Te pidieron</p>
          <p className="text-white text-3xl font-bold">{roundState.incoming_order}</p>
          <p className="text-gray-500 text-xs">unidades</p>
        </div>
        <div className="bg-gray-800 rounded-xl p-4">
          <p className="text-gray-400 text-xs mb-1">Despachaste</p>
          <p className="text-white text-3xl font-bold">{roundState.shipped}</p>
          <p className="text-gray-500 text-xs">unidades</p>
        </div>
      </div>

      {/* Backorder */}
      {roundState.backorder > 0 && (
        <div className="bg-red-900 border border-red-700 rounded-xl p-4 flex items-center justify-between">
          <span className="text-red-300 text-sm">Pedidos pendientes</span>
          <span className="text-red-200 font-bold text-xl">{roundState.backorder}</span>
        </div>
      )}

      {/* Costo */}
      <div className="bg-gray-800 rounded-xl p-4 flex items-center justify-between">
        <span className="text-gray-400 text-sm">Costo acumulado</span>
        <span className="text-yellow-400 font-bold">${roundState.cumulative_cost.toFixed(2)}</span>
      </div>

      {/* Timer */}
      {timeLeft !== null && !submitted && (
        <div className={`rounded-xl p-3 flex items-center justify-between ${
          timeLeft <= 10 ? 'bg-red-900 border border-red-700' :
          timeLeft <= 30 ? 'bg-yellow-900 border border-yellow-700' :
          'bg-gray-800'
        }`}>
          <span className="text-gray-300 text-sm">⏱ Tiempo restante</span>
          <span className={`font-bold text-xl tabular-nums ${
            timeLeft <= 10 ? 'text-red-300' : timeLeft <= 30 ? 'text-yellow-300' : 'text-white'
          }`}>
            {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
          </span>
        </div>
      )}

      {/* Input de pedido */}
      {!submitted ? (
        <div className="bg-gray-800 rounded-2xl p-5 flex flex-col gap-4">
          <p className="text-white font-semibold text-center">¿Cuánto vas a pedir?</p>
          <input
            type="number"
            min="0"
            value={orderInput}
            onChange={e => setOrderInput(e.target.value)}
            placeholder="0"
            className="bg-gray-700 text-white text-center text-4xl font-bold rounded-xl py-4 outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={handleSubmitOrder}
            disabled={orderInput === ''}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition"
          >
            Confirmar pedido
          </button>
        </div>
      ) : (
        <div className="bg-gray-800 rounded-2xl p-5 flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-2xl">✓</span>
          </div>
          <p className="text-white font-semibold">Pedido confirmado: {roundState.order_placed} u.</p>
          {pendingRoles.length > 0 ? (
            <p className="text-gray-400 text-sm text-center">
              Esperando a: {pendingRoles.join(', ')}
            </p>
          ) : (
            <p className="text-green-400 text-sm">¡Todos confirmaron! Avanzando ronda...</p>
          )}
        </div>
      )}
    </div>
  )
}