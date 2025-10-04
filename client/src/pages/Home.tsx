import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="text-center">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-4xl font-bold text-gray-900 mb-6">
          Discover Boston's Open Mic Scene
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Find open mic nights, sign up to perform, and connect with the local arts community
        </p>
        
        <div className="flex justify-center space-x-4 mb-12">
          <Link to="/events" className="btn btn-primary text-lg px-8 py-3">
            Browse Events
          </Link>
          {!user && (
            <Link to="/register" className="btn btn-secondary text-lg px-8 py-3">
              Join as Performer
            </Link>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <Link to="/events" className="card text-center hover:shadow-lg transition-shadow cursor-pointer">
            <div className="text-3xl mb-4">🎤</div>
            <h3 className="text-lg font-semibold mb-2">Find Events</h3>
            <p className="text-gray-600">
              Discover open mics, showcases, and competitions happening around Boston
            </p>
          </Link>
          
          <Link 
            to={user ? "/events" : "/login"} 
            className="card text-center hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-3xl mb-4">📝</div>
            <h3 className="text-lg font-semibold mb-2">Sign Up to Perform</h3>
            <p className="text-gray-600">
              Reserve your spot at events and manage your performance schedule
            </p>
          </Link>
          
          <Link 
            to={user ? "/profile" : "/login"} 
            className="card text-center hover:shadow-lg transition-shadow cursor-pointer"
          >
            <div className="text-3xl mb-4">🏢</div>
            <h3 className="text-lg font-semibold mb-2">Host Events</h3>
            <p className="text-gray-600">
              Venue owners can create and manage their own open mic events
            </p>
          </Link>
        </div>
      </div>
    </div>
  )
}