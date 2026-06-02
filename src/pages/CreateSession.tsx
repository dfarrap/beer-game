import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { DEFAULT_CONFIG } from '../engine/simulator'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

export default function CreateSession() {
  const navigate = useNavigate()
  const [hostName, setHostName] = useState('')
  const [numTeams, setNumTeams] = useState(2)
  const [roundAdvanceMode, setRoundAdvanceMode] = useState<'automatic' | 'manual'>('automatic')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    if (!hostName.trim()) {
      setError('Ingresa tu nombre')
      return
    }
    setLoading(true)
    setError('')

    const code = generateCode()

    const { data: session, error: sessionError } = await supabase
      .from('sessions')
      .insert({
        code,
        host_id: hostName.trim(),
        status: 'lobby',
        config: DEFAULT_CONFIG,
        current_round: 0,
        round_advance_mode: roundAdvanceMode,
      })
      .select()
      .single()

    if (sessionError) {
      setError('Error al crear la sesión: ' + sessionError.message)
      setLoading(false)
      return
    }

    // Crear equipos
    const teamsToInsert = Array.from({ length: numTeams }, (_, i) => ({
      session_id: session.id,
      name: `Equipo ${i + 1}`,
    }))

    const { error: teamsError } = await supabase
      .from('teams')
      .insert(teamsToInsert)

    if (teamsError) {
      setError('Error al crear equipos: ' + teamsError.message)
      setLoading(false)
      return
    }

    navigate(`/lobby/${session.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 flex flex-col gap-6">
        <h1 className="text-2xl font-bold text-white">Nueva sesión</h1>

        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm">Tu nombre (instructor)</label>
          <input
            type="text"
            value={hostName}
            onChange={e => setHostName(e.target.value)}
            placeholder="Ej: Prof. García"
            className="bg-gray-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm">Número de equipos</label>
          <select
            value={numTeams}
            onChange={e => setNumTeams(Number(e.target.value))}
            className="bg-gray-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          >
            {[1,2,3,4,5,6,7,8].map(n => (
              <option key={n} value={n}>{n} {n === 1 ? 'equipo' : 'equipos'}</option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm">Avance de ronda</label>
          <div className="flex gap-3">
            <button
              onClick={() => setRoundAdvanceMode('automatic')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                roundAdvanceMode === 'automatic'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Automático
            </button>
            <button
              onClick={() => setRoundAdvanceMode('manual')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                roundAdvanceMode === 'manual'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-700 text-gray-300'
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleCreate}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition"
        >
          {loading ? 'Creando...' : 'Crear sesión'}
        </button>

        <button
          onClick={() => navigate('/')}
          className="text-gray-400 hover:text-white text-sm text-center transition"
        >
          ← Volver
        </button>
      </div>
    </div>
  )
}