import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from 'recharts'
import Logo from '../components/Logo'
import SupplyChainMap from '../components/SupplyChainMap'

const ROLES = ['retailer', 'wholesaler', 'distributor', 'factory'] as const
const ROLE_LABELS: Record<string, string> = {
  retailer: 'Minorista',
  wholesaler: 'Distribuidor',
  distributor: 'Mayorista',
  factory: 'Fábrica',
}
const ROLE_COLORS: Record<string, string> = {
  retailer: '#3b82f6',
  wholesaler: '#a855f7',
  distributor: '#f97316',
  factory: '#ef4444',
}

export default function Debrief() {
  const { sessionId } = useParams()
  const navigate = useNavigate()
  const [session, setSession] = useState<any>(null)
  const [teams, setTeams] = useState<any[]>([])
  const [allStates, setAllStates] = useState<any[]>([])
  const [selectedTeam, setSelectedTeam] = useState<string>('')
  const [mapRound, setMapRound] = useState(1)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!sessionId) return
    loadData()
  }, [sessionId])

  async function loadData() {
    const [{ data: sessionData }, { data: teamsData }, { data: statesData }] =
      await Promise.all([
        supabase.from('sessions').select('*').eq('id', sessionId).single(),
        supabase.from('teams').select('*').eq('session_id', sessionId),
        supabase.from('round_states').select('*'),
      ])

    if (sessionData) setSession(sessionData)
    if (teamsData) {
      setTeams(teamsData)
      setSelectedTeam(teamsData[0]?.id ?? '')
    }
    if (sessionData) setMapRound(0)
    if (statesData) setAllStates(statesData)
    setLoading(false)
  }

  function getTeamStates(teamId: string) {
    return allStates.filter(s => s.team_id === teamId)
  }

  function buildChartData(teamId: string, field: string) {
    const states = getTeamStates(teamId)
    const rounds = [...new Set(states.map(s => s.round))].sort((a, b) => a - b)
    return rounds.map(round => {
      const row: any = { round: `R${round}` }
      ROLES.forEach(role => {
        const s = states.find(s => s.role === role && s.round === round)
        row[role] = s?.[field] ?? 0
      })
      return row
    })
  }

  function exportCSV() {
    const headers = ['equipo','rol','ronda','inventario','backorder','recibido','pedido_recibido','despachado','pedido_colocado','costo_ronda','costo_acumulado']
    const rows = allStates
      .filter(s => s.round <= (session?.config?.totalRounds ?? 999))
      .sort((a, b) => {
        const ta = teams.find(t => t.id === a.team_id)?.name ?? ''
        const tb = teams.find(t => t.id === b.team_id)?.name ?? ''
        return ta.localeCompare(tb) || a.round - b.round || a.role.localeCompare(b.role)
      })
      .map(s => {
        const teamName = teams.find(t => t.id === s.team_id)?.name ?? s.team_id
        return [
          teamName, s.role, s.round, s.inventory, s.backorder,
          s.incoming_shipment, s.incoming_order, s.shipped,
          s.order_placed ?? '', s.cost_this_round?.toFixed(2) ?? '', s.cumulative_cost?.toFixed(2) ?? ''
        ].join(',')
      })

    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `beergame-${session?.code ?? 'sesion'}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  function getTeamTotalCost(teamId: string) {
    const states = getTeamStates(teamId)
    const lastRound = Math.max(...states.map(s => s.round))
    return states
      .filter(s => s.round === lastRound)
      .reduce((sum, s) => sum + (s.cumulative_cost ?? 0), 0)
  }

  if (loading) return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <p className="text-white">Cargando debrief...</p>
    </div>
  )

  const ordersData = buildChartData(selectedTeam, 'order_placed')
  const inventoryData = buildChartData(selectedTeam, 'inventory')
  const backorderData = buildChartData(selectedTeam, 'backorder')
  const costData = buildChartData(selectedTeam, 'cumulative_cost')

  const ranking = [...teams]
    .map(t => ({ ...t, cost: getTeamTotalCost(t.id) }))
    .sort((a, b) => a.cost - b.cost)

  return (
    <div className="min-h-screen bg-gray-900 p-6">
      <div className="max-w-4xl mx-auto flex flex-col gap-8">

        {/* Encabezado */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo size="sm" />
            <div>
              <h1 className="text-3xl font-bold text-white">Debrief</h1>
              <p className="text-gray-400">Sesión {session?.code}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={exportCSV}
              className="bg-green-700 hover:bg-green-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition"
            >
              ⬇ Exportar CSV
            </button>
            <button
              onClick={() => navigate(`/dashboard/${sessionId}`)}
              className="text-gray-400 hover:text-white text-sm transition"
            >
              ← Dashboard
            </button>
          </div>
        </div>

        {/* Ranking */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-lg mb-4">Ranking por costo total</h2>
          <div className="flex flex-col gap-2">
            {ranking.map((team, i) => (
              <div key={team.id} className="flex items-center justify-between bg-gray-700 rounded-xl px-4 py-3">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${i === 0 ? 'text-yellow-400' : 'text-gray-400'}`}>
                    #{i + 1}
                  </span>
                  <span className="text-white font-medium">{team.name}</span>
                </div>
                <span className="text-yellow-400 font-bold">${team.cost.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Selector de equipo */}
        {teams.length > 1 && (
          <div className="flex gap-2">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => setSelectedTeam(team.id)}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  selectedTeam === team.id ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                }`}
              >
                {team.name}
              </button>
            ))}
          </div>
        )}

        {/* Mapa animado de la cadena */}
        <SupplyChainMap
          states={allStates.filter(s => s.team_id === selectedTeam && s.round === mapRound)}
          round={mapRound}
          totalRounds={session?.config?.totalRounds ?? 1}
          demandPattern={session?.config?.demandPattern ?? []}
          navRound={mapRound}
          onNavChange={setMapRound}
        />

        {/* Gráfica efecto látigo (pedidos) */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-lg mb-1">Efecto látigo — Pedidos colocados</h2>
          <p className="text-gray-400 text-sm mb-4">La amplitud crece del Minorista a la Fábrica</p>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={ordersData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="round" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend formatter={v => ROLE_LABELS[v]} />
              {ROLES.map(role => (
                <Line key={role} type="monotone" dataKey={role} stroke={ROLE_COLORS[role]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Inventario */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-lg mb-4">Inventario por ronda</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={inventoryData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="round" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend formatter={v => ROLE_LABELS[v]} />
              {ROLES.map(role => (
                <Line key={role} type="monotone" dataKey={role} stroke={ROLE_COLORS[role]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Backorder */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-lg mb-4">Backorder por ronda</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={backorderData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="round" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend formatter={v => ROLE_LABELS[v]} />
              {ROLES.map(role => (
                <Line key={role} type="monotone" dataKey={role} stroke={ROLE_COLORS[role]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Costo acumulado */}
        <div className="bg-gray-800 rounded-2xl p-5">
          <h2 className="text-white font-semibold text-lg mb-4">Costo acumulado por rol</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={costData}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="round" stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" tick={{ fontSize: 11 }} />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: 8 }} />
              <Legend formatter={v => ROLE_LABELS[v]} />
              {ROLES.map(role => (
                <Line key={role} type="monotone" dataKey={role} stroke={ROLE_COLORS[role]} strokeWidth={2} dot={false} />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        <div className="flex justify-center pt-2 pb-6">
          <img src="/INALDE_Blanco.png" alt="INALDE" style={{ height: '70px' }} className="w-auto opacity-90" />
        </div>

      </div>
    </div>
  )
}