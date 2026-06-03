import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'
import { supabase } from '../lib/supabase'
import { DEFAULT_CONFIG } from '../engine/simulator'
import type { GameConfig } from '../types/index'

function generateCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

function NumberInput({
  label,
  hint,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string
  hint?: string
  value: number
  min: number
  max: number
  step?: number
  onChange: (v: number) => void
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-gray-300 text-sm">{label}</label>
      {hint && <p className="text-gray-500 text-xs">{hint}</p>}
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={e => onChange(Math.max(min, Math.min(max, Number(e.target.value))))}
        className="bg-gray-700 text-white rounded-lg px-4 py-2 outline-none focus:ring-2 focus:ring-blue-500 w-full"
      />
    </div>
  )
}

export default function CreateSession() {
  const navigate = useNavigate()
  const [hostName, setHostName] = useState('')
  const [numTeams, setNumTeams] = useState(2)
  const [roundAdvanceMode, setRoundAdvanceMode] = useState<'automatic' | 'manual'>('automatic')
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [config, setConfig] = useState<GameConfig>(DEFAULT_CONFIG)

  function setParam<K extends keyof GameConfig>(key: K, value: GameConfig[K]) {
    setConfig(prev => ({ ...prev, [key]: value }))
  }

  async function handleCreate() {
    if (!hostName.trim()) {
      setError('Ingresa el nombre de la sesión')
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
        config,
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

    const teamsToInsert = Array.from({ length: numTeams }, (_, i) => ({
      session_id: session.id,
      name: `Equipo ${i + 1}`,
    }))

    const { error: teamsError } = await supabase.from('teams').insert(teamsToInsert)

    if (teamsError) {
      setError('Error al crear equipos: ' + teamsError.message)
      setLoading(false)
      return
    }

    navigate(`/lobby/${session.id}`)
  }

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md bg-gray-800 rounded-2xl p-8 flex flex-col gap-5">
        <div className="flex items-center gap-3 mb-1">
          <Logo size="sm" />
          <h1 className="text-2xl font-bold text-white">Nueva sesión</h1>
        </div>

        {/* Nombre sesión */}
        <div className="flex flex-col gap-1">
          <label className="text-gray-300 text-sm">Nombre de la sesión</label>
          <p className="text-gray-500 text-xs">Ej: MBA Bogotá · Logística · Grupo A</p>
          <input
            type="text"
            value={hostName}
            onChange={e => setHostName(e.target.value)}
            placeholder="Ej: MBA Ejecutivo — Operaciones 2026"
            className="bg-gray-700 text-white rounded-lg px-4 py-3 outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        {/* Equipos */}
        <div className="flex flex-col gap-1">
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

        {/* Avance de ronda */}
        <div className="flex flex-col gap-1">
          <label className="text-gray-300 text-sm">Avance de ronda</label>
          <div className="flex gap-3">
            <button
              onClick={() => setRoundAdvanceMode('automatic')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                roundAdvanceMode === 'automatic' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Automático
            </button>
            <button
              onClick={() => setRoundAdvanceMode('manual')}
              className={`flex-1 py-3 rounded-lg font-medium transition ${
                roundAdvanceMode === 'manual' ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
              }`}
            >
              Manual
            </button>
          </div>
        </div>

        {/* Parámetros avanzados */}
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-blue-400 hover:text-blue-300 text-sm text-left transition"
        >
          {showAdvanced ? '▲ Ocultar parámetros del juego' : '▼ Configurar parámetros del juego'}
        </button>

        {showAdvanced && (
          <div className="flex flex-col gap-4 bg-gray-900 rounded-xl p-4">

            <NumberInput
              label="Inventario inicial (unidades)"
              hint="Unidades con las que arranca cada rol"
              value={config.initialInventory}
              min={0}
              max={100}
              onChange={v => setParam('initialInventory', v)}
            />

            <NumberInput
              label="Lead time de pedido (rondas)"
              hint="Rondas que tarda un pedido en llegar al proveedor"
              value={config.orderDelay}
              min={1}
              max={6}
              onChange={v => {
                const newSize = Math.max(v, config.shippingDelay)
                const oldHist = config.historicalDemand ?? []
                const newHist = Array(newSize).fill(0).map((_, i) => oldHist[i] ?? (config.initialDemandInTransit ?? 4))
                setConfig(prev => ({ ...prev, orderDelay: v, historicalDemand: newHist }))
              }}
            />

            <NumberInput
              label="Lead time de envío (rondas)"
              hint="Rondas que tarda la mercancía en llegar"
              value={config.shippingDelay}
              min={1}
              max={6}
              onChange={v => {
                const newSize = Math.max(config.orderDelay, v)
                const oldHist = config.historicalDemand ?? []
                const newHist = Array(newSize).fill(0).map((_, i) => oldHist[i] ?? (config.initialDemandInTransit ?? 4))
                setConfig(prev => ({ ...prev, shippingDelay: v, historicalDemand: newHist }))
              }}
            />

            {/* Demanda histórica pre-juego: una casilla por período (T-1 más reciente) */}
            <div className="flex flex-col gap-2">
              <label className="text-gray-300 text-sm">Demanda histórica pre-juego</label>
              <p className="text-gray-500 text-xs">
                Unidades que se asume circulaban en todos los canales antes de empezar.
                T-1 es el período más reciente (llega primero).
                Se necesitan {Math.max(config.orderDelay, config.shippingDelay)} valores (= lead time máximo).
              </p>
              <div className="grid grid-cols-3 gap-2">
                {(config.historicalDemand ?? []).map((val, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-gray-500 text-xs">T-{i + 1}{i === 0 ? ' (reciente)' : ''}</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={val}
                      onChange={e => {
                        const newHist = [...(config.historicalDemand ?? [])]
                        newHist[i] = Math.max(0, Number(e.target.value))
                        setParam('historicalDemand', newHist)
                      }}
                      className="bg-gray-700 text-white rounded-lg px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                  </div>
                ))}
              </div>
            </div>

            <NumberInput
              label="Número de rondas"
              value={config.totalRounds}
              min={5}
              max={52}
              onChange={v => {
                const newPattern = Array.from({ length: v }, (_, i) =>
                  i < 4 ? 4 : 8
                )
                setConfig(prev => ({ ...prev, totalRounds: v, demandPattern: newPattern }))
              }}
            />

            <NumberInput
              label="Costo de inventario ($ por unidad por ronda)"
              value={config.inventoryCost}
              min={0}
              max={10}
              step={0.1}
              onChange={v => setParam('inventoryCost', v)}
            />

            <NumberInput
              label="Costo de backorder ($ por unidad por ronda)"
              hint="Costo por unidad no entregada a tiempo"
              value={config.backorderCost}
              min={0}
              max={10}
              step={0.1}
              onChange={v => setParam('backorderCost', v)}
            />

            <NumberInput
              label="Tiempo por ronda (segundos)"
              hint="0 = sin límite de tiempo. Los jugadores ven una cuenta regresiva."
              value={config.roundTimeSeconds}
              min={0}
              max={600}
              step={15}
              onChange={v => setParam('roundTimeSeconds', v)}
            />

            <div className="flex flex-col gap-1">
              <label className="text-gray-300 text-sm">Bots para roles vacíos</label>
              <p className="text-gray-500 text-xs">Si un rol no tiene jugador, un bot hace pedidos automáticamente (igual a la demanda recibida)</p>
              <div className="flex gap-3 mt-1">
                <button
                  onClick={() => setParam('botsEnabled', true)}
                  className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                    config.botsEnabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Activar bots
                </button>
                <button
                  onClick={() => setParam('botsEnabled', false)}
                  className={`flex-1 py-2 rounded-lg font-medium text-sm transition ${
                    !config.botsEnabled ? 'bg-blue-600 text-white' : 'bg-gray-700 text-gray-300'
                  }`}
                >
                  Sin bots
                </button>
              </div>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-gray-300 text-sm">Demanda del cliente por ronda</label>
              <p className="text-gray-500 text-xs">Unidades que el cliente final pide en cada ronda</p>
              <div className="grid grid-cols-4 gap-2 max-h-64 overflow-y-auto pr-1">
                {config.demandPattern.map((val, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className="text-gray-500 text-xs">R{i + 1}</span>
                    <input
                      type="number"
                      min={0}
                      max={999}
                      value={val}
                      onChange={e => {
                        const newPattern = [...config.demandPattern]
                        newPattern[i] = Math.max(0, Number(e.target.value))
                        setConfig(prev => ({ ...prev, demandPattern: newPattern }))
                      }}
                      className="bg-gray-700 text-white rounded-lg px-2 py-2 text-center text-sm outline-none focus:ring-2 focus:ring-blue-500 w-full"
                    />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

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
