import { useNavigate } from 'react-router-dom'
import Logo from '../components/Logo'

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-gray-900 flex flex-col items-center justify-center gap-8 p-6">
      <div className="text-center flex flex-col items-center gap-3">
        <img src="/INALDE_Blanco.png" alt="INALDE" className="h-8 w-auto opacity-90" />
        <Logo size="lg" />
        <h1 className="text-4xl font-bold text-white mb-1">Beer Game</h1>
        <p className="text-gray-400">Simulación de cadena de suministro</p>
      </div>

      <div className="flex flex-col gap-4 w-full max-w-xs">
        <button
          onClick={() => navigate('/instructor')}
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-4 px-6 rounded-xl text-lg transition"
        >
          Soy instructor
        </button>
        <button
          onClick={() => navigate('/unirse')}
          className="bg-green-600 hover:bg-green-700 text-white font-semibold py-4 px-6 rounded-xl text-lg transition"
        >
          Soy jugador
        </button>
        <button
          onClick={() => navigate('/reconectar')}
          className="bg-yellow-600 hover:bg-yellow-700 text-white font-semibold py-4 px-6 rounded-xl text-lg transition"
        >
          Reconectarme
        </button>
      </div>
    </div>
  )
}