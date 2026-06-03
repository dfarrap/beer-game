import { useEffect, useState, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { advanceRound } from '../engine/simulator'
import type { Role } from '../types/index'
import { QRCodeSVG } from 'qrcode.react'

const ROLE_LABELS: Record<string, string> = {
  retailer: 'Minorista',
  wholesaler: 'Mayorista',
  distributor: 'Distribuidor',
  factory: 'Fábrica',
}

const ROLES: Role[] = ['retailer', 'wholesaler', 'distributor', 'factory']

export default function Dashboard() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [allStates, setAllStates] = useState<any[]>([])
  const [advancing, setAdvancing] = useState(false)
  const [showQR, setShowQR] = useState(false)
  const [timeLeft, setTimeLeft] = useState<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const roundStartRef = useRef<number>(Date.now())
  const advancingRef = useRef(false)

  useEffect(() => {
    if (!sessionId) return
    loadData()

    const channel = supabase
      .channel(`dashboard-${sessionId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'round_states' }, () => loadData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `session_id=eq.${sessionId}` }, () => loadData())
      .on('postgres_changes', {
        event: 'UPDATE', schema: 'public', table: 'sessions', filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession(payload.new)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  // Timer countdown
  useEffect(() => {
    if (!session || session.status !== 'running') return
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
        // Tiempo agotado: auto-submit bots para pendientes y avanzar
        if (!advancingRef.current) handleTimerExpired()
      } else {
        setTimeLeft(remaining)
      }
    }, 1000)

    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [session?.current_round, session?.status])

  // Auto-advance cuando todos listo (modo automático)
  useEffect(() => {
    if (!session || !teams.length || advancingRef.current) return
    if (session.round_advance_mode !== 'automatic') return
    if (session.status !== 'running') return

    const allReady = teams.every(t => {
      const states = allStates.filter(s => s.team_id === t.id && s.round === session.current_round)
      return states.length === 4 && states.every(s => s.order_placed !== null)
    })

    if (allReady) handleAdvanceRound()
  }, [allStates, session, teams])

  async function loadData() {
    const [{ data: sessionData }, { data: teamsData }, { data: playersData }, { data: statesData }] =
      await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('teams').select('*').eq('session_id', sessionId),
        supabase.from('players').select('*').eq('session_id', sessionId),
        supabase.from('round_states').select('*'),
      ])

    if (sessionData) setSession(sessionData)
    if (teamsData) setTeams(teamsData)
    if (playersData) setPlayers(playersData)
    if (statesData) setAllStates(statesData)
  }

  // Cuando se acaba el tiempo: rellenar pendientes con bot y avanzar
  async function handleTimerExpired() {
    if (!session || advancingRef.current) return
    advancingRef.current = true

    const currentRound = session.current_round
    // Para cada equipo, submit bot en roles sin order_placed
    // Recargar players frescos para no usar datos desactualizados
    const { data: freshPlayers } = await supabase.from('players').select('*').eq('session_id', sessionId)
    const currentPlayers = freshPlayers ?? players

    for (const team of teams) {
      const states = allStates.filter(s => s.team_id === team.id && s.round === currentRound)
      const teamPlayers = currentPlayers.filter((p: any) => p.team_id === team.id)
      for (const state of states) {
        if (state.order_placed === null) {
          const hasPlayer = teamPlayers.some((p: any) => p.role === state.role)
          // Solo bot si no hay jugador, o si hay jugador pero no envió (timer expirado)
          const botOrder = hasPlayer ? (state.incoming_order ?? 0) : (state.incoming_order ?? 0)
          await supabase.from('round_states').update({ order_placed: botOrder }).eq('id', state.id)
        }
      }
    }
    // Recargar y avanzar
    await loadData()
    await handleAdvanceRound()
    advancingRef.current = false
  }

  async function handleAdvanceRound() {
    if (!session) return
    advancingRef.current = true
    setAdvancing(true)

    // Recargar datos frescos antes de avanzar
    const [{ data: freshStates }, { data: freshPlayers }] = await Promise.all([
      supabase.from('round_states').select('*'),
      supabase.from('players').select('*').eq('session_id', sessionId),
    ])
    const currentStatesAll = freshStates ?? allStates
    const currentPlayers = freshPlayers ?? players

    const nextRound = session.current_round + 1
    const config = session.config

    if (nextRound > config.totalRounds) {
      await supabase.from('sessions').update({ status: 'finished' }).eq('id', sessionId)
      setAdvancing(false)
      advancingRef.current = false
      return
    }

    for (const team of teams) {
      const currentStates = currentStatesAll.filter(
        s => s.team_id === team.id && s.round === session.current_round
      )

      // Si bots están activos, rellenar roles sin jugador
      const botsEnabled = config.botsEnabled ?? false
      const teamPlayers = currentPlayers.filter((p: any) => p.team_id === team.id)

      const orders: Record<Role, number> = {} as Record<Role, number>
      for (const role of ROLES) {
        const state = currentStates.find(s => s.role === role)
        const hasPlayer = teamPlayers.some(p => p.role === role)
        if (state?.order_placed !== null && state?.order_placed !== undefined) {
          orders[role] = state.order_placed
        } else if (botsEnabled || !hasPlayer) {
          orders[role] = state?.incoming_order ?? 0
        } else {
          orders[role] = 0
        }
      }

      const nextStates = advanceRound(currentStates as any, orders, nextRound, config)
      const { data: insertedStates } = await supabase.from('round_states').insert(
        nextStates.map(s => ({ ...s, round: nextRound, order_placed: null }))
      ).select()

      // Auto-submit bots para roles sin jugador en la nueva ronda
      if (insertedStates) {
        for (const newState of insertedStates) {
          const hasPlayer = teamPlayers.some((p: any) => p.role === newState.role)
          if (!hasPlayer && newState.order_placed === null) {
            const botOrder = newState.incoming_order ?? 0
            await supabase.from('round_states').update({ order_placed: botOrder }).eq('id', newState.id)
          }
        }
      }
    }

    await supabase.from('sessions').update({ current_round: nextRound }).eq('id', sessionId)
    setAdvancing(false)
    advancingRef.current = false
  }

  const currentRound = session?.current_round ?? 1

  function getTeamProgress(teamId: string) {
    const states = allStates.filter(s => s.team_id === teamId && s.round === currentRound)
    const confirmed = states.filter(s => s.order_placed !== null).length
    return { confirmed, total: 4, states }
  }

  const allTeamsReady = teams.length > 0 && teams.every(t => {
    const { confirmed } = getTeamProgress(t.id)
    return confirmed === 4
  })

  const timerColor = timeLeft !== null
    ? timeLeft <= 10 ? 'text-red-400' : timeLeft <= 30 ? 'text-yellow-400' : 'text-green-400'
    : ''

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-3xl mx-auto flex flex-col gap-6">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard instructor</h1>
            <p className="text-gray-400 text-sm">
              Ronda {currentRound} / {session?.config?.totalRounds} —
              Modo: {session?.round_advance_mode === 'automatic' ? 'Automático' : 'Manual'}
              {session?.config?.botsEnabled && ' · 🤖 Bots activos'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {timeLeft !== null && session?.status === 'running' && (
              <div className="bg-gray-800 rounded-xl px-4 py-2 text-center">
                <p className="text-gray-400 text-xs">Tiempo</p>
                <p className={`font-bold text-2xl tabular-nums ${timerColor}`}>
                  {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
                </p>
              </div>
            )}
            <button
              onClick={() => setShowQR(true)}
              className="bg-gray-800 hover:bg-gray-700 rounded-xl px-4 py-2 text-center transition"
            >
              <p className="text-gray-400 text-xs">Código</p>
              <p className="text-white font-bold text-xl tracking-widest">{session?.code}</p>
              <p className="text-blue-400 text-xs mt-1">Ver QR</p>
            </button>
          </div>
        </div>

        {/* Modal QR */}
        {showQR && (
          <div className="fixed inset-0 bg-black bg-opacity-70 flex items-center justify-center z-50 p-6" onClick={() => setShowQR(false)}>
            <div className="bg-gray-800 rounded-2xl p-8 flex flex-col items-center gap-4 max-w-xs w-full" onClick={e => e.stopPropagation()}>
              <p className="text-white font-bold text-lg">Únete a la sesión</p>
              <p className="text-gray-400 text-sm text-center">Escanea el QR o ingresa el código en:</p>
              <p className="text-blue-400 text-sm font-medium">beergame.inalde.cloud/unirse</p>
              <div className="bg-white p-3 rounded-xl">
                <QRCodeSVG value={`https://beergame.inalde.cloud/unirse?code=${session?.code}`} size={200} />
              </div>
              <p className="text-5xl font-bold text-white tracking-widest">{session?.code}</p>
              <button onClick={() => setShowQR(false)} className="bg-gray-700 hover:bg-gray-600 text-white text-sm font-medium px-6 py-2 rounded-lg transition w-full">
                Cerrar
              </button>
            </div>
          </div>
        )}

        {/* Tarjetas por equipo */}
        {teams.map(team => {
          const { confirmed, states } = getTeamProgress(team.id)
          const ready = confirmed === 4
          const totalCost = states.reduce((sum, s) => sum + (s.cumulative_cost ?? 0), 0)
          const teamPlayers = players.filter(p => p.team_id === team.id)

          return (
            <div key={team.id} className={`bg-gray-800 rounded-2xl p-5 border-2 ${ready ? 'border-green-600' : 'border-gray-700'}`}>
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-white font-semibold text-lg">{team.name}</h3>
                <div className="flex items-center gap-3">
                  <span className="text-yellow-400 text-sm font-medium">${totalCost.toFixed(2)}</span>
                  <span className={`text-sm px-2 py-1 rounded-lg ${ready ? 'bg-green-800 text-green-300' : 'bg-gray-700 text-gray-400'}`}>
                    {confirmed}/4 confirmaron
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-4 gap-2">
                {ROLES.map(role => {
                  const state = states.find(s => s.role === role)
                  const done = state?.order_placed !== null && state?.order_placed !== undefined
                  const player = teamPlayers.find(p => p.role === role)
                  return (
                    <div key={role} className={`rounded-lg p-2 text-center ${done ? 'bg-green-800' : 'bg-gray-700'}`}>
                      <p className="text-xs text-gray-400">{ROLE_LABELS[role]}</p>
                      <p className="text-white text-sm font-bold mt-1">
                        {done ? `${state.order_placed}u` : '...'}
                      </p>
                      <p className="text-xs text-gray-500">inv: {state?.inventory ?? '-'}</p>
                      {!player && (
                        <p className="text-xs text-orange-400 mt-1">🤖 bot</p>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {session?.status === 'finished' ? (
          <button onClick={() => navigate(`/debrief/${sessionId}`)} className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl text-lg transition">
            Ver debrief →
          </button>
        ) : (session?.round_advance_mode === 'manual' || allTeamsReady) ? (
          <button
            onClick={handleAdvanceRound}
            disabled={advancing || !allTeamsReady}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition"
          >
            {advancing ? 'Procesando...' : allTeamsReady
              ? currentRound >= (session?.config?.totalRounds ?? 0)
                ? '🏁 Finalizar juego'
                : `Avanzar a ronda ${currentRound + 1} →`
              : 'Esperando que todos confirmen...'}
          </button>
        ) : null}

        <button onClick={() => navigate('/instructor')} className="text-gray-400 hover:text-white text-sm text-center transition">
          ← Volver al panel
        </button>

      </div>
    </div>
  )
}
