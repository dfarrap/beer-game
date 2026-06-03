import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateSession from './pages/CreateSession'
import Lobby from './pages/Lobby'
import Join from './pages/Join'
import WaitingRoom from './pages/WaitingRoom'
import GameRound from './pages/GameRound'
import Dashboard from './pages/Dashboard'
import Debrief from './pages/Debrief'
import Reconnect from './pages/Reconnect'
import MySessions from './pages/MySessions'
import InstructorHome from './pages/InstructorHome'
import InstructorPinGate from './components/InstructorPinGate'

function Instructor({ children }: { children: React.ReactNode }) {
  return <InstructorPinGate>{children}</InstructorPinGate>
}

function App() {
  return (
    <Routes>
      {/* Rutas públicas (jugadores) */}
      <Route path="/"                   element={<Home />} />
      <Route path="/unirse"             element={<Join />} />
      <Route path="/espera/:sessionId"  element={<WaitingRoom />} />
      <Route path="/ronda/:sessionId"   element={<GameRound />} />
      <Route path="/reconectar"         element={<Reconnect />} />

      {/* Rutas protegidas (instructor) */}
      <Route path="/instructor"         element={<Instructor><InstructorHome /></Instructor>} />
      <Route path="/crear"              element={<Instructor><CreateSession /></Instructor>} />
      <Route path="/lobby/:sessionId"   element={<Instructor><Lobby /></Instructor>} />
      <Route path="/dashboard/:sessionId" element={<Instructor><Dashboard /></Instructor>} />
      <Route path="/debrief/:sessionId" element={<Instructor><Debrief /></Instructor>} />
      <Route path="/mis-sesiones"       element={<Instructor><MySessions /></Instructor>} />
    </Routes>
  )
}

export default App
