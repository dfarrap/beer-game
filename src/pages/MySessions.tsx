import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const STATUS_LABELS: Record<string, string> = {
  lobby: 'Lobby',
  running: 'En juego',
  finished: 'Finalizada',
}

const STATUS_COLORS: Record<string, string> = {
  lobby: 'bg-gray-600 text-gray-300',
  running: 'bg-green-800 text-green-300',
  finished: 'bg-red-900 text-red-300',
}

export default function MySessions() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<any[]>([])
  const [teams, setTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [confirming, setConfirming] = useState<string | null>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    const [{ data: sessionsData }, { data: teamsData }, { data: playersData }] = await Promise.all([
      supabase.from('sessions').select('*').order('created_at', { ascending: false }),
      supabase.from('teams').select('*'),
      supabase.from('players').select('*'),
    ])
    if (sessionsData) setSessions(sessionsData)
    if (teamsData) setTeams(teamsData)
    if (playersData) setPlayers(playersData)
    setLoading(false)
  }

  async function handleDelete(sessionId: string) {
    // Borrar en cascada: round_states → players → teams → session
    const sessionTeamIds = teams.filter(t => t.session_id === sessionId).map(t => t.id)
    if (sessionTeamIds.length > 0) {
      await supabase.from('round_states').delete().in('team_id', sessionTeamIds)
    }
    await supabase.from('players').delete().eq('session_id', sessionId)
    await supabase.from('teams').delete().eq('session_id', sessionId)
    await supabase.from('sessions').delete().eq('id', sessionId)
    setConfirmingDelete(null)
    loadSessions()
  }

  async function handleFinish(sessionId: string) {
    await supabase
      .from('sessions')
      .update({ status: 'finished' })
      .eq('id', sessionId)
    setConfirming(null)
    loadSessions()
  }

  function handleNavigate(session: any) {
    if (session.status === 'lobby') navigate(`/lobby/${session.id}`)
    else if (session.status === 'running') navigate(`/dashboard/${session.id}`)
    else navigate(`/debrief/${session.id}`)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white">Cargando...</p>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-xl mx-auto flex flex-col gap-5">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-white">Mis sesiones</h1>
          <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm transition">
            ← Volver
          </button>
        </div>

        {sessions.length === 0 && (
          <p className="text-gray-500 text-center mt-10">No hay sesiones creadas aún.</p>
        )}

        {sessions.map(session => {
          const sessionTeams = teams.filter(t => t.session_id === session.id)
          const sessionPlayers = players.filter(p => p.session_id === session.id)
          const maxPlayers = sessionTeams.length * 4

          return (
          <div key={session.id} className="bg-gray-800 rounded-2xl p-5 flex flex-col gap-3">

            {/* Encabezado */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-white font-bold text-2xl tracking-widest">{session.code}</span>
                <span className={`text-xs px-2 py-1 rounded-full ${STATUS_COLORS[session.status]}`}>
                  {STATUS_LABELS[session.status]}
                </span>
              </div>
              <span className="text-gray-500 text-xs">
                {new Date(session.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                {' · '}
                {new Date(session.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>

            {/* Nombre sesión */}
            <p className="text-white font-medium">{session.host_id}</p>

            {/* Stats en chips */}
            <div className="flex flex-wrap gap-2">
              <span className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                👥 {sessionPlayers.length} / {maxPlayers} jugadores
              </span>
              <span className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                🏢 {sessionTeams.length} {sessionTeams.length === 1 ? 'equipo' : 'equipos'}
              </span>
              <span className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                🔄 Ronda {session.current_round} / {session.config?.totalRounds}
              </span>
              <span className="bg-gray-700 text-gray-300 text-xs px-3 py-1 rounded-full">
                ⚙️ {session.round_advance_mode === 'automatic' ? 'Automático' : 'Manual'}
              </span>
            </div>

            {/* Botones */}
            <div className="flex gap-2 mt-1">
              <button
                onClick={() => handleNavigate(session)}
                className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2 rounded-lg transition"
              >
                {session.status === 'lobby' ? 'Ir al lobby' :
                 session.status === 'running' ? 'Ir al dashboard' : 'Ver debrief'}
              </button>

              {session.status !== 'finished' && (
                confirming === session.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleFinish(session.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
                    >
                      Confirmar
                    </button>
                    <button
                      onClick={() => setConfirming(null)}
                      className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirming(session.id)}
                    className="bg-red-900 hover:bg-red-800 text-red-300 text-sm font-medium px-3 py-2 rounded-lg transition"
                  >
                    Finalizar
                  </button>
                )
              )}

              {session.status === 'finished' && (
                confirmingDelete === session.id ? (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDelete(session.id)}
                      className="bg-red-600 hover:bg-red-700 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
                    >
                      Eliminar
                    </button>
                    <button
                      onClick={() => setConfirmingDelete(null)}
                      className="bg-gray-600 hover:bg-gray-500 text-white text-sm font-medium px-3 py-2 rounded-lg transition"
                    >
                      Cancelar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setConfirmingDelete(session.id)}
                    className="bg-gray-700 hover:bg-gray-600 text-gray-400 text-sm font-medium px-3 py-2 rounded-lg transition"
                  >
                    🗑 Eliminar
                  </button>
                )
              )}
            </div>
          </div>
        )})}
      </div>
    </div>
  )
}