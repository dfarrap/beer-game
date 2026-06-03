import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Reconnect() {
  const navigate = useNavigate()
  const [sessions, setSessions] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [selectedSession, setSelectedSession] = useState('')
  const [selectedPlayer, setSelectedPlayer] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    loadSessions()
  }, [])

  async function loadSessions() {
    const { data } = await supabase
      .from('sessions')
      .select('*')
      .in('status', ['lobby', 'running'])
      .order('created_at', { ascending: false })
    if (data) setSessions(data)
  }

  async function handleSessionSelect(sessionId: string) {
    setSelectedSession(sessionId)
    setSelectedPlayer('')
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('session_id', sessionId)
    if (data) setPlayers(data)
  }

  async function handleReconnect() {
    if (!selectedSession || !selectedPlayer) {
      setError('Selecciona sesión y nombre')
      return
    }
    setLoading(true)
    setError('')

    const player = players.find(p => p.id === selectedPlayer)
    const session = sessions.find(s => s.id === selectedSession)

    await supabase
      .from('players')
      .update({ connected: true })
      .eq('id', player.id)

    if (session.status === 'lobby') {
      navigate(`/espera/${session.id}?role=${player.role}&team=${player.team_id}&name=${encodeURIComponent(player.name)}`)
    } else if (session.status === 'running') {
      navigate(`/ronda/${session.id}?role=${player.role}&team=${player.team_id}&name=${encodeURIComponent(player.name)}`)
    } else {
      navigate(`/debrief/${session.id}`)
    }
  }

  const ROLE_LABELS: Record<string, string> = {
    retailer: 'Minorista',
    wholesaler: 'Distribuidor',
    distributor: 'Mayorista',
    factory: 'Fábrica',
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-8 flex flex-col gap-5">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-white">Reconectarse</h1>
          <p className="text-gray-400 text-sm mt-1">Selecciona tu sesión y nombre</p>
        </div>

        {/* Selector de sesión */}
        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm">Sesión activa</label>
          {sessions.length === 0 ? (
            <p className="text-gray-500 text-sm">No hay sesiones activas</p>
          ) : (
            <div className="flex flex-col gap-2">
              {sessions.map(s => (
                <button
                  key={s.id}
                  onClick={() => handleSessionSelect(s.id)}
                  className={`rounded-xl px-4 py-3 text-left transition ${
                    selectedSession === s.id ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-bold tracking-widest">{s.code}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full ${
                      s.status === 'running' ? 'bg-green-800 text-green-300' : 'bg-gray-600 text-gray-400'
                    }`}>
                      {s.status === 'running' ? 'En juego' : 'Lobby'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-400 mt-1">
                    {new Date(s.created_at).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                    {' · '}
                    {new Date(s.created_at).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Selector de jugador */}
        {selectedSession && players.length > 0 && (
          <div className="flex flex-col gap-2">
            <label className="text-gray-300 text-sm">Tu nombre</label>
            <div className="flex flex-col gap-2">
              {players.map(p => (
                <button
                  key={p.id}
                  onClick={() => setSelectedPlayer(p.id)}
                  className={`rounded-xl px-4 py-3 text-left transition ${
                    selectedPlayer === p.id ? 'bg-yellow-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
                  }`}
                >
                  <span className="font-medium">{p.name}</span>
                  <span className="ml-2 text-xs text-gray-400">{ROLE_LABELS[p.role]}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleReconnect}
          disabled={loading || !selectedSession || !selectedPlayer}
          className="bg-yellow-600 hover:bg-yellow-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition"
        >
          {loading ? 'Reconectando...' : 'Reconectarme →'}
        </button>

        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm text-center transition">
          ← Volver
        </button>
      </div>
    </div>
  )
}