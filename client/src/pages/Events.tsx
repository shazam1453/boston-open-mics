import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { eventsAPI, signupsAPI } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { formatTime12Hour, formatTimeOnly12Hour } from '../utils/dateTime'
import { PERFORMANCE_TYPES } from '../constants/formOptions'
import type { Event, Signup } from '../types'

export default function Events() {
  const { user, loading: authLoading } = useAuth()
  const [events, setEvents] = useState<Event[]>([])
  const [userSignups, setUserSignups] = useState<Signup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'all' | 'hosting' | 'performances'>('all')
  const [showSignupForm, setShowSignupForm] = useState<string | number | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [signupForm, setSignupForm] = useState({
    performerName: '',
    performanceType: 'music',
    notes: ''
  })

  const filterOldEvents = (events: Event[]) => {
    const now = new Date()
    const twelveHoursAgo = new Date(now.getTime() - 12 * 60 * 60 * 1000)
    
    return events.filter(event => {
      const eventEndDateTime = new Date(`${event.date}T${event.end_time}`)
      return eventEndDateTime > twelveHoursAgo
    })
  }

  const filterRecurringEvents = (events: Event[]) => {
    const now = new Date()
    const recurringGroups = new Map<string | number, Event[]>()
    const oneTimeEvents: Event[] = []
    
    // Group events by recurring template ID
    events.forEach(event => {
      if (event.recurring_template_id) {
        if (!recurringGroups.has(event.recurring_template_id)) {
          recurringGroups.set(event.recurring_template_id, [])
        }
        recurringGroups.get(event.recurring_template_id)!.push(event)
      } else {
        oneTimeEvents.push(event)
      }
    })
    
    // For each recurring group, find the next upcoming event
    const nextRecurringEvents: Event[] = []
    recurringGroups.forEach(groupEvents => {
      // Sort by date to find the next upcoming event
      const sortedEvents = groupEvents.sort((a, b) => 
        new Date(a.date).getTime() - new Date(b.date).getTime()
      )
      
      // Find the next event that hasn't finished yet
      const nextEvent = sortedEvents.find(event => {
        const eventDate = new Date(event.date)
        return eventDate >= now || event.event_status === 'live' || event.event_status === 'scheduled'
      })
      
      // If no future events, show the most recent one
      if (nextEvent) {
        nextRecurringEvents.push(nextEvent)
      } else if (sortedEvents.length > 0) {
        nextRecurringEvents.push(sortedEvents[sortedEvents.length - 1])
      }
    })
    
    // Combine one-time events with next recurring events
    return [...oneTimeEvents, ...nextRecurringEvents].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    )
  }

  useEffect(() => {
    const fetchData = async () => {
      // Don't fetch data until auth loading is complete
      if (authLoading) return
      
      setLoading(true)
      setError(null)
      
      try {
        console.log('Fetching events...', { user: user?.id, authLoading })
        
        // Try public API first if we suspect token issues
        const token = localStorage.getItem('token')
        if (token && !user) {
          console.log('Token exists but no user - might be expired, trying public API first')
          try {
            const eventsResponse = await eventsAPI.getAllPublic()
            console.log('Events fetched via public API:', eventsResponse.data.length)
            const recentEvents = filterOldEvents(eventsResponse.data)
            const filteredEvents = filterRecurringEvents(recentEvents)
            setEvents(filteredEvents)
            setUserSignups([])
            localStorage.removeItem('token') // Clear the invalid token
            return
          } catch (publicErr) {
            console.log('Public API also failed, trying authenticated API')
          }
        }
        
        const eventsResponse = await eventsAPI.getAll()
        console.log('Events fetched:', eventsResponse.data.length)
        
        // First filter out old events (ended more than 12 hours ago)
        const recentEvents = filterOldEvents(eventsResponse.data)
        // Then filter recurring events to show only next occurrence
        const filteredEvents = filterRecurringEvents(recentEvents)
        setEvents(filteredEvents)
        
        if (user) {
          console.log('Fetching user signups...')
          const signupsResponse = await signupsAPI.getMySignups()
          console.log('User signups fetched:', signupsResponse.data.length)
          setUserSignups(signupsResponse.data)
        } else {
          // Clear user signups if no user
          setUserSignups([])
        }
        console.log('Data fetch completed successfully')
      } catch (err: any) {
        console.error('Error fetching events:', {
          error: err,
          status: err.response?.status,
          data: err.response?.data,
          url: err.config?.url
        })
        
        // If we get unauthorized on events endpoint, it might be due to invalid token
        // Since events endpoint should be public, try using public method without auth
        if (err.response?.status === 401 && err.config?.url?.includes('/events')) {
          console.log('Got 401 on events endpoint, trying public API without auth')
          try {
            const eventsResponse = await eventsAPI.getAllPublic()
            const recentEvents = filterOldEvents(eventsResponse.data)
            const filteredEvents = filterRecurringEvents(recentEvents)
            setEvents(filteredEvents)
            // Clear potentially invalid token
            localStorage.removeItem('token')
            // Don't try to fetch user signups since token was invalid
            setUserSignups([])
            return // Success, exit early
          } catch (retryErr: any) {
            console.error('Public API retry also failed:', retryErr)
          }
        }
        
        const errorMessage = err.response?.data?.message || err.message || 'Failed to load events'
        setError(errorMessage)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [user, authLoading])

  const handleQuickSignup = async (eventId: string | number) => {
    if (!user) return
    
    setSubmitting(true)
    try {
      const response = await signupsAPI.create({
        eventId,
        performanceName: signupForm.performerName,
        performanceType: signupForm.performanceType,
        notes: signupForm.notes
      })
      
      setUserSignups(prev => [...prev, response.data.signup])
      setShowSignupForm(null)
      setSignupForm({
        performerName: user.name,
        performanceType: 'music',
        notes: ''
      })
    } catch (error: any) {
      console.error('Error signing up:', error)
      setError(error.response?.data?.message || 'Failed to sign up for event')
    } finally {
      setSubmitting(false)
    }
  }

  const getSignupStatus = (event: Event) => {
    const now = new Date()
    const signupOpens = event.signup_opens ? new Date(event.signup_opens) : null
    const signupDeadline = event.signup_deadline ? new Date(event.signup_deadline) : null
    
    const userSignup = userSignups.find(signup => signup.event_id === event.id)
    const isEventFull = event.current_signups >= event.max_performers
    
    if (userSignup) {
      return { status: 'signed-up', message: 'You\'re signed up!', color: 'bg-blue-100 text-blue-800' }
    }
    
    if (event.event_status === 'live') {
      return { status: 'live', message: '🔴 LIVE NOW', color: 'bg-red-100 text-red-800' }
    }
    
    if (event.event_status === 'finished') {
      return { status: 'finished', message: '✅ Finished', color: 'bg-gray-100 text-gray-800' }
    }
    
    if (signupOpens && signupOpens > now) {
      return { status: 'not-open', message: 'Sign-ups open soon', color: 'bg-yellow-100 text-yellow-800' }
    }
    
    if (signupDeadline && signupDeadline < now) {
      return { status: 'closed', message: 'Sign-ups closed', color: 'bg-gray-100 text-gray-800' }
    }
    
    if (isEventFull) {
      return { status: 'full', message: 'Event full', color: 'bg-red-100 text-red-800' }
    }
    
    return { status: 'open', message: 'Sign-ups open!', color: 'bg-green-100 text-green-800' }
  }

  const getFilteredEvents = () => {
    switch (activeTab) {
      case 'hosting':
        return user ? events.filter(event => event.host_id === user.id) : []
      case 'performances':
        if (!user) return []
        const userEventIds = userSignups.map(signup => signup.event_id)
        return events.filter(event => userEventIds.includes(event.id))
      default:
        return events
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex flex-col justify-center items-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mb-4"></div>
        <div className="text-lg text-gray-600">
          {authLoading ? 'Loading...' : 'Loading events...'}
        </div>
      </div>
    )
  }

  const handleRetry = () => {
    setError(null)
    setLoading(true)
    // Trigger the useEffect to refetch data
    const fetchData = async () => {
      try {
        const eventsResponse = await eventsAPI.getAll()
        const recentEvents = filterOldEvents(eventsResponse.data)
        const filteredEvents = filterRecurringEvents(recentEvents)
        setEvents(filteredEvents)
        
        if (user) {
          const signupsResponse = await signupsAPI.getMySignups()
          setUserSignups(signupsResponse.data)
        } else {
          setUserSignups([])
        }
      } catch (err: any) {
        console.error('Retry error:', err)
        
        // Handle 401 on events endpoint by using public API
        if (err.response?.status === 401 && err.config?.url?.includes('/events')) {
          console.log('Got 401 on retry, trying public API')
          try {
            const eventsResponse = await eventsAPI.getAllPublic()
            const recentEvents = filterOldEvents(eventsResponse.data)
            const filteredEvents = filterRecurringEvents(recentEvents)
            setEvents(filteredEvents)
            localStorage.removeItem('token')
            setUserSignups([])
            return
          } catch (retryErr) {
            console.error('Public API retry failed:', retryErr)
          }
        }
        
        setError('Failed to load events')
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }

  if (error && events.length === 0) {
    return (
      <div className="text-center text-red-600">
        <p>{error}</p>
        <button 
          onClick={handleRetry}
          className="btn btn-primary mt-4"
          disabled={loading}
        >
          {loading ? 'Retrying...' : 'Try Again'}
        </button>
      </div>
    )
  }

  const filteredEvents = getFilteredEvents()

  return (
    <div>
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Open Mic Events</h1>
      </div>

      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded flex justify-between items-center">
          <div>
            <strong>Error:</strong> {error}
            {events.length > 0 && (
              <div className="text-sm mt-1">Showing cached events. Click retry to refresh.</div>
            )}
          </div>
          <div className="flex space-x-2">
            <button 
              onClick={handleRetry}
              className="text-red-600 hover:text-red-800 underline text-sm"
              disabled={loading}
            >
              {loading ? 'Retrying...' : 'Retry'}
            </button>
            <button 
              onClick={() => setError(null)}
              className="text-red-500 hover:text-red-700 text-lg leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6 sm:mb-8">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          <button
            onClick={() => setActiveTab('all')}
            className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap min-h-[44px] ${
              activeTab === 'all'
                ? 'border-primary-500 text-primary-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            <span className="hidden sm:inline">All Events ({events.length})</span>
            <span className="sm:hidden">All ({events.length})</span>
          </button>
          {user && (
            <>
              <button
                onClick={() => setActiveTab('hosting')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap min-h-[44px] ${
                  activeTab === 'hosting'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="hidden sm:inline">Hosting ({events.filter(e => e.host_id === user.id).length})</span>
                <span className="sm:hidden">👑 ({events.filter(e => e.host_id === user.id).length})</span>
              </button>
              <button
                onClick={() => setActiveTab('performances')}
                className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap min-h-[44px] ${
                  activeTab === 'performances'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="hidden sm:inline">My Performances ({userSignups.length})</span>
                <span className="sm:hidden">🎤 ({userSignups.length})</span>
              </button>
            </>
          )}
        </nav>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-lg">
            {activeTab === 'all' && 'No events found.'}
            {activeTab === 'hosting' && !user && 'Please log in to see your hosted events.'}
            {activeTab === 'hosting' && user && 'You are not hosting any events yet.'}
            {activeTab === 'performances' && !user && 'Please log in to see your performances.'}
            {activeTab === 'performances' && user && 'You have not signed up for any events yet.'}
          </p>
          {activeTab === 'performances' && user && (
            <button
              onClick={() => setActiveTab('all')}
              className="btn btn-primary mt-4"
            >
              Browse All Events
            </button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {filteredEvents.map((event) => {
            const signupStatus = getSignupStatus(event)
            const now = new Date()
            const signupOpens = event.signup_opens ? new Date(event.signup_opens) : null
            const signupDeadline = event.signup_deadline ? new Date(event.signup_deadline) : null
            const userSignup = userSignups.find(signup => signup.event_id === event.id)
            
            return (
              <div key={event.id} className="card hover:shadow-lg transition-shadow">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-3">
                  <h3 className="text-lg font-semibold text-gray-900 mb-2 sm:mb-0">
                    {event.title}
                  </h3>
                  <div className="flex flex-wrap gap-1 sm:flex-col sm:items-end sm:space-y-1">
                    <span className="text-xs bg-primary-100 text-primary-800 px-2 py-1 rounded-full">
                      {event.event_type}
                    </span>
                    {event.recurring_template_id && (
                      <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">
                        🔄 Recurring
                      </span>
                    )}
                    {activeTab === 'hosting' && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                        👑 Host
                      </span>
                    )}
                    {activeTab === 'performances' && userSignup && (
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                        🎤 Performing
                      </span>
                    )}
                    <span className={`text-xs px-2 py-1 rounded-full ${signupStatus.color}`}>
                      {signupStatus.message}
                    </span>
                  </div>
                </div>
                
                <p className="text-gray-600 mb-3 line-clamp-2">{event.description}</p>
                
                {/* Performance Info for My Performances tab */}
                {activeTab === 'performances' && userSignup && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <h4 className="font-medium text-blue-800 mb-1">Your Performance</h4>
                    <p className="text-sm text-blue-700">"{userSignup.performance_name}"</p>
                    <p className="text-xs text-blue-600 mt-1">
                      {userSignup.performance_type} • Status: {userSignup.status}
                      {userSignup.is_finished && ' • ✅ Completed'}
                    </p>
                  </div>
                )}
                
                <div className="space-y-2 text-sm text-gray-500 mb-4">
                  <div>📍 {event.venue_name}</div>
                  <div>📅 {new Date(event.date).toLocaleDateString()}</div>
                  <div>🕐 {formatTime12Hour(event.start_time)} - {formatTime12Hour(event.end_time)}</div>
                  <div>
                    👥 {event.current_signups}/{event.max_performers} performers
                  </div>
                  <div className="flex items-center">
                    <span>📋 </span>
                    {event.signup_list_mode === 'signup_order' && (
                      <span className="text-blue-600 font-medium">Sign-up Order</span>
                    )}
                    {event.signup_list_mode === 'random_order' && (
                      <span className="text-purple-600 font-medium">Random Order</span>
                    )}
                    {event.signup_list_mode === 'bucket' && (
                      <span className="text-orange-600 font-medium">Bucket Style</span>
                    )}
                  </div>
                  {signupOpens && signupOpens > now && (
                    <div className="text-yellow-600">
                      📅 Sign-ups open: {signupOpens.toLocaleDateString()} at {formatTimeOnly12Hour(event.signup_opens!)}
                    </div>
                  )}
                  {signupDeadline && signupDeadline > now && (
                    <div className="text-orange-600">
                      ⏰ Sign-up deadline: {signupDeadline.toLocaleDateString()} at {formatTimeOnly12Hour(event.signup_deadline!)}
                    </div>
                  )}
                </div>
                
                <div className="space-y-2">
                  {user && signupStatus.status === 'open' && (
                    <button
                      onClick={() => {
                        setSignupForm({
                          performerName: user.name,
                          performanceType: 'music',
                          notes: ''
                        })
                        setShowSignupForm(event.id)
                      }}
                      className="btn btn-primary w-full text-sm sm:text-base"
                    >
                      <span className="hidden sm:inline">Quick Sign Up</span>
                      <span className="sm:hidden">🎤 Sign Up</span>
                    </button>
                  )}
                  
                  {!user && signupStatus.status === 'open' && (
                    <div className="text-center text-sm text-gray-600 mb-2">
                      <Link to="/login" className="text-primary-600 hover:text-primary-700 underline">
                        Login to sign up
                      </Link>
                    </div>
                  )}
                  
                  <Link
                    to={`/events/${event.id}`}
                    className="btn btn-secondary w-full text-center text-sm sm:text-base"
                  >
                    <span className="hidden sm:inline">View Details</span>
                    <span className="sm:hidden">👁️ Details</span>
                  </Link>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Quick Sign-up Modal */}
      {showSignupForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Quick Sign Up</h3>
            <form onSubmit={(e) => {
              e.preventDefault()
              handleQuickSignup(showSignupForm)
            }} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performer Name *
                </label>
                <input
                  type="text"
                  value={signupForm.performerName}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, performerName: e.target.value }))}
                  className="input"
                  placeholder="Your name or stage name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Type *
                </label>
                <select
                  value={signupForm.performanceType}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, performanceType: e.target.value }))}
                  className="input"
                  required
                >
                  {PERFORMANCE_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  value={signupForm.notes}
                  onChange={(e) => setSignupForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="input"
                  rows={2}
                  placeholder="Any special requirements, song titles, etc."
                />
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Signing Up...' : 'Sign Me Up!'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSignupForm(null)}
                  className="btn btn-secondary flex-1"
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}