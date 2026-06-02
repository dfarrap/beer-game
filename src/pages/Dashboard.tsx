import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { advanceRound } from '../engine/simulator'
import type { Role } from '../types/index'

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
  const [allStates, setAllStates] = useState<any[]>([])
  const [advancing, setAdvancing] = useState(false)

  useEffect(() => {
    if (!sessionId) return
    loadData()

    const channel = supabase
      .channel(`dashboard-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'round_states',
      }, () => loadData())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        setSession(payload.new)
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  useEffect(() => {
    if (!session || !teams.length || advancing) return
    if (session.round_advance_mode !== 'automatic') return
    if (session.status !== 'running') return

    const allReady = teams.every(t => {
      const states = allStates.filter(
        s => s.team_id === t.id && s.round === session.current_round
      )
      return states.length === 4 && states.every(s => s.order_placed !== null)
    })

    if (allReady) handleAdvanceRound()
  }, [allStates, session, teams])

  async function loadData() {
    const [{ data: sessionData }, { data: teamsData }, { data: statesData }] =
      await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('teams').select('*').eq('session_id', sessionId),
        supabase.from('round_states').select('*'),
      ])

    if (sessionData) setSession(sessionData)
    if (teamsData) setTeams(teamsData)
    if (statesData) setAllStates(statesData)
  }

  async function handleAdvanceRound() {
    if (!session) return
    setAdvancing(true)

    const nextRound = session.current_round + 1
    const config = session.config

    for (const team of teams) {
      const currentStates = allStates.filter(
        s => s.team_id === team.id && s.round === session.current_round
      )

      const orders: Record<Role, number> = {
        retailer: currentStates.find(s => s.role === 'retailer')?.order_placed ?? 0,
        wholesaler: currentStates.find(s => s.role === 'wholesaler')?.order_placed ?? 0,
        distributor: currentStates.find(s => s.role === 'distributor')?.order_placed ?? 0,
        factory: currentStates.find(s => s.role === 'factory')?.order_placed ?? 0,
      }

      const nextStates = advanceRound(currentStates, orders, nextRound, config)

      await supabase.from('round_states').insert(
        nextStates.map(s => ({ ...s, round: nextRound, order_placed: null }))
      )
    }

    if (nextRound > config.totalRounds) {
      await supabase.from('sessions').update({ status: 'finished' }).eq('id', sessionId)
    } else {
      await supabase.from('sessions').update({ current_round: nextRound }).eq('id', sessionId)
    }

    setAdvancing(false)
  }

  const currentRound = session?.current_round ?? 1

  function getTeamProgress(teamId: string) {
    const states = allStates.filter(s => s.team_id === teamId && s.round === currentRound)
    const confirmed = states.filter(s => s.order_placed !== null).length
    return { confirmed, total: 4, states }
  }

  function canAdvance(teamId: string) {
    const { confirmed } = getTeamProgress(teamId)
    return confirmed === 4
  }

  const allTeamsReady = teams.length > 0 && teams.every(t => canAdvance(t.id))

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
            </p>
          </div>
          <div className="bg-gray-800 rounded-xl px-4 py-2 text-center">
            <p className="text-gray-400 text-xs">Código</p>
            <p className="text-white font-bold text-xl tracking-widest">{session?.code}</p>
          </div>
        </div>

        {/* Tarjetas por equipo */}
        {teams.map(team => {
          const { confirmed, states } = getTeamProgress(team.id)
          const ready = confirmed === 4
          const totalCost = states.reduce((sum, s) => sum + (s.cumulative_cost ?? 0), 0)

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
                  return (
                    <div key={role} className={`rounded-lg p-2 text-center ${done ? 'bg-green-800' : 'bg-gray-700'}`}>
                      <p className="text-xs text-gray-400">{ROLE_LABELS[role]}</p>
                      <p className="text-white text-sm font-bold mt-1">
                        {done ? `${state.order_placed}u` : '...'}
                      </p>
                      <p className="text-xs text-gray-500">inv: {state?.inventory ?? '-'}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )
        })}

        {session?.status === 'finished' ? (
          <button
            onClick={() => navigate(`/debrief/${sessionId}`)}
            className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 rounded-xl text-lg transition"
          >
            Ver debrief →
          </button>
        ) : (session?.round_advance_mode === 'manual' || allTeamsReady) ? (
          <button
            onClick={handleAdvanceRound}
            disabled={advancing || !allTeamsReady}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition"
          >
            {advancing ? 'Avanzando...' : allTeamsReady ? `Avanzar a ronda ${currentRound + 1} →` : 'Esperando que todos confirmen...'}
          </button>
        ) : null}

      </div>
    </div>
  )
}