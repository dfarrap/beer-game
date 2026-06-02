import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateSession from './pages/CreateSession'
import Lobby from './pages/Lobby'
import Join from './pages/Join'
import WaitingRoom from './pages/WaitingRoom'
import GameRound from './pages/GameRound'
import Dashboard from './pages/Dashboard'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/crear" element={<CreateSession />} />
      <Route path="/lobby/:sessionId" element={<Lobby />} />
      <Route path="/unirse" element={<Join />} />
      <Route path="/espera/:sessionId" element={<WaitingRoom />} />
      <Route path="/ronda/:sessionId" element={<GameRound />} />
      <Route path="/dashboard/:sessionId" element={<Dashboard />} />
    </Routes>
  )
}

export default App