import { useEffect, useState } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

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

export default function WaitingRoom() {
  const { sessionId } = useParams()
  const [searchParams] = useSearchParams()
  const role = searchParams.get('role') ?? ''
  const teamId = searchParams.get('team') ?? ''
  const playerName = searchParams.get('name') ?? ''

  const navigate = useNavigate()
  const [players, setPlayers] = useState<any[]>([])
  const [sessionStatus, setSessionStatus] = useState('lobby')

  useEffect(() => {
    if (!sessionId) return
    loadPlayers()

    const channel = supabase
      .channel(`waiting-${sessionId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'players',
        filter: `session_id=eq.${sessionId}`,
      }, () => loadPlayers())
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'sessions',
        filter: `id=eq.${sessionId}`,
      }, (payload) => {
        if (payload.new.status === 'running') {
          setSessionStatus('running')
          navigate(`/ronda/${sessionId}?role=${role}&team=${teamId}&name=${encodeURIComponent(playerName)}`)
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [sessionId])

  async function loadPlayers() {
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('team_id', teamId)
    if (data) setPlayers(data)
  }

  const ROLES = ['retailer', 'wholesaler', 'distributor', 'factory']

  if (sessionStatus === 'running') return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 gap-6">
      <div className={`w-20 h-20 rounded-full ${ROLE_COLORS[role]} flex items-center justify-center`}>
        <span className="text-3xl">🎮</span>
      </div>
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">¡El juego inició!</h1>
        <p className="text-gray-400 mt-2">Preparando tu turno...</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6 gap-8">

      {/* Tu rol */}
      <div className="text-center flex flex-col items-center gap-3">
        <div className={`px-6 py-3 rounded-full ${ROLE_COLORS[role]}`}>
          <span className="text-white font-bold text-lg">{ROLE_LABELS[role]}</span>
        </div>
        <p className="text-gray-300">Hola, <span className="text-white font-semibold">{playerName}</span></p>
      </div>

      {/* Estado del equipo */}
      <div className="w-full max-w-xs bg-gray-800 rounded-2xl p-5 flex flex-col gap-3">
        <p className="text-gray-400 text-sm text-center mb-1">Tu equipo</p>
        {ROLES.map(r => {
          const player = players.find(p => p.role === r)
          return (
            <div key={r} className="flex items-center justify-between">
              <span className="text-gray-400 text-sm">{ROLE_LABELS[r]}</span>
              <span className={`text-sm font-medium ${player ? 'text-green-400' : 'text-gray-600'}`}>
                {player ? player.name : 'Esperando...'}
              </span>
            </div>
          )
        })}
      </div>

      {/* Esperando */}
      <div className="text-center">
        <div className="flex gap-1 justify-center mb-3">
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'0ms'}}/>
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'150ms'}}/>
          <span className="w-2 h-2 bg-blue-400 rounded-full animate-bounce" style={{animationDelay:'300ms'}}/>
        </div>
        <p className="text-gray-400 text-sm">Esperando que el instructor inicie el juego</p>
      </div>
    </div>
  )
}