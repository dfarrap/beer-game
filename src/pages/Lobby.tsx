import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import type { Session, Team, Player } from '../types/index'

export default function Lobby() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<Session | null>(null)
  const [teams, setTeams] = useState<Team[]>([])
  const [players, setPlayers] = useState<Player[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    loadData()

    const channel = supabase
      .channel(`lobby-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${sessionId}`,
      }, () => loadData())
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  async function loadData() {
    const [{ data: sessionData }, { data: teamsData }, { data: playersData }] =
      await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('teams').select('*').eq('session_id', sessionId),
        supabase.from('players').select('*').eq('session_id', sessionId),
      ])

    if (sessionData) setSession(sessionData)
    if (teamsData) setTeams(teamsData)
    if (playersData) setPlayers(playersData)
    setLoading(false)
  }

  async function handleStart() {
    await supabase
      .from('sessions')
      .update({ status: 'running', current_round: 1 })
      .eq('id', sessionId)
    navigate(`/dashboard/${sessionId}`)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  const ROLES = ['retailer', 'wholesaler', 'distributor', 'factory']
  const ROLE_LABELS: Record<string, string> = {
    retailer: 'Minorista',
    wholesaler: 'Mayorista',
    distributor: 'Distribuidor',
    factory: 'Fábrica',
  }

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        {/* Encabezado */}
        <div className="bg-gray-800 rounded-2xl p-6 text-center">
          <p className="text-gray-400 text-sm mb-1">Código de sesión</p>
          <p className="text-5xl font-bold text-white tracking-widest">{session?.code}</p>
          <p className="text-gray-400 text-sm mt-2">Comparte este código con los jugadores</p>
        </div>

        {/* Equipos y roles */}
        <div className="flex flex-col gap-4">
          {teams.map(team => {
            const teamPlayers = players.filter(p => p.team_id === team.id)
            return (
              <div key={team.id} className="bg-gray-800 rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-3">{team.name}</h3>
                <div className="grid grid-cols-2 gap-2">
                  {ROLES.map(role => {
                    const player = teamPlayers.find(p => p.role === role)
                    return (
                      <div key={role} className={`rounded-lg px-3 py-2 flex flex-col ${player ? 'bg-green-800' : 'bg-gray-700'}`}>
                        <span className="text-xs text-gray-400">{ROLE_LABELS[role]}</span>
                        <span className="text-white text-sm font-medium">
                          {player ? player.name : 'Esperando...'}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )
          })}
        </div>

        {/* Botón iniciar */}
        <button
          onClick={handleStart}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 rounded-xl text-lg transition"
        >
          Iniciar juego →
        </button>

        <p className="text-gray-500 text-sm text-center">
          Modo de avance: {session?.round_advance_mode === 'automatic' ? 'Automático' : 'Manual'}
        </p>
      </div>
    </div>
  )
}