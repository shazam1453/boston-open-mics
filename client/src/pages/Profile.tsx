import { useState, useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { authAPI, venuesAPI, eventsAPI, signupsAPI, usersAPI, recurringEventsAPI } from '../utils/api'
import api from '../utils/api'
import { formatTime12Hour, formatDate } from '../utils/dateTime'
import TimePicker from '../components/TimePicker'
import ChangePassword from '../components/ChangePassword'
import { EVENT_TYPES, SIGNUP_LIST_MODES, PERFORMER_TYPES, DAYS_OF_WEEK } from '../constants/formOptions'
import type { Venue, Event, Signup, User } from '../types'

export default function Profile() {
  const { user, loading } = useAuth()
  const [activeTab, setActiveTab] = useState<'profile' | 'venues' | 'events' | 'signups'>('profile')
  const [signupsTab, setSignupsTab] = useState<'upcoming' | 'past'>('upcoming')
  const [venues, setVenues] = useState<Venue[]>([])
  const [events, setEvents] = useState<Event[]>([])
  const [signups, setSignups] = useState<Signup[]>([])
  const [showVenueForm, setShowVenueForm] = useState(false)
  const [showEventForm, setShowEventForm] = useState(false)
  const [showRecurringForm, setShowRecurringForm] = useState(false)
  const [showEditEventForm, setShowEditEventForm] = useState(false)
  const [showEditProfileForm, setShowEditProfileForm] = useState(false)
  const [showChangePassword, setShowChangePassword] = useState(false)
  const [, setSelectedVenue] = useState<string | number | null>(null)
  const [editingEvent, setEditingEvent] = useState<Event | null>(null)
  const [editingVenue, setEditingVenue] = useState<Venue | null>(null)
  const [showEditVenueForm, setShowEditVenueForm] = useState(false)

  // Debug effect to monitor state changes
  useEffect(() => {
    console.log('State changed:', { 
      showEditEventForm, 
      editingEvent: !!editingEvent,
      editingEventId: editingEvent?.id,
      editingEventTitle: editingEvent?.title 
    })
  }, [showEditEventForm, editingEvent])

  const searchCohosts = async (query: string) => {
    if (query.length < 2) {
      setCohostResults([])
      return
    }
    
    setSearchingCohosts(true)
    try {
      const response = await usersAPI.search(query)
      // Filter out current user and already selected co-hosts
      const filteredResults = response.data.filter(u => 
        u.id !== user?.id && !selectedCohosts.some(c => c.id === u.id)
      )
      setCohostResults(filteredResults)
    } catch (error) {
      console.error('Error searching co-hosts:', error)
      setCohostResults([])
    } finally {
      setSearchingCohosts(false)
    }
  }

  const addCohost = (cohost: User) => {
    setSelectedCohosts(prev => [...prev, cohost])
    setCohostSearch('')
    setCohostResults([])
  }

  const searchPerformers = async (query: string) => {
    if (query.length < 2) {
      setPerformerResults([])
      return
    }

    setSearchingPerformers(true)
    try {
      const response = await usersAPI.search(query)
      const filteredResults = response.data.filter((u: User) => 
        u.id !== user?.id
      )
      setPerformerResults(filteredResults)
    } catch (error) {
      console.error('Error searching performers:', error)
      setPerformerResults([])
    } finally {
      setSearchingPerformers(false)
    }
  }

  const addPerformerInvite = (performer: User) => {
    // Check if performer is already in the list
    if (selectedPerformers.some(p => p.id === performer.id)) {
      return // Already added
    }
    
    // Add performer to the invite list
    setSelectedPerformers(prev => [...prev, performer])
    setPerformerSearch('')
    setPerformerResults([])
  }

  // Email validation helper
  const isValidEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(email)
  }

  // Send invitation email to non-users
  const sendInvitationEmail = async (email: string, searchType: 'cohost' | 'performer') => {
    try {
      setSubmitting(true)
      const inviteData = {
        email,
        inviterName: user?.name,
        inviterEmail: user?.email,
        type: searchType,
        message: searchType === 'cohost' 
          ? `${user?.name} would like to invite you to co-host events on Boston Open Mics. Join our platform to collaborate on managing open mic events!`
          : `${user?.name} would like to invite you to perform at their events on Boston Open Mics. Join our platform to discover and sign up for open mic opportunities!`
      }
      
      // Call the API endpoint to send the invitation email
      await api.post('/invitations/send', inviteData)
      
      // Show success message
      alert(`Invitation sent to ${email}! They will receive an email with instructions to join the platform.`)
      
      // Clear the search
      if (searchType === 'cohost') {
        setCohostSearch('')
        setCohostResults([])
      } else {
        setPerformerSearch('')
        setPerformerResults([])
      }
    } catch (error: any) {
      console.error('Error sending invitation:', error)
      const errorMessage = error.response?.data?.message || 'Failed to send invitation. Please try again.'
      alert(errorMessage)
    } finally {
      setSubmitting(false)
    }
  }

  const removeCohost = (cohostId: string | number) => {
    setSelectedCohosts(prev => prev.filter(c => c.id !== cohostId))
  }

  const removePerformer = (performerId: string | number) => {
    setSelectedPerformers(prev => prev.filter(p => p.id !== performerId))
  }
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cohostSearch, setCohostSearch] = useState('')
  const [cohostResults, setCohostResults] = useState<User[]>([])
  const [selectedCohosts, setSelectedCohosts] = useState<User[]>([])
  const [selectedPerformers, setSelectedPerformers] = useState<User[]>([])
  const [searchingCohosts, setSearchingCohosts] = useState(false)
  
  // Separate state for performer search
  const [performerSearch, setPerformerSearch] = useState('')
  const [performerResults, setPerformerResults] = useState<User[]>([])
  const [searchingPerformers, setSearchingPerformers] = useState(false)

  // Form states
  const [profileForm, setProfileForm] = useState({
    name: '',
    phone: '',
    performer_type: '',
    bio: '',
    instagram_handle: '',
    twitter_handle: '',
    tiktok_handle: '',
    youtube_handle: '',
    website_url: ''
  })

  const [venueForm, setVenueForm] = useState({
    name: '',
    address: '',
    phone: '',
    email: '',
    description: '',
    capacity: '',
    amenities: [] as string[]
  })

  const [eventForm, setEventForm] = useState({
    title: '',
    description: '',
    venueId: '',
    date: '',
    startTime: '',
    endTime: '',
    maxPerformers: '10',
    performanceLength: '5',
    eventType: 'open-mic',
    signupListMode: 'signup_order',
    signupOpens: '',
    signupDeadline: ''
  })

  const [recurringForm, setRecurringForm] = useState({
    title: '',
    description: '',
    venueId: '',
    startTime: '',
    endTime: '',
    maxPerformers: '10',
    performanceLength: '5',
    eventType: 'open-mic',
    signupListMode: 'signup_order',
    dayOfWeek: '4', // Thursday
    signupOpens: '', // Time only, will be combined with event date
    signupDeadline: '', // Time only, will be combined with event date
    signupOpensHoursBefore: '168', // 1 week (fallback)
    signupDeadlineHoursBefore: '2' // 2 hours (fallback)
  })

  useEffect(() => {
    if (user) {
      loadUserData()
      // Initialize profile form with user data
      setProfileForm({
        name: user.name || '',
        phone: user.phone || '',
        performer_type: user.performer_type || '',
        bio: user.bio || '',
        instagram_handle: user.instagram_handle || '',
        twitter_handle: user.twitter_handle || '',
        tiktok_handle: user.tiktok_handle || '',
        youtube_handle: user.youtube_handle || '',
        website_url: user.website_url || ''
      })
    }
  }, [user])

  const loadUserData = async () => {
    if (!user) return

    console.log('Loading user data for user:', user.id, user.email)

    try {
      const [venuesRes, eventsRes, signupsRes] = await Promise.all([
        venuesAPI.getByOwner(user.id),
        eventsAPI.getByHost(user.id),
        signupsAPI.getMySignups()
      ])
      
      console.log('Loaded data:', {
        venues: venuesRes.data.length,
        events: eventsRes.data.length,
        signups: signupsRes.data.length
      })
      
      setVenues(venuesRes.data)
      setEvents(eventsRes.data)
      setSignups(signupsRes.data)
    } catch (error) {
      console.error('Error loading user data:', error)
    }
  }

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    try {
      // Convert form data to match backend expectations
      const updateData = {
        name: profileForm.name,
        phone: profileForm.phone,
        performerType: profileForm.performer_type,
        bio: profileForm.bio,
        instagramHandle: profileForm.instagram_handle,
        twitterHandle: profileForm.twitter_handle,
        tiktokHandle: profileForm.tiktok_handle,
        youtubeHandle: profileForm.youtube_handle,
        websiteUrl: profileForm.website_url
      }
      
      await authAPI.updateProfile(updateData)
      
      setShowEditProfileForm(false)
      // The user context should automatically update, but we can trigger a reload
      window.location.reload()
    } catch (error: any) {
      console.error('Error updating profile:', error)
      setError(error.response?.data?.message || 'Failed to update profile')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVenueSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    try {
      const response = await venuesAPI.create({
        ...venueForm,
        capacity: venueForm.capacity ? parseInt(venueForm.capacity) : undefined
      })
      
      // Add the new venue to the state immediately
      setVenues(prev => [...prev, response.data.venue])
      
      setShowVenueForm(false)
      setVenueForm({
        name: '',
        address: '',
        phone: '',
        email: '',
        description: '',
        capacity: '',
        amenities: []
      })
      
      // Switch to venues tab to show the newly created venue
      setActiveTab('venues')
      
      // Also reload data to ensure consistency
      await loadUserData()
    } catch (error: any) {
      console.error('Error creating venue:', error)
      setError(error.response?.data?.message || 'Failed to create venue')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEventSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    try {
      // Combine event date with signup times
      let signupOpens = undefined
      let signupDeadline = undefined
      
      if (eventForm.signupOpens) {
        signupOpens = `${eventForm.date}T${eventForm.signupOpens}:00`
      }
      
      if (eventForm.signupDeadline) {
        signupDeadline = `${eventForm.date}T${eventForm.signupDeadline}:00`
      }
      
      const response = await eventsAPI.create({
        title: eventForm.title,
        description: eventForm.description,
        venueId: parseInt(eventForm.venueId),
        date: eventForm.date,
        startTime: eventForm.startTime,
        endTime: eventForm.endTime,
        maxPerformers: parseInt(eventForm.maxPerformers),
        performanceLength: parseInt(eventForm.performanceLength),
        eventType: eventForm.eventType,
        signupListMode: eventForm.signupListMode,
        signupOpens,
        signupDeadline
      })
      
      let createdEvent = response.data.event
      
      // Handle co-hosts and invites based on event type
      if (eventForm.signupListMode === 'booked_mic') {
        // For booked mic events, send invites to selected performers
        for (const performer of selectedPerformers) {
          try {
            await eventsAPI.sendInvite(createdEvent.id, performer.id)
          } catch (error) {
            console.error('Error sending invite:', error)
            // Continue with other invites even if one fails
          }
        }
      } else {
        // For regular events, add co-hosts
        for (const cohost of selectedCohosts) {
          try {
            const cohostResponse = await eventsAPI.addCohost(createdEvent.id, cohost.id)
            createdEvent = cohostResponse.data.event
          } catch (error) {
            console.error('Error adding co-host:', error)
            // Continue with other co-hosts even if one fails
          }
        }
      }
      
      // Add the new event to the state immediately
      setEvents(prev => [...prev, createdEvent])
      
      setShowEventForm(false)
      setEventForm({
        title: '',
        description: '',
        venueId: '',
        date: '',
        startTime: '',
        endTime: '',
        maxPerformers: '10',
        performanceLength: '5',
        eventType: 'open-mic',
        signupListMode: 'signup_order',
        signupOpens: '', // Time only, will be combined with event date
        signupDeadline: '' // Time only, will be combined with event date
      })
      setSelectedCohosts([])
      setSelectedPerformers([])
      setCohostSearch('')
      setCohostResults([])
      setPerformerSearch('')
      setPerformerResults([])
      setPerformerSearch('')
      setPerformerResults([])
      
      // Also reload data to ensure consistency
      await loadUserData()
    } catch (error: any) {
      console.error('Error creating event:', error)
      setError(error.response?.data?.message || 'Failed to create event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRecurringSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)
    setError(null)
    
    try {
      const templateData = {
        ...recurringForm,
        venueId: parseInt(recurringForm.venueId),
        maxPerformers: parseInt(recurringForm.maxPerformers),
        performanceLength: parseInt(recurringForm.performanceLength),
        recurrencePattern: 'weekly', // Always weekly
        dayOfWeek: parseInt(recurringForm.dayOfWeek),
        // Use specific times if provided, otherwise fall back to hours before
        signupOpensTime: recurringForm.signupOpens || null,
        signupDeadlineTime: recurringForm.signupDeadline || null,
        signupOpensHoursBefore: parseInt(recurringForm.signupOpensHoursBefore),
        signupDeadlineHoursBefore: parseInt(recurringForm.signupDeadlineHoursBefore)
      }
      
      const response = await recurringEventsAPI.create(templateData)
      
      // Generate initial events
      const eventsResponse = await recurringEventsAPI.generateEvents(response.data.template.id, 4)
      
      // Add the new events to the state immediately
      setEvents(prev => [...prev, ...eventsResponse.data.events])
      
      setShowRecurringForm(false)
      setRecurringForm({
        title: '',
        description: '',
        venueId: '',
        startTime: '',
        endTime: '',
        maxPerformers: '10',
        performanceLength: '5',
        eventType: 'open-mic',
        signupListMode: 'signup_order',
        dayOfWeek: '4', // Thursday
        signupOpens: '', // Time only
        signupDeadline: '', // Time only
        signupOpensHoursBefore: '168', // 1 week
        signupDeadlineHoursBefore: '2'
      })
      
      // Also reload data to ensure consistency
      await loadUserData()
    } catch (error: any) {
      console.error('Error creating recurring event:', error)
      setError(error.response?.data?.message || 'Failed to create recurring event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditEvent = (event: Event) => {
    console.log('handleEditEvent called with:', event)
    try {
      setEditingEvent(event)
      console.log('Set editing event')
      
      const formData = {
        title: event.title,
        description: event.description || '',
        venueId: event.venue_id.toString(),
        date: event.date,
        startTime: event.start_time,
        endTime: event.end_time,
        maxPerformers: event.max_performers.toString(),
        performanceLength: event.performance_length.toString(),
        eventType: event.event_type,
        signupListMode: event.signup_list_mode || 'signup_order',
        signupOpens: event.signup_opens ? new Date(event.signup_opens).toTimeString().slice(0, 5) : '',
        signupDeadline: event.signup_deadline ? new Date(event.signup_deadline).toTimeString().slice(0, 5) : ''
      }
      
      console.log('Form data:', formData)
      setEventForm(formData)
      console.log('Set event form')
      
      // Set existing co-hosts
      setSelectedCohosts(event.cohosts?.map(c => ({ 
        id: c.user_id, 
        name: c.user_name || 'Unknown User', 
        email: c.user_email || '',
        created_at: '',
        phone: '',
        performer_type: undefined,
        bio: '',
        instagram_handle: '',
        twitter_handle: '',
        tiktok_handle: '',
        youtube_handle: '',
        website_url: ''
      })) || [])
      setCohostSearch('')
      setCohostResults([])
      setPerformerSearch('')
      setPerformerResults([])
      
      setShowEditEventForm(true)
      console.log('Set showEditEventForm to true')
    } catch (error) {
      console.error('Error in handleEditEvent:', error)
    }
  }

  const handleUpdateEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingEvent) return
    
    setSubmitting(true)
    setError(null)
    
    try {
      // Combine event date with signup times
      let signupOpens = undefined
      let signupDeadline = undefined
      
      if (eventForm.signupOpens) {
        signupOpens = `${eventForm.date}T${eventForm.signupOpens}:00`
      }
      
      if (eventForm.signupDeadline) {
        signupDeadline = `${eventForm.date}T${eventForm.signupDeadline}:00`
      }
      
      const response = await eventsAPI.update(editingEvent.id, {
        title: eventForm.title,
        description: eventForm.description,
        venue_id: parseInt(eventForm.venueId),
        date: eventForm.date,
        start_time: eventForm.startTime,
        end_time: eventForm.endTime,
        max_performers: parseInt(eventForm.maxPerformers),
        performance_length: parseInt(eventForm.performanceLength),
        event_type: eventForm.eventType as 'open-mic' | 'showcase' | 'competition' | 'workshop',
        signup_list_mode: eventForm.signupListMode as 'signup_order' | 'random_order' | 'bucket' | 'booked_mic',
        signup_opens: signupOpens,
        signup_deadline: signupDeadline
      })
      
      // Update the event in the state
      setEvents(prev => prev.map(event => 
        event.id === editingEvent.id ? response.data.event : event
      ))
      
      setShowEditEventForm(false)
      setEditingEvent(null)
      
      // Also reload data to ensure consistency
      await loadUserData()
    } catch (error: any) {
      console.error('Error updating event:', error)
      setError(error.response?.data?.message || 'Failed to update event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteEvent = async (eventId: string | number) => {
    if (!confirm('Are you sure you want to delete this event? This action cannot be undone.')) {
      return
    }

    setSubmitting(true)
    setError(null)
    
    try {
      await eventsAPI.delete(eventId)
      
      // Remove the event from the state
      setEvents(prev => prev.filter(event => event.id !== eventId))
      
      // Also reload data to ensure consistency
      await loadUserData()
    } catch (error: any) {
      console.error('Error deleting event:', error)
      setError(error.response?.data?.message || 'Failed to delete event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditVenue = (venue: Venue) => {
    setEditingVenue(venue)
    setVenueForm({
      name: venue.name || '',
      address: venue.address || '',
      phone: venue.phone || '',
      email: venue.email || '',
      description: venue.description || '',
      capacity: venue.capacity?.toString() || '',
      amenities: venue.amenities || []
    })
    setShowEditVenueForm(true)
  }

  const handleUpdateVenue = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!editingVenue) return
    
    setSubmitting(true)
    try {
      const response = await venuesAPI.update(editingVenue.id, {
        ...venueForm,
        capacity: venueForm.capacity ? parseInt(venueForm.capacity) : undefined
      })
      
      // Update the venue in the state
      setVenues(prev => prev.map(v => v.id === editingVenue.id ? response.data.venue : v))
      
      setShowEditVenueForm(false)
      setEditingVenue(null)
      setVenueForm({
        name: '',
        address: '',
        phone: '',
        email: '',
        description: '',
        capacity: '',
        amenities: []
      })
    } catch (error: any) {
      console.error('Error updating venue:', error)
      setError(error.response?.data?.message || 'Failed to update venue')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteVenue = async (venueId: string | number) => {
    if (!confirm('Are you sure you want to delete this venue? This action cannot be undone and will affect any events using this venue.')) {
      return
    }
    
    try {
      await venuesAPI.delete(venueId)
      
      // Remove the venue from the state
      setVenues(prev => prev.filter(v => v.id !== venueId))
    } catch (error: any) {
      console.error('Error deleting venue:', error)
      setError(error.response?.data?.message || 'Failed to delete venue')
    }
  }

  if (loading) {
    return <div className="text-center">Loading...</div>
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Dashboard</h1>
        <p className="text-gray-600 mt-2">Manage your profile, venues, and events</p>
        
        {error && (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
            {error}
            <button 
              onClick={() => setError(null)}
              className="ml-2 text-red-500 hover:text-red-700"
            >
              ×
            </button>
          </div>
        )}
      </div>

      {/* Tab Navigation */}
      <div className="border-b border-gray-200 mb-6 sm:mb-8">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 overflow-x-auto">
          {[
            { key: 'profile', label: 'Profile', mobileLabel: '👤' },
            { key: 'venues', label: `My Venues (${venues.length})`, mobileLabel: `🏢 (${venues.length})` },
            { key: 'events', label: `My Events (${events.length})`, mobileLabel: `📅 (${events.length})` },
            { key: 'signups', label: `My Signups (${signups.length})`, mobileLabel: `🎤 (${signups.length})` }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as any)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap min-h-[44px] ${
                activeTab === tab.key
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <span className="hidden sm:inline">{tab.label}</span>
              <span className="sm:hidden">{tab.mobileLabel}</span>
            </button>
          ))}
        </nav>
      </div>

      {/* Profile Tab */}
      {activeTab === 'profile' && (
        <div className="card max-w-2xl">
          <h2 className="text-xl font-semibold mb-6">Profile Information</h2>
          
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700">Name</label>
              <p className="mt-1 text-gray-900">{user.name}</p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700">Email</label>
              <p className="mt-1 text-gray-900">{user.email}</p>
            </div>
            
            {user.phone && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Phone</label>
                <p className="mt-1 text-gray-900">{user.phone}</p>
              </div>
            )}
            
            {user.performer_type && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Performer Type</label>
                <p className="mt-1 text-gray-900 capitalize">{user.performer_type}</p>
              </div>
            )}
            
            {user.bio && (
              <div>
                <label className="block text-sm font-medium text-gray-700">Bio</label>
                <p className="mt-1 text-gray-900">{user.bio}</p>
              </div>
            )}

            {/* Social Media Links */}
            {(user.instagram_handle || user.twitter_handle || user.tiktok_handle || user.youtube_handle || user.website_url) && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Social Media</label>
                <div className="flex flex-wrap gap-3">
                  {user.instagram_handle && (
                    <a
                      href={`https://instagram.com/${user.instagram_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-pink-100 text-pink-800 hover:bg-pink-200 transition-colors"
                    >
                      📷 @{user.instagram_handle}
                    </a>
                  )}
                  {user.twitter_handle && (
                    <a
                      href={`https://twitter.com/${user.twitter_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800 hover:bg-blue-200 transition-colors"
                    >
                      🐦 @{user.twitter_handle}
                    </a>
                  )}
                  {user.tiktok_handle && (
                    <a
                      href={`https://tiktok.com/@${user.tiktok_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-gray-100 text-gray-800 hover:bg-gray-200 transition-colors"
                    >
                      🎵 @{user.tiktok_handle}
                    </a>
                  )}
                  {user.youtube_handle && (
                    <a
                      href={user.youtube_handle.startsWith('http') ? user.youtube_handle : `https://youtube.com/@${user.youtube_handle}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800 hover:bg-red-200 transition-colors"
                    >
                      📺 {user.youtube_handle.startsWith('http') ? 'YouTube' : user.youtube_handle}
                    </a>
                  )}
                  {user.website_url && (
                    <a
                      href={user.website_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-100 text-green-800 hover:bg-green-200 transition-colors"
                    >
                      🌐 Website
                    </a>
                  )}
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-6 flex gap-3">
            <button 
              onClick={() => setShowEditProfileForm(true)}
              className="btn btn-primary"
            >
              Edit Profile
            </button>
            <button 
              onClick={() => setShowChangePassword(true)}
              className="btn bg-gray-600 text-white hover:bg-gray-700"
            >
              Change Password
            </button>
          </div>
        </div>
      )}

      {/* Venues Tab */}
      {activeTab === 'venues' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">My Venues</h2>
            <button
              onClick={() => setShowVenueForm(true)}
              className="btn btn-primary"
            >
              Add New Venue
            </button>
          </div>

          {venues.length === 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600 mb-4">You haven't created any venues yet.</p>
              <button
                onClick={() => setShowVenueForm(true)}
                className="btn btn-primary"
              >
                Create Your First Venue
              </button>
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-2">
              {venues.map(venue => (
                <div key={venue.id} className="card">
                  <h3 className="text-lg font-semibold mb-2">{venue.name || 'Unnamed Venue'}</h3>
                  <p className="text-gray-600 mb-2">{venue.address}</p>
                  {venue.description && (
                    <p className="text-gray-700 mb-3">{venue.description}</p>
                  )}
                  <div className="text-sm text-gray-500 mb-4">
                    {venue.capacity && <div>Capacity: {venue.capacity}</div>}
                    {venue.phone && <div>Phone: {venue.phone}</div>}
                  </div>
                  <div className="flex space-x-2">
                    <button 
                      onClick={() => handleEditVenue(venue)}
                      className="btn btn-secondary text-sm"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeleteVenue(venue.id)}
                      className="btn btn-red text-sm"
                    >
                      Delete
                    </button>
                    <button
                      onClick={() => {
                        setSelectedVenue(venue.id)
                        setShowRecurringForm(true)
                        setRecurringForm(prev => ({ ...prev, venueId: venue.id.toString() }))
                      }}
                      className="btn btn-primary text-sm"
                    >
                      Add Recurring Event
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Venue Form Modal */}
          {showVenueForm && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowVenueForm(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">Create New Venue</h3>
                <form onSubmit={handleVenueSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue Name *
                    </label>
                    <input
                      type="text"
                      value={venueForm.name}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address *
                    </label>
                    <textarea
                      value={venueForm.address}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, address: e.target.value }))}
                      className="input"
                      rows={2}
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={venueForm.phone}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={venueForm.email}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, email: e.target.value }))}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={venueForm.description}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      value={venueForm.capacity}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, capacity: e.target.value }))}
                      className="input"
                      min="1"
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <button 
                      type="submit" 
                      className="btn btn-primary flex-1"
                      disabled={submitting}
                    >
                      {submitting ? 'Creating...' : 'Create Venue'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowVenueForm(false)}
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

          {/* Edit Venue Modal */}
          {showEditVenueForm && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowEditVenueForm(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-md max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">Edit Venue</h3>
                <form onSubmit={handleUpdateVenue} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue Name *
                    </label>
                    <input
                      type="text"
                      value={venueForm.name}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, name: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address *
                    </label>
                    <input
                      type="text"
                      value={venueForm.address}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, address: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone
                    </label>
                    <input
                      type="tel"
                      value={venueForm.phone}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, phone: e.target.value }))}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email
                    </label>
                    <input
                      type="email"
                      value={venueForm.email}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, email: e.target.value }))}
                      className="input"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={venueForm.description}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Capacity
                    </label>
                    <input
                      type="number"
                      value={venueForm.capacity}
                      onChange={(e) => setVenueForm(prev => ({ ...prev, capacity: e.target.value }))}
                      className="input"
                      min="1"
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <button 
                      type="submit" 
                      className="btn btn-primary flex-1"
                      disabled={submitting}
                    >
                      {submitting ? 'Updating...' : 'Update Venue'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEditVenueForm(false)}
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

          {/* Edit Event Modal */}
          {showEditEventForm && (
            <div 
              className="fixed top-0 left-0 w-full h-full bg-black bg-opacity-50 flex items-center justify-center p-4"
              style={{ zIndex: 10000 }}
            >
              <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Edit Event</h3>
                <form onSubmit={handleUpdateEvent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sign-up List Mode
                    </label>
                    <select
                      value={eventForm.signupListMode}
                      onChange={(e) => setEventForm(prev => ({ ...prev, signupListMode: e.target.value }))}
                      className="input"
                    >
                      {SIGNUP_LIST_MODES.map(mode => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label} ({mode.description})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue *
                    </label>
                    <select
                      value={eventForm.venueId}
                      onChange={(e) => setEventForm(prev => ({ ...prev, venueId: e.target.value }))}
                      className="input"
                      required
                    >
                      <option value="">Select a venue</option>
                      {venues.map(venue => (
                        <option key={venue.id} value={venue.id}>{venue.name || 'Unnamed Venue'}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      value={eventForm.date}
                      onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <TimePicker
                      value={eventForm.startTime}
                      onChange={(time) => setEventForm(prev => ({ ...prev, startTime: time }))}
                      label="Start Time"
                      required
                    />
                    
                    <TimePicker
                      value={eventForm.endTime}
                      onChange={(time) => setEventForm(prev => ({ ...prev, endTime: time }))}
                      label="End Time"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Performers
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={eventForm.maxPerformers}
                        onChange={(e) => setEventForm(prev => ({ ...prev, maxPerformers: e.target.value }))}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Performance Length (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={eventForm.performanceLength}
                        onChange={(e) => setEventForm(prev => ({ ...prev, performanceLength: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type
                    </label>
                    <select
                      value={eventForm.eventType}
                      onChange={(e) => setEventForm(prev => ({ ...prev, eventType: e.target.value }))}
                      className="input"
                    >
                      {EVENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sign-up List Mode
                    </label>
                    <select
                      value={eventForm.signupListMode}
                      onChange={(e) => setEventForm(prev => ({ ...prev, signupListMode: e.target.value }))}
                      className="input"
                    >
                      {SIGNUP_LIST_MODES.map(mode => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label} ({mode.description})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <button 
                      type="submit" 
                      className="btn btn-primary flex-1"
                      disabled={submitting}
                    >
                      {submitting ? 'Updating...' : 'Update Event'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditEventForm(false)
                        setEditingEvent(null)
                      }}
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
          
          {/* Original Edit Event Form Modal */}
          {false && showEditEventForm && editingEvent && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
              <div className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto">
                <h3 className="text-lg font-semibold mb-4">Edit Event</h3>
                <form onSubmit={handleUpdateEvent} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue *
                    </label>
                    <select
                      value={eventForm.venueId}
                      onChange={(e) => setEventForm(prev => ({ ...prev, venueId: e.target.value }))}
                      className="input"
                      required
                    >
                      <option value="">Select a venue</option>
                      {venues.map(venue => (
                        <option key={venue.id} value={venue.id}>{venue.name || 'Unnamed Venue'}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      value={eventForm.date}
                      onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <TimePicker
                      value={eventForm.startTime}
                      onChange={(time) => setEventForm(prev => ({ ...prev, startTime: time }))}
                      label="Start Time"
                      required
                    />
                    
                    <TimePicker
                      value={eventForm.endTime}
                      onChange={(time) => setEventForm(prev => ({ ...prev, endTime: time }))}
                      label="End Time"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Performers
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={eventForm.maxPerformers}
                        onChange={(e) => setEventForm(prev => ({ ...prev, maxPerformers: e.target.value }))}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Performance Length (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={eventForm.performanceLength}
                        onChange={(e) => setEventForm(prev => ({ ...prev, performanceLength: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type
                    </label>
                    <select
                      value={eventForm.eventType}
                      onChange={(e) => setEventForm(prev => ({ ...prev, eventType: e.target.value }))}
                      className="input"
                    >
                      {EVENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sign-up Opens Time (leave empty for immediate access)
                      </label>
                      <input
                        type="time"
                        value={eventForm.signupOpens}
                        onChange={(e) => setEventForm(prev => ({ ...prev, signupOpens: e.target.value }))}
                        className="input"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to allow immediate signups</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sign-up Deadline Time (leave empty for no deadline)
                      </label>
                      <input
                        type="time"
                        value={eventForm.signupDeadline}
                        onChange={(e) => setEventForm(prev => ({ ...prev, signupDeadline: e.target.value }))}
                        className="input"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for no signup deadline</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <button 
                      type="submit" 
                      className="btn btn-primary flex-1"
                      disabled={submitting}
                    >
                      {submitting ? 'Updating...' : 'Update Event'}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowEditEventForm(false)
                        setEditingEvent(null)
                      }}
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

          {/* Recurring Event Form Modal */}
          {showRecurringForm && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowRecurringForm(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">Create Recurring Event</h3>
                <form onSubmit={handleRecurringSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={recurringForm.title}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, title: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue *
                    </label>
                    <select
                      value={recurringForm.venueId}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, venueId: e.target.value }))}
                      className="input"
                      required
                    >
                      <option value="">Select a venue</option>
                      {venues.map(venue => (
                        <option key={venue.id} value={venue.id}>{venue.name || 'Unnamed Venue'}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <TimePicker
                      value={recurringForm.startTime}
                      onChange={(time) => setRecurringForm(prev => ({ ...prev, startTime: time }))}
                      label="Start Time"
                      required
                    />
                    
                    <TimePicker
                      value={recurringForm.endTime}
                      onChange={(time) => setRecurringForm(prev => ({ ...prev, endTime: time }))}
                      label="End Time"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Day of Week *
                    </label>
                    <select
                      value={recurringForm.dayOfWeek}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, dayOfWeek: e.target.value }))}
                      className="input"
                      required
                    >
                      {DAYS_OF_WEEK.map(day => (
                        <option key={day.value} value={day.value}>{day.label}</option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">Events will repeat every week on this day</p>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Performers
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={recurringForm.maxPerformers}
                        onChange={(e) => setRecurringForm(prev => ({ ...prev, maxPerformers: e.target.value }))}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Performance Length (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={recurringForm.performanceLength}
                        onChange={(e) => setRecurringForm(prev => ({ ...prev, performanceLength: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type
                    </label>
                    <select
                      value={recurringForm.eventType}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, eventType: e.target.value }))}
                      className="input"
                    >
                      {EVENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sign-up List Mode
                    </label>
                    <select
                      value={recurringForm.signupListMode}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, signupListMode: e.target.value }))}
                      className="input"
                    >
                      {SIGNUP_LIST_MODES.map(mode => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label} ({mode.description})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sign-up Opens Time (leave empty for immediate access)
                      </label>
                      <TimePicker
                        value={recurringForm.signupOpens}
                        onChange={(time) => setRecurringForm(prev => ({ ...prev, signupOpens: time }))}
                        label=""
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to allow immediate signups</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sign-up Deadline Time (leave empty for no deadline)
                      </label>
                      <TimePicker
                        value={recurringForm.signupDeadline}
                        onChange={(time) => setRecurringForm(prev => ({ ...prev, signupDeadline: time }))}
                        label=""
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for no signup deadline</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={recurringForm.description}
                      onChange={(e) => setRecurringForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input"
                      rows={3}
                    />
                  </div>
                  
                  <div className="flex space-x-3 pt-4">
                    <button 
                      type="submit" 
                      className="btn btn-primary flex-1"
                      disabled={submitting}
                    >
                      {submitting ? 'Creating...' : 'Create Recurring Event'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowRecurringForm(false)}
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
      )}

      {/* Events Tab */}
      {activeTab === 'events' && (
        <div>
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold">My Events</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setShowEventForm(true)}
                className="btn btn-secondary"
                disabled={venues.length === 0}
              >
                Add One-Time Event
              </button>
              <button
                onClick={() => setShowRecurringForm(true)}
                className="btn btn-primary"
                disabled={venues.length === 0}
              >
                Add Recurring Event
              </button>
            </div>
          </div>

          {venues.length === 0 && (
            <div className="card text-center py-8 mb-6">
              <p className="text-gray-600">You need to create a venue first before adding events.</p>
              <button
                onClick={() => setActiveTab('venues')}
                className="btn btn-primary mt-4"
              >
                Create a Venue
              </button>
            </div>
          )}

          {events.length === 0 && venues.length > 0 ? (
            <div className="card text-center py-12">
              <p className="text-gray-600 mb-4">You haven't created any events yet.</p>
              <button
                onClick={() => setShowEventForm(true)}
                className="btn btn-primary"
              >
                Create Your First Event
              </button>
            </div>
          ) : (
            <div className="grid gap-4">
              {events.map(event => (
                <div key={event.id} className="card">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold">{event.title}</h3>
                      <p className="text-gray-600">{event.venue_name}</p>
                      <div className="text-sm text-gray-500 mt-2">
                        <div>{formatDate(event.date)} at {formatTime12Hour(event.start_time)}</div>
                        <div>{event.current_signups}/{event.max_performers} performers signed up</div>
                      </div>
                    </div>
                    <div className="flex space-x-2">
                      <button 
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleEditEvent(event)
                        }}
                        className="btn btn-secondary text-sm"
                        type="button"
                      >
                        Edit
                      </button>
                      <a 
                        href={`/events/${event.id}`}
                        className="btn btn-primary text-sm"
                      >
                        View
                      </a>
                      <button 
                        onClick={() => handleDeleteEvent(event.id)}
                        className="btn bg-red-600 text-white hover:bg-red-700 text-sm"
                        disabled={submitting}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* One-Time Event Form Modal */}
          {showEventForm && (
            <div 
              className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
              onClick={() => setShowEventForm(false)}
            >
              <div 
                className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-lg font-semibold mb-4">Create One-Time Event</h3>
                <form onSubmit={handleEventSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Title *
                    </label>
                    <input
                      type="text"
                      value={eventForm.title}
                      onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Venue *
                    </label>
                    <select
                      value={eventForm.venueId}
                      onChange={(e) => setEventForm(prev => ({ ...prev, venueId: e.target.value }))}
                      className="input"
                      required
                    >
                      <option value="">Select a venue</option>
                      {venues.map(venue => (
                        <option key={venue.id} value={venue.id}>{venue.name || 'Unnamed Venue'}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Date *
                    </label>
                    <input
                      type="date"
                      value={eventForm.date}
                      onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                      className="input"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <TimePicker
                      value={eventForm.startTime}
                      onChange={(time) => setEventForm(prev => ({ ...prev, startTime: time }))}
                      label="Start Time"
                      required
                    />
                    
                    <TimePicker
                      value={eventForm.endTime}
                      onChange={(time) => setEventForm(prev => ({ ...prev, endTime: time }))}
                      label="End Time"
                      required
                    />
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Max Performers
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={eventForm.maxPerformers}
                        onChange={(e) => setEventForm(prev => ({ ...prev, maxPerformers: e.target.value }))}
                        className="input"
                      />
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Performance Length (min)
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={eventForm.performanceLength}
                        onChange={(e) => setEventForm(prev => ({ ...prev, performanceLength: e.target.value }))}
                        className="input"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Event Type
                    </label>
                    <select
                      value={eventForm.eventType}
                      onChange={(e) => setEventForm(prev => ({ ...prev, eventType: e.target.value }))}
                      className="input"
                    >
                      {EVENT_TYPES.map(type => (
                        <option key={type.value} value={type.value}>{type.label}</option>
                      ))}
                    </select>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Sign-up List Mode
                    </label>
                    <select
                      value={eventForm.signupListMode}
                      onChange={(e) => setEventForm(prev => ({ ...prev, signupListMode: e.target.value }))}
                      className="input"
                    >
                      {SIGNUP_LIST_MODES.map(mode => (
                        <option key={mode.value} value={mode.value}>
                          {mode.label} ({mode.description})
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sign-up Opens Time (leave empty for immediate access)
                      </label>
                      <input
                        type="time"
                        value={eventForm.signupOpens}
                        onChange={(e) => setEventForm(prev => ({ ...prev, signupOpens: e.target.value }))}
                        className="input"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty to allow immediate signups</p>
                    </div>
                    
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Sign-up Deadline Time (leave empty for no deadline)
                      </label>
                      <input
                        type="time"
                        value={eventForm.signupDeadline}
                        onChange={(e) => setEventForm(prev => ({ ...prev, signupDeadline: e.target.value }))}
                        className="input"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for no signup deadline</p>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Description
                    </label>
                    <textarea
                      value={eventForm.description}
                      onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                      className="input"
                      rows={3}
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Co-hosts (optional)
                    </label>
                    <p className="text-xs text-gray-500 mb-3">
                      Add other users as co-hosts to help manage this event
                    </p>
                    
                    {/* Selected Co-hosts */}
                    {selectedCohosts.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-2">
                          {selectedCohosts.map(cohost => (
                            <div
                              key={cohost.id}
                              className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                            >
                              <span>{cohost.name || 'Unknown User'}</span>
                              <button
                                type="button"
                                onClick={() => removeCohost(cohost.id)}
                                className="text-blue-600 hover:text-blue-800"
                              >
                                ×
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {/* Co-host Search */}
                    <div className="relative">
                      <input
                        type="text"
                        value={cohostSearch}
                        onChange={(e) => {
                          setCohostSearch(e.target.value)
                          searchCohosts(e.target.value)
                        }}
                        placeholder="Search for users by name or email..."
                        className="input"
                      />
                      
                      {/* Search Results */}
                      {(cohostResults.length > 0 || (cohostSearch.length >= 2 && isValidEmail(cohostSearch) && cohostResults.length === 0 && !searchingCohosts)) && (
                        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                          {cohostResults.map(user => (
                            <button
                              key={user.id}
                              type="button"
                              onClick={() => addCohost(user)}
                              className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                            >
                              <div>
                                <div className="font-medium">{user.name}</div>
                                <div className="text-sm text-gray-500">{user.email}</div>
                              </div>
                            </button>
                          ))}
                          
                          {/* Email Invitation Option */}
                          {cohostResults.length === 0 && isValidEmail(cohostSearch) && !searchingCohosts && (
                            <button
                              type="button"
                              onClick={() => sendInvitationEmail(cohostSearch, 'cohost')}
                              className="w-full px-3 py-2 text-left hover:bg-blue-50 border-t border-gray-200"
                              disabled={submitting}
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                                  <span className="text-blue-600 text-sm">✉</span>
                                </div>
                                <div>
                                  <div className="font-medium text-blue-600">
                                    Invite "{cohostSearch}" to join
                                  </div>
                                  <div className="text-sm text-gray-500">
                                    Send an invitation email to this address
                                  </div>
                                </div>
                              </div>
                            </button>
                          )}
                        </div>
                      )}
                      
                      {searchingCohosts && (
                        <div className="absolute right-3 top-3">
                          <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Invite Management for Booked Mic */}
                  {eventForm.signupListMode === 'booked_mic' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Invite Performers
                      </label>
                      <p className="text-xs text-gray-500 mb-3">
                        Search for users to invite to this booked mic event
                      </p>
                      
                      {/* Selected Invites */}
                      {selectedPerformers.length > 0 && (
                        <div className="mb-3">
                          <p className="text-sm font-medium text-gray-700 mb-2">Performers to invite:</p>
                          <div className="flex flex-wrap gap-2">
                            {selectedPerformers.map(performer => (
                              <div
                                key={performer.id}
                                className="flex items-center space-x-2 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm"
                              >
                                <span>{performer.name || 'Unknown User'}</span>
                                <button
                                  type="button"
                                  onClick={() => removePerformer(performer.id)}
                                  className="text-green-600 hover:text-green-800"
                                >
                                  ×
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      
                      {/* Performer Search */}
                      <div className="relative">
                        <input
                          type="text"
                          value={performerSearch}
                          onChange={(e) => {
                            setPerformerSearch(e.target.value)
                            searchPerformers(e.target.value)
                          }}
                          placeholder="Search for performers to invite..."
                          className="input"
                        />
                        
                        {/* Search Results */}
                        {(performerResults.length > 0 || (performerSearch.length >= 2 && isValidEmail(performerSearch) && performerResults.length === 0 && !searchingPerformers)) && (
                          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                            {performerResults.map(user => (
                              <button
                                key={user.id}
                                type="button"
                                onClick={() => addPerformerInvite(user)}
                                className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                              >
                                <div>
                                  <div className="font-medium">{user.name}</div>
                                  <div className="text-sm text-gray-500">{user.email}</div>
                                  {user.performer_type && (
                                    <div className="text-xs text-gray-400 capitalize">{user.performer_type}</div>
                                  )}
                                </div>
                              </button>
                            ))}
                            
                            {/* Email Invitation Option */}
                            {performerResults.length === 0 && isValidEmail(performerSearch) && !searchingPerformers && (
                              <button
                                type="button"
                                onClick={() => sendInvitationEmail(performerSearch, 'performer')}
                                className="w-full px-3 py-2 text-left hover:bg-green-50 border-t border-gray-200"
                                disabled={submitting}
                              >
                                <div className="flex items-center space-x-2">
                                  <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                    <span className="text-green-600 text-sm">✉</span>
                                  </div>
                                  <div>
                                    <div className="font-medium text-green-600">
                                      Invite "{performerSearch}" to join
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Send an invitation email to this performer
                                    </div>
                                  </div>
                                </div>
                              </button>
                            )}
                          </div>
                        )}
                        
                        {searchingPerformers && (
                          <div className="absolute right-3 top-3">
                            <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                          </div>
                        )}
                      </div>
                      
                      <p className="text-xs text-gray-500 mt-2">
                        Note: Invites will be sent after the event is created. Invited users can accept or decline.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex space-x-3 pt-4">
                    <button 
                      type="submit" 
                      className="btn btn-primary flex-1"
                      disabled={submitting}
                    >
                      {submitting ? 'Creating...' : 'Create Event'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setShowEventForm(false)}
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
      )}

      {/* Signups Tab */}
      {activeTab === 'signups' && (
        <div>
          <h2 className="text-xl font-semibold mb-6">My Performance Signups</h2>
          
          {/* Signups Sub-tabs */}
          <div className="border-b border-gray-200 mb-6">
            <nav className="-mb-px flex space-x-8">
              <button
                onClick={() => setSignupsTab('upcoming')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  signupsTab === 'upcoming'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Upcoming Shows
              </button>
              <button
                onClick={() => setSignupsTab('past')}
                className={`py-2 px-1 border-b-2 font-medium text-sm ${
                  signupsTab === 'past'
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                Past Performances
              </button>
            </nav>
          </div>

          {(() => {
            const now = new Date()
            const upcomingSignups = signups.filter(signup => {
              if (!signup.event_date) return true // Show if no date available
              const eventDate = new Date(signup.event_date)
              return eventDate >= now
            })
            const pastSignups = signups.filter(signup => {
              if (!signup.event_date) return false // Don't show in past if no date
              const eventDate = new Date(signup.event_date)
              return eventDate < now
            })

            const currentSignups = signupsTab === 'upcoming' ? upcomingSignups : pastSignups
            const emptyMessage = signupsTab === 'upcoming' 
              ? "You don't have any upcoming performances." 
              : "You don't have any past performances yet."

            return currentSignups.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-600 mb-4">{emptyMessage}</p>
                {signupsTab === 'upcoming' && (
                  <a href="/events" className="btn btn-primary">
                    Browse Events
                  </a>
                )}
              </div>
            ) : (
              <div className="grid gap-4">
                {currentSignups.map(signup => (
                  <div key={signup.id} className="card">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="text-lg font-semibold">{signup.event_title}</h3>
                        <p className="text-gray-600">{signup.venue_name}</p>
                        <p className="text-gray-700 mt-1">Performance: "{signup.performance_name}"</p>
                        <div className="text-sm text-gray-500 mt-2">
                          {signup.event_date && <div>{formatDate(signup.event_date)}</div>}
                          <div>Status: <span className="capitalize">{signup.status}</span></div>
                          {signupsTab === 'past' && signup.is_finished && (
                            <div className="text-green-600">✅ Performance completed</div>
                          )}
                        </div>
                      </div>
                      <div className="flex space-x-2">
                        {signupsTab === 'upcoming' && (
                          <button className="btn btn-secondary text-sm">Edit</button>
                        )}
                        <a 
                          href={`/events/${signup.event_id}`}
                          className="btn btn-primary text-sm"
                        >
                          View Event
                        </a>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>
      )}

      {/* Profile Edit Form Modal */}
      {showEditProfileForm && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => setShowEditProfileForm(false)}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Edit Profile</h3>
            <form onSubmit={handleProfileSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={profileForm.name}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, name: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={profileForm.phone}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, phone: e.target.value }))}
                  className="input"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performer Type
                </label>
                <select
                  value={profileForm.performer_type}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, performer_type: e.target.value }))}
                  className="input"
                >
                  <option value="">Select performer type</option>
                  {PERFORMER_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bio
                </label>
                <textarea
                  value={profileForm.bio}
                  onChange={(e) => setProfileForm(prev => ({ ...prev, bio: e.target.value }))}
                  className="input"
                  rows={3}
                  placeholder="Tell us about yourself and your performances..."
                />
              </div>
              
              <div className="border-t pt-4">
                <h4 className="text-md font-medium text-gray-900 mb-3">Social Media</h4>
                
                <div className="grid grid-cols-1 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Instagram Handle
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">@</span>
                      <input
                        type="text"
                        value={profileForm.instagram_handle}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, instagram_handle: e.target.value }))}
                        className="input pl-8"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Twitter Handle
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">@</span>
                      <input
                        type="text"
                        value={profileForm.twitter_handle}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, twitter_handle: e.target.value }))}
                        className="input pl-8"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      TikTok Handle
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">@</span>
                      <input
                        type="text"
                        value={profileForm.tiktok_handle}
                        onChange={(e) => setProfileForm(prev => ({ ...prev, tiktok_handle: e.target.value }))}
                        className="input pl-8"
                        placeholder="username"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      YouTube Channel
                    </label>
                    <input
                      type="text"
                      value={profileForm.youtube_handle}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, youtube_handle: e.target.value }))}
                      className="input"
                      placeholder="@username or full URL"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Website URL
                    </label>
                    <input
                      type="url"
                      value={profileForm.website_url}
                      onChange={(e) => setProfileForm(prev => ({ ...prev, website_url: e.target.value }))}
                      className="input"
                      placeholder="https://yourwebsite.com"
                    />
                  </div>
                </div>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update Profile'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditProfileForm(false)}
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
      
      {/* Edit Event Modal */}
      {showEditEventForm && editingEvent && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          onClick={() => {
            setShowEditEventForm(false)
            setEditingEvent(null)
          }}
        >
          <div 
            className="bg-white rounded-lg p-6 w-full max-w-lg max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Edit Event</h3>
            <form onSubmit={handleUpdateEvent} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={eventForm.title}
                  onChange={(e) => setEventForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Venue *
                </label>
                <select
                  value={eventForm.venueId}
                  onChange={(e) => setEventForm(prev => ({ ...prev, venueId: e.target.value }))}
                  className="input"
                  required
                >
                  <option value="">Select a venue</option>
                  {venues.map(venue => (
                    <option key={venue.id} value={venue.id}>{venue.name || 'Unnamed Venue'}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Date *
                </label>
                <input
                  type="date"
                  value={eventForm.date}
                  onChange={(e) => setEventForm(prev => ({ ...prev, date: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <TimePicker
                  value={eventForm.startTime}
                  onChange={(time) => setEventForm(prev => ({ ...prev, startTime: time }))}
                  label="Start Time"
                  required
                />
                
                <TimePicker
                  value={eventForm.endTime}
                  onChange={(time) => setEventForm(prev => ({ ...prev, endTime: time }))}
                  label="End Time"
                  required
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Performers
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={eventForm.maxPerformers}
                    onChange={(e) => setEventForm(prev => ({ ...prev, maxPerformers: e.target.value }))}
                    className="input"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Performance Length (min)
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={eventForm.performanceLength}
                    onChange={(e) => setEventForm(prev => ({ ...prev, performanceLength: e.target.value }))}
                    className="input"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Type
                </label>
                <select
                  value={eventForm.eventType}
                  onChange={(e) => setEventForm(prev => ({ ...prev, eventType: e.target.value }))}
                  className="input"
                >
                  {EVENT_TYPES.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Sign-up List Mode
                </label>
                <select
                  value={eventForm.signupListMode}
                  onChange={(e) => setEventForm(prev => ({ ...prev, signupListMode: e.target.value }))}
                  className="input"
                >
                  {SIGNUP_LIST_MODES.map(mode => (
                    <option key={mode.value} value={mode.value}>
                      {mode.label} ({mode.description})
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={eventForm.description}
                  onChange={(e) => setEventForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Co-hosts (optional)
                </label>
                <p className="text-xs text-gray-500 mb-3">
                  Add other users as co-hosts to help manage this event
                </p>
                
                {/* Selected Co-hosts */}
                {selectedCohosts.length > 0 && (
                  <div className="mb-3">
                    <div className="flex flex-wrap gap-2">
                      {selectedCohosts.map(cohost => (
                        <div
                          key={cohost.id}
                          className="flex items-center space-x-2 bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm"
                        >
                          <span>{cohost.name || 'Unknown User'}</span>
                          <button
                            type="button"
                            onClick={() => removeCohost(cohost.id)}
                            className="text-blue-600 hover:text-blue-800"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                
                {/* Co-host Search */}
                <div className="relative">
                  <input
                    type="text"
                    value={cohostSearch}
                    onChange={(e) => {
                      setCohostSearch(e.target.value)
                      searchCohosts(e.target.value)
                    }}
                    placeholder="Search for users by name or email..."
                    className="input"
                  />
                  
                  {/* Search Results */}
                  {(cohostResults.length > 0 || (cohostSearch.length >= 2 && isValidEmail(cohostSearch) && cohostResults.length === 0 && !searchingCohosts)) && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                      {cohostResults.map(user => (
                        <button
                          key={user.id}
                          type="button"
                          onClick={() => addCohost(user)}
                          className="w-full px-3 py-2 text-left hover:bg-gray-100 flex items-center justify-between"
                        >
                          <div>
                            <div className="font-medium">{user.name}</div>
                            <div className="text-sm text-gray-500">{user.email}</div>
                          </div>
                        </button>
                      ))}
                      
                      {/* Email Invitation Option */}
                      {cohostResults.length === 0 && isValidEmail(cohostSearch) && !searchingCohosts && (
                        <button
                          type="button"
                          onClick={() => sendInvitationEmail(cohostSearch, 'cohost')}
                          className="w-full px-3 py-2 text-left hover:bg-blue-50 border-t border-gray-200"
                          disabled={submitting}
                        >
                          <div className="flex items-center space-x-2">
                            <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                              <span className="text-blue-600 text-sm">✉</span>
                            </div>
                            <div>
                              <div className="font-medium text-blue-600">
                                Invite "{cohostSearch}" to join
                              </div>
                              <div className="text-sm text-gray-500">
                                Send an invitation email to this address
                              </div>
                            </div>
                          </div>
                        </button>
                      )}
                    </div>
                  )}
                  
                  {searchingCohosts && (
                    <div className="absolute right-3 top-3">
                      <div className="animate-spin h-4 w-4 border-2 border-primary-500 border-t-transparent rounded-full"></div>
                    </div>
                  )}
                </div>
              </div>
              
              <div className="flex space-x-3 pt-4">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update Event'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowEditEventForm(false)
                    setEditingEvent(null)
                  }}
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
      
      {showChangePassword && (
        <ChangePassword
          onClose={() => setShowChangePassword(false)}
          onSuccess={() => {
            setShowChangePassword(false)
            alert('Password changed successfully! Please log in again.')
            // Note: In a real app, you'd want to handle logout more gracefully
            localStorage.removeItem('token')
            window.location.href = '/login'
          }}
        />
      )}
    </div>
  )
}
