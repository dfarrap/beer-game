import { Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import CreateSession from './pages/CreateSession'
import Lobby from './pages/Lobby'
import Join from './pages/Join'
import WaitingRoom from './pages/WaitingRoom'

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/crear" element={<CreateSession />} />
      <Route path="/lobby/:sessionId" element={<Lobby />} />
      <Route path="/unirse" element={<Join />} />
      <Route path="/espera/:sessionId" element={<WaitingRoom />} />
    </Routes>
  )
}

export default App