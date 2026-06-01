import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  const isActive = (path: string) => location.pathname === path

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#1a1714', color: '#e8e0d4' }}>
      <nav style={{ backgroundColor: '#13110e', borderBottom: '1px solid #2e2a22' }}
           className="sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center gap-2">
              <Link to="/" className="flex items-center gap-2.5 mr-6">
                <span className="text-xl">🎤</span>
                <span className="font-display font-bold text-lg sm:text-xl tracking-tight"
                      style={{ color: '#e8e0d4' }}>
                  Boston <span style={{ color: '#f59e0b' }}>Open Mics</span>
                </span>
              </Link>
              <div className="hidden sm:flex items-center gap-1">
                <Link
                  to="/events"
                  className="px-3 py-2 text-sm font-medium rounded transition-colors"
                  style={{ color: isActive('/events') ? '#f59e0b' : '#9c9080' }}
                  onMouseEnter={e => { if (!isActive('/events')) (e.target as HTMLElement).style.color = '#e8e0d4' }}
                  onMouseLeave={e => { if (!isActive('/events')) (e.target as HTMLElement).style.color = '#9c9080' }}
                >
                  Events
                </Link>
                {user && (
                  <Link
                    to="/chat"
                    className="px-3 py-2 text-sm font-medium rounded transition-colors"
                    style={{ color: isActive('/chat') ? '#f59e0b' : '#9c9080' }}
                    onMouseEnter={e => { if (!isActive('/chat')) (e.target as HTMLElement).style.color = '#e8e0d4' }}
                    onMouseLeave={e => { if (!isActive('/chat')) (e.target as HTMLElement).style.color = '#9c9080' }}
                  >
                    Messages
                  </Link>
                )}
                {user && (
                  <Link
                    to="/availability"
                    className="px-3 py-2 text-sm font-medium rounded transition-colors"
                    style={{ color: isActive('/availability') ? '#f59e0b' : '#9c9080' }}
                    onMouseEnter={e => { if (!isActive('/availability')) (e.target as HTMLElement).style.color = '#e8e0d4' }}
                    onMouseLeave={e => { if (!isActive('/availability')) (e.target as HTMLElement).style.color = '#9c9080' }}
                  >
                    Availability
                  </Link>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="px-3 py-2 text-sm font-medium transition-colors rounded"
                    style={{ color: '#9c9080' }}
                    onMouseEnter={e => (e.target as HTMLElement).style.color = '#e8e0d4'}
                    onMouseLeave={e => (e.target as HTMLElement).style.color = '#9c9080'}
                  >
                    <span className="hidden sm:inline">Dashboard</span>
                    <span className="sm:hidden">📊</span>
                  </Link>
                  {['admin', 'super_admin', 'moderator'].includes(user.role || '') && (
                    <Link to="/admin" className="px-3 py-2 text-sm font-medium text-red-400 hover:text-red-300 transition-colors">
                      <span className="hidden sm:inline">Admin</span>
                      <span className="sm:hidden">🔥</span>
                    </Link>
                  )}
                  <button onClick={handleLogout} className="btn btn-secondary text-xs sm:text-sm px-3 py-2 min-h-0 h-9">
                    <span className="hidden sm:inline">Log out</span>
                    <span className="sm:hidden">↗️</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary text-xs sm:text-sm px-3 py-2 min-h-0 h-9">Log in</Link>
                  <Link to="/register" className="btn btn-primary text-xs sm:text-sm px-3 py-2 min-h-0 h-9">Sign up</Link>
                </>
              )}
            </div>
          </div>

          <div className="sm:hidden py-2 flex gap-1" style={{ borderTop: '1px solid #2e2a22' }}>
            <Link to="/events" className="px-3 py-2 text-sm font-medium rounded transition-colors"
                  style={{ color: '#9c9080' }}>📅 Events</Link>
            {user && (
              <Link to="/chat" className="px-3 py-2 text-sm font-medium rounded transition-colors"
                    style={{ color: '#9c9080' }}>💬 Messages</Link>
            )}
            {user && (
              <Link to="/availability" className="px-3 py-2 text-sm font-medium rounded transition-colors"
                    style={{ color: '#9c9080' }}>📅 Availability</Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:py-8 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}
