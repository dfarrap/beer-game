import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ROLE_LABELS: Record<string, string> = {
  retailer: 'Minorista',
  wholesaler: 'Mayorista',
  distributor: 'Distribuidor',
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
  const playerName = searchParams.get('name') ?? ''

  const [session, setSession] = useState<any>(null)
  const [roundState, setRoundState] = useState<any>(null)
  const [teamStates, setTeamStates] = useState<any[]>([])
  const [orderInput, setOrderInput] = useState('')
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(true)

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
        if (payload.new.status !== 'finished') {
          setSubmitted(false)
          setOrderInput('')
          loadData()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

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

  if (!roundState) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="text-center">
        <p className="text-white text-xl">Preparando ronda...</p>
        <p className="text-gray-400 text-sm mt-2">El instructor está iniciando el juego</p>
      </div>
    </div>
  )

  const pendingRoles = teamStates
    .filter(s => s.round === session?.current_round && s.order_placed === null)
    .map(s => ROLE_LABELS[s.role])

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