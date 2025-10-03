import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

interface LayoutProps {
  children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = () => {
    logout()
    navigate('/')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link to="/" className="text-lg sm:text-xl font-bold text-primary-600 truncate">
                Boston Open Mics
              </Link>
              <div className="hidden sm:ml-10 sm:flex sm:space-x-8">
                <Link
                  to="/events"
                  className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium"
                >
                  Events
                </Link>
                {user && (
                  <Link
                    to="/chat"
                    className="text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium"
                  >
                    Messages
                  </Link>
                )}
              </div>
            </div>
            
            <div className="flex items-center space-x-2 sm:space-x-4">
              {user ? (
                <>
                  <Link
                    to="/profile"
                    className="text-gray-700 hover:text-primary-600 px-2 sm:px-3 py-2 text-sm font-medium"
                  >
                    <span className="hidden sm:inline">Dashboard</span>
                    <span className="sm:hidden">📊</span>
                  </Link>
                  {['admin', 'super_admin', 'moderator'].includes(user.role || '') && (
                    <Link
                      to="/admin"
                      className="text-red-600 hover:text-red-700 px-2 sm:px-3 py-2 text-sm font-medium"
                    >
                      <span className="hidden sm:inline">🔥 Admin</span>
                      <span className="sm:hidden">🔥</span>
                    </Link>
                  )}
                  <button
                    onClick={handleLogout}
                    className="btn btn-secondary text-xs sm:text-sm px-2 sm:px-4"
                  >
                    <span className="hidden sm:inline">Logout</span>
                    <span className="sm:hidden">↗️</span>
                  </button>
                </>
              ) : (
                <>
                  <Link to="/login" className="btn btn-secondary text-xs sm:text-sm px-2 sm:px-4">
                    Login
                  </Link>
                  <Link to="/register" className="btn btn-primary text-xs sm:text-sm px-2 sm:px-4">
                    Sign Up
                  </Link>
                </>
              )}
            </div>
          </div>
          
          {/* Mobile Navigation */}
          <div className="sm:hidden border-t border-gray-200 py-2">
            <Link
              to="/events"
              className="block text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium"
            >
              📅 Events
            </Link>
            {user && (
              <Link
                to="/chat"
                className="block text-gray-700 hover:text-primary-600 px-3 py-2 text-sm font-medium"
              >
                💬 Messages
              </Link>
            )}
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-4 sm:py-6 px-4 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  )
}