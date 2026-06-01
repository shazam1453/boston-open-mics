import { Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'

export default function Home() {
  const { user } = useAuth()

  return (
    <div className="space-y-16">
      {/* Hero */}
      <div className="pt-12 pb-16 sm:pt-20 sm:pb-24">
        <div className="max-w-3xl">
          <p className="text-sm font-medium tracking-widest uppercase mb-6"
             style={{ color: '#f59e0b' }}>
            Boston's open mic community
          </p>
          <h1 className="font-display font-bold leading-none mb-8"
              style={{ fontSize: 'clamp(2.8rem, 7vw, 5rem)', color: '#e8e0d4' }}>
            Find your stage.<br />
            <span style={{ color: '#f59e0b' }}>Own the mic.</span>
          </h1>
          <p className="text-lg sm:text-xl mb-10 max-w-xl leading-relaxed"
             style={{ color: '#9c9080' }}>
            Discover open mic nights across Boston, sign up to perform, and connect with your local arts community.
          </p>
          <div className="flex flex-wrap gap-4">
            <Link to="/events" className="btn btn-primary text-base px-7 py-3 min-h-0">
              Browse Events
            </Link>
            {!user && (
              <Link to="/register" className="btn btn-secondary text-base px-7 py-3 min-h-0">
                Join as Performer
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Divider */}
      <div style={{ borderTop: '1px solid #2e2a22' }} />

      {/* Feature cards */}
      <div>
        <h2 className="font-display text-xl font-semibold mb-8" style={{ color: '#9c9080' }}>
          Everything you need to get on stage
        </h2>
        <div className="grid md:grid-cols-3 gap-4">
          <Link to="/events" className="card group cursor-pointer">
            <div className="text-2xl mb-4">📅</div>
            <h3 className="font-display text-lg font-semibold mb-2" style={{ color: '#e8e0d4' }}>
              Find Events
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#9c9080' }}>
              Discover open mics, showcases, and competitions happening around Boston
            </p>
          </Link>

          <Link to={user ? '/events' : '/login'} className="card group cursor-pointer">
            <div className="text-2xl mb-4">📝</div>
            <h3 className="font-display text-lg font-semibold mb-2" style={{ color: '#e8e0d4' }}>
              Sign Up to Perform
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#9c9080' }}>
              Reserve your spot at events and manage your performance schedule
            </p>
          </Link>

          <Link to={user ? '/profile' : '/login'} className="card group cursor-pointer">
            <div className="text-2xl mb-4">🏢</div>
            <h3 className="font-display text-lg font-semibold mb-2" style={{ color: '#e8e0d4' }}>
              Host Events
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: '#9c9080' }}>
              Venue owners can create and manage their own open mic events
            </p>
          </Link>
        </div>
      </div>

      {/* CTA */}
      {!user && (
        <div className="py-12 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6"
             style={{ borderTop: '1px solid #2e2a22' }}>
          <div>
            <h3 className="font-display text-2xl font-bold mb-1" style={{ color: '#e8e0d4' }}>
              Ready to perform?
            </h3>
            <p className="text-sm" style={{ color: '#9c9080' }}>
              Create a free account and get on stage tonight.
            </p>
          </div>
          <Link to="/register" className="btn btn-primary px-8 py-3 min-h-0 whitespace-nowrap">
            Create account
          </Link>
        </div>
      )}
    </div>
  )
}
