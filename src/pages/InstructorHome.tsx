import { useNavigate } from 'react-router-dom'

export default function InstructorHome() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Panel del instructor</h1>
        <p className="text-gray-400">¿Qué deseas hacer?</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate('/crear')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-5 px-6 rounded-xl text-lg transition flex flex-col items-center gap-1"
        >
          <span className="text-2xl">＋</span>
          <span>Crear nueva sesión</span>
        </button>

        <button
          onClick={() => navigate('/mis-sesiones')}
          className="bg-gray-700 hover:bg-gray-600 text-white font-semibold py-5 px-6 rounded-xl text-lg transition flex flex-col items-center gap-1"
        >
          <span className="text-2xl">📋</span>
          <span>Ver mis sesiones</span>
          <span className="text-gray-400 text-sm font-normal">Retomar, finalizar o ver debrief</span>
        </button>
      </div>

      <button
        onClick={() => navigate('/')}
        className="text-gray-400 hover:text-white text-sm transition"
      >
        ← Volver
      </button>
    </div>
  )
}