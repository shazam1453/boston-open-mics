import { Routes, Route } from 'react-router-dom'
import { AuthProvider } from './hooks/useAuth'
import Layout from './components/Layout'
import Home from './pages/Home'
import Events from './pages/Events'
import EventDetail from './pages/EventDetail'
import Login from './pages/Login'
import Register from './pages/Register'
import Profile from './pages/Profile'
import Dashboard from './pages/Dashboard'
import Admin from './pages/Admin'
import ResetPasswordPage from './pages/ResetPasswordPage'
import Chat from './pages/Chat'
import Availability from './pages/Availability'
import UserProfile from './pages/UserProfile'
import PerformerSearch from './pages/PerformerSearch'
import Board from './pages/Board'
import ThreadDetail from './pages/ThreadDetail'
import NewThread from './pages/NewThread'

function App() {
  return (
    <AuthProvider>
      <Layout>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/events" element={<Events />} />
          <Route path="/events/:id" element={<EventDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/reset-password" element={<ResetPasswordPage />} />
          <Route path="/chat" element={<Chat />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/availability" element={<Availability />} />
          <Route path="/users/:slug" element={<UserProfile />} />
          <Route path="/performers" element={<PerformerSearch />} />
          <Route path="/board" element={<Board />} />
          <Route path="/board/new" element={<NewThread />} />
          <Route path="/board/:id" element={<ThreadDetail />} />
        </Routes>
      </Layout>
    </AuthProvider>
  )
}

export default App