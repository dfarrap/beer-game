import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'

const ROLES = ['retailer', 'wholesaler', 'distributor', 'factory'] as const
const ROLE_LABELS: Record<string, string> = {
  retailer: 'Minorista',
  wholesaler: 'Mayorista',
  distributor: 'Distribuidor',
  factory: 'Fábrica',
}

export default function Join() {
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [step, setStep] = useState<'code' | 'assign'>('code')
  const [session, setSession] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [players, setPlayers] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState('')
  const [selectedRole, setSelectedRole] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleFindSession() {
    if (!code.trim() || !name.trim()) {
      setError('Ingresa el código y tu nombre')
      return
    }
    setLoading(true)
    setError('')

    const { data: sessionData, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('code', code.trim().toUpperCase())
      .eq('status', 'lobby')
      .single()

    if (sessionError || !sessionData) {
      setError('Código inválido o la sesión ya inició')
      setLoading(false)
      return
    }

    const [{ data: teamsData }, { data: playersData }] = await Promise.all([
      supabase.from('teams').select('*').eq('session_id', sessionData.id),
      supabase.from('players').select('*').eq('session_id', sessionData.id),
    ])

    setSession(sessionData)
    setTeams(teamsData ?? [])
    setPlayers(playersData ?? [])
    setStep('assign')
    setLoading(false)
  }

  function isRoleTaken(teamId: string, role: string) {
    return players.some(p => p.team_id === teamId && p.role === role)
  }

  async function handleJoin() {
    if (!selectedTeam || !selectedRole) {
      setError('Selecciona equipo y rol')
      return
    }
    setLoading(true)
    setError('')

    const { error: insertError } = await supabase
      .from('players')
      .insert({
        team_id: selectedTeam,
        session_id: session.id,
        name: name.trim(),
        role: selectedRole,
        connected: true,
      })

    if (insertError) {
      setError('Error al unirse: ' + insertError.message)
      setLoading(false)
      return
    }

    navigate(`/espera/${session.id}?role=${selectedRole}&team=${selectedTeam}&name=${encodeURIComponent(name)}`)
  }

  if (step === 'code') return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-sm bg-gray-800 rounded-2xl p-8 flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-white">Unirse al juego</h1>

        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm">Tu nombre</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="Ej: Juan"
            className="bg-gray-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500"
          />
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-gray-300 text-sm">Código de sesión</label>
          <input
            type="text"
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="Ej: KKJDIE"
            maxLength={6}
            className="bg-gray-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-green-500 text-center text-2xl tracking-widest font-bold uppercase"
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleFindSession}
          disabled={loading}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition"
        >
          {loading ? 'Buscando...' : 'Continuar →'}
        </button>

        <button onClick={() => navigate('/')} className="text-gray-400 hover:text-white text-sm text-center transition">
          ← Volver
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-sm mx-auto flex flex-col gap-5">
        <h1 className="text-2xl font-bold text-white">Elige tu rol</h1>
        <p className="text-gray-400 text-sm">Hola <span className="text-white font-medium">{name}</span>, selecciona equipo y rol:</p>

        {teams.map(team => (
          <div key={team.id} className="bg-gray-800 rounded-2xl p-4 flex flex-col gap-3">
            <h3 className="text-white font-semibold">{team.name}</h3>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map(role => {
                const taken = isRoleTaken(team.id, role)
                const selected = selectedTeam === team.id && selectedRole === role
                return (
                  <button
                    key={role}
                    disabled={taken}
                    onClick={() => { setSelectedTeam(team.id); setSelectedRole(role) }}
                    className={`rounded-lg px-3 py-3 text-sm font-medium transition ${
                      taken ? 'bg-gray-700 text-gray-500 cursor-not-allowed' :
                      selected ? 'bg-green-600 text-white' :
                      'bg-gray-700 text-white hover:bg-gray-600'
                    }`}
                  >
                    {ROLE_LABELS[role]}
                    {taken && <span className="block text-xs text-gray-500">Ocupado</span>}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          onClick={handleJoin}
          disabled={loading || !selectedTeam || !selectedRole}
          className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white font-semibold py-4 rounded-xl text-lg transition"
        >
          {loading ? 'Uniéndose...' : 'Unirme al juego'}
        </button>
      </div>
    </div>
  )
}