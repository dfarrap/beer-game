import { useState } from 'react'
import { isInstructorAuthed, setInstructorAuth } from '../lib/instructorAuth'
import Logo from './Logo'

export default function InstructorPinGate({ children }: { children: React.ReactNode }) {
  const [authed, setAuthed] = useState(isInstructorAuthed)
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')

  if (authed) return <>{children}</>

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (setInstructorAuth(pin)) {
      setAuthed(true)
    } else {
      setError('PIN incorrecto')
      setPin('')
    }
  }

  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center p-6">
      <div className="w-full max-w-xs bg-gray-800 rounded-2xl p-8 flex flex-col gap-5">
        <div className="flex flex-col items-center gap-3">
          <img src="/INALDE_Blanco.png" alt="INALDE" style={{ height: '70px' }} className="w-auto opacity-90" />
          <Logo size="sm" />
          <h1 className="text-xl font-bold text-white">Acceso de instructor</h1>
          <p className="text-gray-400 text-sm text-center">Ingresa el PIN para continuar</p>
        </div>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <input
            type="password"
            value={pin}
            onChange={e => { setPin(e.target.value); setError('') }}
            placeholder="••••••"
            autoFocus
            className="bg-gray-700 text-white text-center text-2xl tracking-widest rounded-xl py-4 outline-none focus:ring-2 focus:ring-blue-500"
          />
          {error && <p className="text-red-400 text-sm text-center">{error}</p>}
          <button
            type="submit"
            disabled={!pin}
            className="bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white font-semibold py-3 rounded-xl transition"
          >
            Ingresar
          </button>
        </form>
      </div>
    </div>
  )
}
