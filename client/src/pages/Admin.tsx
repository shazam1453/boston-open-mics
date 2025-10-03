import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { adminAPI } from '../utils/api'
import { formatDate, formatTime12Hour } from '../utils/dateTime'
import type { User, Event, Venue } from '../types'

export default function Admin() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<'users' | 'events' | 'venues'>('users')
  const [users, setUsers] = useState<User[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [venues, setVenues] = useState<Venue[]>([])
  const [loadingData, setLoadingData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')

  // Check if user is admin
  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>
  }

  if (!user || !['admin', 'super_admin', 'moderator'].includes(user.role || '')) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-red-600 mb-4">Access Denied</h1>
        <p className="text-gray-600">You don't have permission to access this page.</p>
        <p className="text-sm text-gray-500 mt-2">Current user role: {user?.role || 'none'}</p>
        <p className="text-sm text-gray-500">User ID: {user?.id}</p>
      </div>
    )
  }



  const deleteUser = async (userId: string | number) => {
    if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
      return
    }

    try {
      await adminAPI.deleteUser(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
    } catch (error: any) {
      console.error('Error deleting user:', error)
      setError(error.response?.data?.message || 'Failed to delete user')
    }
  }

  const deleteEvent = async (eventId: string | number) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    try {
      await adminAPI.deleteEvent(eventId)
      setEvents(prev => prev.filter(e => e.id !== eventId))
    } catch (error: any) {
      console.error('Error deleting event:', error)
      setError(error.response?.data?.message || 'Failed to delete event')
    }
  }

  const deleteVenue = async (venueId: string | number) => {
    if (!confirm('Are you sure you want to delete this venue? This will also delete all related events. This action cannot be undone.')) {
      return
    }

    try {
      await adminAPI.deleteVenue(venueId)
      setVenues(prev => prev.filter(v => v.id !== venueId))
      // Also remove events from this venue
      setEvents(prev => prev.filter(e => e.venue_id !== venueId))
    } catch (error: any) {
      console.error('Error deleting venue:', error)
      setError(error.response?.data?.message || 'Failed to delete venue')
    }
  }

  const updateUserRole = async (userId: string | number, newRole: string) => {
    if (!confirm(`Are you sure you want to change this user's role to ${newRole}?`)) {
      return
    }

    try {
      const response = await adminAPI.updateUserRole(userId, newRole)
      setUsers(prev => prev.map(u => u.id === userId ? response.data.user : u))
    } catch (error: any) {
      console.error('Error updating user role:', error)
      setError(error.response?.data?.message || 'Failed to update user role')
    }
  }

  const canDeleteUser = (targetUser: User) => {
    if (!user) return false
    
    // Super admins can delete anyone except other super admins (unless self)
    if (user.role === 'super_admin') {
      return targetUser.role !== 'super_admin' || targetUser.id === user.id
    }
    
    // Admins can delete moderators and regular users, but not other admins
    if (user.role === 'admin') {
      return !['admin', 'super_admin'].includes(targetUser.role || '')
    }
    
    // Moderators can delete regular users only
    if (user.role === 'moderator') {
      return targetUser.role === 'user'
    }
    
    return false
  }

  const canChangeRole = (targetUser: User) => {
    return user?.role === 'super_admin' && targetUser.id !== user.id
  }

  const getRoleColor = (role?: string) => {
    switch (role) {
      case 'super_admin': return 'bg-red-100 text-red-800'
      case 'admin': return 'bg-orange-100 text-orange-800'
      case 'moderator': return 'bg-blue-100 text-blue-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getRoleLabel = (role?: string) => {
    switch (role) {
      case 'super_admin': return 'SUPER ADMIN'
      case 'admin': return 'ADMIN'
      case 'moderator': return 'MODERATOR'
      default: return 'USER'
    }
  }

  // Single useEffect to handle all data loading
  useEffect(() => {
    // Don't do anything if still loading or no user
    if (loading || !user) return
    
    // Check permissions
    if (!['admin', 'super_admin', 'moderator'].includes(user.role || '')) {
      return
    }
    
    console.log('Admin page - user:', user, 'role:', user?.role)
    
    // Load data based on active tab
    const loadData = async () => {
      setLoadingData(true)
      setError(null)
      
      try {
        if (activeTab === 'users') {
          const response = await adminAPI.getAllUsers()
          setUsers(response.data || [])
        } else if (activeTab === 'events') {
          const response = await adminAPI.getAllEvents()
          setEvents(response.data || [])
        } else if (activeTab === 'venues') {
          const response = await adminAPI.getAllVenues()
          setVenues(response.data || [])
        }
      } catch (error: any) {
        console.error(`Error loading ${activeTab}:`, error)
        setError(error.response?.data?.message || `Failed to load ${activeTab}`)
        
        // Reset the appropriate state
        if (activeTab === 'users') setUsers([])
        else if (activeTab === 'events') setEvents([])
        else if (activeTab === 'venues') setVenues([])
      } finally {
        setLoadingData(false)
      }
    }
    
    loadData()
  }, [activeTab, user?.id, loading]) // Minimal dependencies

  // Reset search when switching tabs
  useEffect(() => {
    setSearchQuery('')
  }, [activeTab])

  // Filter functions
  const filteredUsers = users.filter(user => 
    (user.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.email || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.performer_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (user.role || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredEvents = events.filter(event =>
    (event.title || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.venue_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.host_name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.event_type || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.event_status || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (event.date || '').includes(searchQuery)
  )

  const filteredVenues = venues.filter(venue =>
    (venue.name || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (venue.address || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
    (venue.owner_name || '').toLowerCase().includes(searchQuery.toLowerCase())
  )

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {user.role === 'super_admin' ? '🔥 Super Admin Panel' :
           user.role === 'admin' ? '⚡ Admin Panel' :
           '🛡️ Moderator Panel'}
        </h1>
        <p className="text-gray-600">
          {user.role === 'super_admin' ? 'Full system administration with role management' :
           user.role === 'admin' ? 'System administration access' :
           'Content moderation access'}
        </p>
      </div>

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setActiveTab('users')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'users'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Users ({users.length})
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'events'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Events ({events.length})
          </button>
          <button
            onClick={() => setActiveTab('venues')}
            className={`py-2 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'venues'
                ? 'border-red-500 text-red-600'
                : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
            }`}
          >
            Venues ({venues.length})
          </button>
        </nav>
      </div>

      {/* Search Bar */}
      <div className="mb-6">
        <div className="relative max-w-md">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <svg className="h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={
              activeTab === 'users' ? 'Search users by name, email, type, or role...' :
              activeTab === 'events' ? 'Search events by title, venue, host, type, or status...' :
              'Search venues by name, address, or owner...'
            }
            className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-red-500 focus:border-red-500"
          />
        </div>
        {searchQuery && (
          <p className="mt-2 text-sm text-gray-600">
            {activeTab === 'users' && `Showing ${filteredUsers.length} of ${users.length} users`}
            {activeTab === 'events' && `Showing ${filteredEvents.length} of ${events.length} events`}
            {activeTab === 'venues' && `Showing ${filteredVenues.length} of ${venues.length} venues`}
          </p>
        )}
      </div>

      {loadingData ? (
        <div className="flex justify-center items-center h-64">
          <div className="text-lg">Loading...</div>
        </div>
      ) : (
        <>
          {/* Users Tab */}
          {activeTab === 'users' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">All Users</h2>
              {filteredUsers.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? 'No users found matching your search.' : 'No users found.'}
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {filteredUsers.map((user) => (
                    <li key={user.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center">
                          <div>
                            <div className="flex items-center space-x-2">
                              <p className="text-sm font-medium text-gray-900">{user.name}</p>
                              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getRoleColor(user.role)}`}>
                                {getRoleLabel(user.role)}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500">{user.email}</p>
                            {user.performer_type && (
                              <p className="text-sm text-gray-500 capitalize">{user.performer_type}</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">ID: {user.id}</span>
                          
                          {/* Role Management (Super Admin Only) */}
                          {canChangeRole(user) && (
                            <select
                              value={user.role || 'user'}
                              onChange={(e) => updateUserRole(user.id, e.target.value)}
                              className="text-sm border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="user">User</option>
                              <option value="moderator">Moderator</option>
                              <option value="admin">Admin</option>
                              <option value="super_admin">Super Admin</option>
                            </select>
                          )}
                          
                          {/* Delete Button */}
                          {canDeleteUser(user) ? (
                            <button
                              onClick={() => deleteUser(user.id)}
                              className="btn bg-red-600 text-white hover:bg-red-700 text-sm"
                            >
                              Delete
                            </button>
                          ) : (
                            <span className="text-sm text-gray-400">Protected</span>
                          )}
                        </div>
                      </div>
                    </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Events Tab */}
          {activeTab === 'events' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">All Events</h2>
              {filteredEvents.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? 'No events found matching your search.' : 'No events found.'}
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {filteredEvents.map((event) => (
                    <li key={event.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="flex items-center space-x-2">
                            <p className="text-sm font-medium text-gray-900">{event.title}</p>
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                              event.event_status === 'live' ? 'bg-green-100 text-green-800' :
                              event.event_status === 'finished' ? 'bg-gray-100 text-gray-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {event.event_status}
                            </span>
                          </div>
                          <p className="text-sm text-gray-500">
                            {event.venue_name} • {formatDate(event.date)} at {formatTime12Hour(event.start_time)}
                          </p>
                          <p className="text-sm text-gray-500">
                            Host: {event.host_name} • {event.current_signups}/{event.max_performers} performers
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">ID: {event.id}</span>
                          <button
                            onClick={() => deleteEvent(event.id)}
                            className="btn bg-red-600 text-white hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}

          {/* Venues Tab */}
          {activeTab === 'venues' && (
            <div>
              <h2 className="text-xl font-semibold mb-4">All Venues</h2>
              {filteredVenues.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {searchQuery ? 'No venues found matching your search.' : 'No venues found.'}
                </div>
              ) : (
                <div className="bg-white shadow overflow-hidden sm:rounded-md">
                  <ul className="divide-y divide-gray-200">
                    {filteredVenues.map((venue) => (
                    <li key={venue.id} className="px-6 py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium text-gray-900">{venue.name}</p>
                          <p className="text-sm text-gray-500">{venue.address}</p>
                          <p className="text-sm text-gray-500">
                            Owner: {venue.owner_name} • Capacity: {venue.capacity || 'Not specified'}
                          </p>
                        </div>
                        <div className="flex items-center space-x-2">
                          <span className="text-sm text-gray-500">ID: {venue.id}</span>
                          <button
                            onClick={() => deleteVenue(venue.id)}
                            className="btn bg-red-600 text-white hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}