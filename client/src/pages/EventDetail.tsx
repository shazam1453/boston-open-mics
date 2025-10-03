import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { eventsAPI, signupsAPI, chatAPI, usersAPI, invitationsAPI } from '../utils/api'
import { useAuth } from '../hooks/useAuth'
import { formatTime12Hour, formatDate, formatTimeOnly12Hour } from '../utils/dateTime'
import { PERFORMANCE_TYPES } from '../constants/formOptions'
import type { Event, Signup } from '../types'

export default function EventDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const [event, setEvent] = useState<Event | null>(null)
  const [signups, setSignups] = useState<Signup[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showAddPerformerForm, setShowAddPerformerForm] = useState(false)
  const [showSignupForm, setShowSignupForm] = useState(false)
  const [userSignup, setUserSignup] = useState<Signup | null>(null)

  const [joiningGroupChat, setJoiningGroupChat] = useState(false)
  const [showWalkInForm, setShowWalkInForm] = useState(false)
  const [showCreateGroupChat, setShowCreateGroupChat] = useState(false)
  const [showEditEventForm, setShowEditEventForm] = useState(false)
  const [showAddParticipantsModal, setShowAddParticipantsModal] = useState(false)
  const [hasGroupChat, setHasGroupChat] = useState(false)
  const [addPerformerForm, setAddPerformerForm] = useState({
    performanceName: '',
    performerName: '',
    performanceType: 'music',
    notes: ''
  })
  const [signupForm, setSignupForm] = useState({
    performerName: '',
    performanceType: 'music',
    notes: ''
  })
  const [walkInForm, setWalkInForm] = useState({
    performerName: '',
    performanceName: '',
    performanceType: 'music',
    notes: ''
  })
  const [addParticipantsForm, setAddParticipantsForm] = useState({
    performanceName: '',
    performerName: '',
    performanceType: 'music',
    notes: ''
  })
  const [editEventForm, setEditEventForm] = useState({
    title: '',
    description: '',
    maxPerformers: 10,
    performanceLength: 5
  })
  
  // Performer search for booked mic events
  const [performerSearch, setPerformerSearch] = useState('')
  const [performerResults, setPerformerResults] = useState<any[]>([])
  const [selectedPerformers, setSelectedPerformers] = useState<any[]>([])

  useEffect(() => {
    const fetchEventData = async () => {
      if (!id) return
      
      try {
        const [eventResponse, signupsResponse] = await Promise.all([
          eventsAPI.getById(id),
          signupsAPI.getByEvent(id)
        ])
        
        setEvent(eventResponse.data)
        setSignups(signupsResponse.data)
        
        // Populate edit form with current event data
        setEditEventForm({
          title: eventResponse.data.title || '',
          description: eventResponse.data.description || '',
          maxPerformers: eventResponse.data.max_performers || 10,
          performanceLength: eventResponse.data.performance_length || 5
        })
        
        // Check if current user is already signed up
        if (user) {
          const existingSignup = signupsResponse.data.find(signup => signup.user_id === user.id)
          setUserSignup(existingSignup || null)
        }

        // Check if event has a group chat (for hosts)
        if (user && eventResponse.data.host_id === user.id) {
          try {
            await chatAPI.getEventGroupChat(id)
            setHasGroupChat(true)
          } catch (error) {
            // No group chat exists yet
            setHasGroupChat(false)
          }
        }
      } catch (err) {
        setError('Failed to load event')
        console.error('Error fetching event:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchEventData()
  }, [id])

  // Update user signup status when user changes
  useEffect(() => {
    if (user && signups.length > 0) {
      const existingSignup = signups.find(signup => signup.user_id === user.id)
      setUserSignup(existingSignup || null)
    } else {
      setUserSignup(null)
    }
  }, [user, signups])

  const isHost = user && event && user.id === event.host_id

  const handleStartEvent = async () => {
    if (!event || !isHost) return
    
    setSubmitting(true)
    try {
      const response = await eventsAPI.startEvent(event.id)
      setEvent(response.data.event)
    } catch (error) {
      console.error('Error starting event:', error)
      setError('Failed to start event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleFinishEvent = async () => {
    if (!event || !isHost) return
    
    setSubmitting(true)
    try {
      const response = await eventsAPI.finishEvent(event.id)
      setEvent(response.data.event)
    } catch (error) {
      console.error('Error finishing event:', error)
      setError('Failed to finish event')
    } finally {
      setSubmitting(false)
    }
  }

  const handleMarkFinished = async (signupId: string | number) => {
    setSubmitting(true)
    try {
      const response = await signupsAPI.markAsFinished(signupId)
      setSignups(prev => prev.map(signup => 
        signup.id === signupId ? { ...signup, is_finished: true, finished_at: response.data.signup.finished_at } : signup
      ))
    } catch (error) {
      console.error('Error marking performer as finished:', error)
      setError('Failed to mark performer as finished')
    } finally {
      setSubmitting(false)
    }
  }

  const handleUnmarkFinished = async (signupId: string | number) => {
    setSubmitting(true)
    try {
      await signupsAPI.unmarkAsFinished(signupId)
      setSignups(prev => prev.map(signup => 
        signup.id === signupId ? { ...signup, is_finished: false, finished_at: undefined } : signup
      ))
    } catch (error) {
      console.error('Error unmarking performer as finished:', error)
      setError('Failed to unmark performer as finished')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddPerformer = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return
    
    setSubmitting(true)
    try {
      const response = await signupsAPI.addManualPerformer(event.id, addPerformerForm)
      setSignups(prev => [...prev, response.data.signup])
      setShowAddPerformerForm(false)
      setAddPerformerForm({
        performanceName: '',
        performerName: '',
        performanceType: 'music',
        notes: ''
      })
    } catch (error) {
      console.error('Error adding performer:', error)
      setError('Failed to add performer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddParticipants = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return
    
    setSubmitting(true)
    try {
      // Use performer name as performance name if performance name is empty
      const performanceData = {
        ...addParticipantsForm,
        performanceName: addParticipantsForm.performanceName || addParticipantsForm.performerName
      }
      
      console.log('Adding participant with data:', performanceData)
      console.log('Event ID:', event.id)
      
      const response = await signupsAPI.addManualPerformer(event.id, performanceData)
      console.log('Add participant response:', response)
      
      setSignups(prev => [...prev, response.data.signup])
      setShowAddParticipantsModal(false)
      setAddParticipantsForm({
        performanceName: '',
        performerName: '',
        performanceType: 'music',
        notes: ''
      })
    } catch (error: any) {
      console.error('Error adding participant:', error)
      console.error('Error response:', error.response?.data)
      console.error('Error status:', error.response?.status)
      setError(`Failed to add participant: ${error.response?.data?.message || error.message}`)
    } finally {
      setSubmitting(false)
    }
  }

  const handleEditEvent = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event) return
    
    setSubmitting(true)
    try {
      // Update event details
      const response = await eventsAPI.update(event.id, {
        title: editEventForm.title,
        description: editEventForm.description,
        max_performers: editEventForm.maxPerformers,
        performance_length: editEventForm.performanceLength
      })
      setEvent(response.data.event)
      
      // Send invitations for booked mic events
      if (event.signup_list_mode === 'booked_mic' && selectedPerformers.length > 0) {
        await sendInvitations()
      }
      
      setShowEditEventForm(false)
    } catch (error) {
      console.error('Error updating event:', error)
      setError('Failed to update event')
    } finally {
      setSubmitting(false)
    }
  }

  // Performer search functions for booked mic events
  const searchPerformers = async (query: string) => {
    if (query.length < 2) {
      setPerformerResults([])
      return
    }

    try {
      const response = await usersAPI.search(query)
      setPerformerResults(response.data)
    } catch (error) {
      console.error('Error searching performers:', error)
      setPerformerResults([])
    }
  }

  const addPerformerInvite = (performer: any) => {
    if (selectedPerformers.some(p => p.id === performer.id)) {
      return // Already added
    }
    setSelectedPerformers(prev => [...prev, performer])
    setPerformerSearch('')
    setPerformerResults([])
  }

  const removePerformer = (performerId: string | number) => {
    setSelectedPerformers(prev => prev.filter(p => p.id !== performerId))
  }

  const sendInvitations = async () => {
    if (!event || selectedPerformers.length === 0) return

    try {
      for (const performer of selectedPerformers) {
        await invitationsAPI.create({
          eventId: event.id,
          inviteeId: performer.id,
          type: 'performer',
          message: `You've been invited to perform at "${event.title}"`
        })
      }
      setSelectedPerformers([])
      setPerformerSearch('')
      setPerformerResults([])
    } catch (error) {
      console.error('Error sending invitations:', error)
      setError('Failed to send invitations')
    }
  }

  // const handleReorderSignups = async (_newOrder: Signup[]) => {
  //   if (!event || !isHost) return
  //   
  //   const signupIds = _newOrder.map((signup: Signup) => signup.id)
  //   
  //   try {
  //     await signupsAPI.updatePerformerOrder(event.id, signupIds)
  //     setSignups(_newOrder)
  //   } catch (error) {
  //     console.error('Error reordering performers:', error)
  //     setError('Failed to reorder performers')
  //   }
  // }

  // const handleSetCurrentPerformer = async (_signupId: number) => {
  //   if (!event || !isHost) return
  //   
  //   setSubmitting(true)
  //   try {
  //     const response = await eventsAPI.setCurrentPerformer(event.id, _signupId)
  //     setEvent(response.data.event)
  //     
  //     // Update signups to reflect current performer
  //     setSignups(prev => prev.map(signup => ({
  //       ...signup,
  //       is_current_performer: signup.id === _signupId,
  //       status: signup.id === _signupId ? 'performing' : signup.status
  //     })))
  //   } catch (error) {
  //     console.error('Error setting current performer:', error)
  //     setError('Failed to set current performer')
  //   } finally {
  //     setSubmitting(false)
  //   }
  // }

  const handleSelectRandomPerformer = async () => {
    if (!event || !isHost) return
    
    const availablePerformers = sortedSignups.filter(s => !s.is_finished && !s.is_current_performer)
    if (availablePerformers.length === 0) return
    
    setSubmitting(true)
    try {
      // First, mark the current performer as finished (if there is one)
      const currentPerformer = sortedSignups.find(s => s.is_current_performer)
      if (currentPerformer) {
        await signupsAPI.markAsFinished(currentPerformer.id)
      }
      
      // Then randomly select and set the next performer
      const randomIndex = Math.floor(Math.random() * availablePerformers.length)
      const selectedPerformer = availablePerformers[randomIndex]
      
      const response = await eventsAPI.setCurrentPerformer(event.id, selectedPerformer.id)
      setEvent(response.data.event)
      
      // Update signups to reflect the changes
      setSignups(prev => prev.map(signup => ({
        ...signup,
        is_current_performer: signup.id === selectedPerformer.id,
        is_finished: signup.id === currentPerformer?.id ? true : signup.is_finished,
        finished_at: signup.id === currentPerformer?.id ? new Date().toISOString() : signup.finished_at,
        status: signup.id === selectedPerformer.id ? 'performing' : 
                signup.id === currentPerformer?.id ? 'performed' : signup.status
      })))
    } catch (error) {
      console.error('Error selecting next performer:', error)
      setError('Failed to select next performer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleRandomizeOrder = async () => {
    if (!event || !isHost) return
    
    setSubmitting(true)
    try {
      const response = await eventsAPI.randomizeOrder(event.id)
      setSignups(response.data.signups)
    } catch (error) {
      console.error('Error randomizing order:', error)
      setError('Failed to randomize performer order')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event || !user) return
    
    setSubmitting(true)
    try {
      const response = await signupsAPI.create({
        eventId: event.id,
        performanceName: signupForm.performerName,
        performanceType: signupForm.performanceType,
        notes: signupForm.notes
      })
      
      setSignups(prev => [...prev, response.data.signup])
      setUserSignup(response.data.signup)
      setShowSignupForm(false)
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

  const handleCancelSignup = async () => {
    if (!event || !user || !userSignup) return
    
    if (!confirm('Are you sure you want to cancel your signup? This action cannot be undone.')) {
      return
    }
    
    setSubmitting(true)
    try {
      await signupsAPI.cancel(event.id)
      setSignups(prev => prev.filter(signup => signup.user_id !== user.id))
      setUserSignup(null)
    } catch (error: any) {
      console.error('Error canceling signup:', error)
      setError(error.response?.data?.message || 'Failed to cancel signup')
    } finally {
      setSubmitting(false)
    }
  }

  // Booked mic management functions
  const [draggedSignupId, setDraggedSignupId] = useState<string | number | null>(null)

  const handleDragStart = (e: React.DragEvent, signupId: string | number) => {
    setDraggedSignupId(signupId)
    e.dataTransfer.effectAllowed = 'move'
  }

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    e.dataTransfer.dropEffect = 'move'
  }

  const handleDrop = (e: React.DragEvent, dropIndex: number) => {
    e.preventDefault()
    if (!draggedSignupId) return

    const draggedIndex = sortedSignups.findIndex(s => s.id === draggedSignupId)
    if (draggedIndex === -1 || draggedIndex === dropIndex) return

    // Reorder signups
    const newSignups = [...sortedSignups]
    const [draggedSignup] = newSignups.splice(draggedIndex, 1)
    newSignups.splice(dropIndex, 0, draggedSignup)

    // Update performance orders
    const updatedSignups = newSignups.map((signup, index) => ({
      ...signup,
      performance_order: index + 1
    }))

    setSignups(prev => {
      const otherSignups = prev.filter(s => s.event_id !== event?.id)
      return [...otherSignups, ...updatedSignups]
    })

    setDraggedSignupId(null)
  }

  const handleUpdatePerformerLength = async (signupId: string | number, length: number) => {
    if (!event || !isHost) return

    try {
      await eventsAPI.updatePerformerLength(signupId, length)
      setSignups(prev => prev.map(signup => 
        signup.id === signupId 
          ? { ...signup, individual_performance_length: length }
          : signup
      ))
    } catch (error) {
      console.error('Error updating performer length:', error)
      setError('Failed to update performance length')
    }
  }

  const handleCreateGroupChat = async () => {
    if (!event || !user) return
    
    setJoiningGroupChat(true)
    try {
      await chatAPI.createEventGroupChat(event.id)
      setHasGroupChat(true)
      setShowCreateGroupChat(false)
      // Redirect to chat page
      window.location.href = '/chat'
    } catch (error: any) {
      console.error('Error creating group chat:', error)
      setError(error.response?.data?.message || 'Failed to create group chat')
    } finally {
      setJoiningGroupChat(false)
    }
  }

  const handleJoinGroupChat = async () => {
    if (!event || !user) return
    
    setJoiningGroupChat(true)
    try {
      await chatAPI.joinEventGroupChat(event.id)
      // Redirect to chat page
      window.location.href = '/chat'
    } catch (error: any) {
      console.error('Error joining group chat:', error)
      setError(error.response?.data?.message || 'Failed to join group chat')
    } finally {
      setJoiningGroupChat(false)
    }
  }

  const handleRemovePerformer = async (signupId: string | number) => {
    if (!event || !user) return
    
    if (!confirm('Are you sure you want to remove this performer? This action cannot be undone.')) {
      return
    }
    
    setSubmitting(true)
    try {
      await eventsAPI.removePerformer(event.id, signupId)
      setSignups(prev => prev.filter(signup => signup.id !== signupId))
    } catch (error: any) {
      console.error('Error removing performer:', error)
      setError(error.response?.data?.message || 'Failed to remove performer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleAddWalkIn = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!event || !user) return

    setSubmitting(true)
    try {
      const response = await eventsAPI.addWalkIn(event.id, walkInForm)
      const newSignup = response.data.signup
      
      setSignups(prev => [...prev, newSignup])
      setWalkInForm({
        performerName: '',
        performanceName: '',
        performanceType: 'music',
        notes: ''
      })
      setShowWalkInForm(false)
    } catch (error: any) {
      console.error('Error adding walk-in:', error)
      setError(error.response?.data?.message || 'Failed to add walk-in performer')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSavePerformerOrder = async () => {
    if (!event || !isHost) return

    setSubmitting(true)
    try {
      const performerOrder = sortedSignups.map((signup, index) => ({
        signupId: signup.id,
        order: index + 1,
        performanceLength: signup.individual_performance_length
      }))

      await eventsAPI.updatePerformerOrder(event.id, performerOrder)
      setError(null)
    } catch (error) {
      console.error('Error saving performer order:', error)
      setError('Failed to save performer order')
    } finally {
      setSubmitting(false)
    }
  }

  const calculateTotalRuntime = () => {
    return sortedSignups.reduce((total, signup) => {
      return total + (signup.individual_performance_length || event?.performance_length || 5)
    }, 0)
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-64">
        <div className="text-lg">Loading event...</div>
      </div>
    )
  }

  if (error || !event) {
    return (
      <div className="text-center text-red-600">
        <p>{error || 'Event not found'}</p>
      </div>
    )
  }

  // const eventDate = new Date(event.date)
  const confirmedSignups = signups.filter(signup => 
    signup.status === 'confirmed' || signup.status === 'performing' || signup.status === 'performed'
  )
  const isEventFull = confirmedSignups.length >= event.max_performers
  const now = new Date()
  
  // Check signup window status
  const signupOpens = event.signup_opens ? new Date(event.signup_opens) : null
  const signupDeadline = event.signup_deadline ? new Date(event.signup_deadline) : null
  
  const signupsNotOpenYet = signupOpens && signupOpens > now
  const signupsClosed = signupDeadline && signupDeadline < now
  // const signupsOpen = !signupsNotOpenYet && !signupsClosed

  // Sort signups by performance order, then by creation time
  const sortedSignups = [...signups].sort((a, b) => {
    if (a.performance_order && b.performance_order) {
      return a.performance_order - b.performance_order
    }
    if (a.performance_order && !b.performance_order) return -1
    if (!a.performance_order && b.performance_order) return 1
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  })

  return (
    <div className="max-w-6xl mx-auto">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
          {error}
          <button 
            onClick={() => setError(null)}
            className="ml-2 text-red-500 hover:text-red-700"
          >
            ×
          </button>
        </div>
      )}

      <div className="card mb-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              {event.title}
            </h1>
            <div className="flex items-center space-x-3">
              <span className="inline-block bg-primary-100 text-primary-800 px-3 py-1 rounded-full text-sm">
                {event.event_type}
              </span>
              <span className={`inline-block px-3 py-1 rounded-full text-sm ${
                event.event_status === 'live' ? 'bg-green-100 text-green-800' :
                event.event_status === 'finished' ? 'bg-gray-100 text-gray-800' :
                'bg-blue-100 text-blue-800'
              }`}>
                {event.event_status === 'live' ? '🔴 LIVE' :
                 event.event_status === 'finished' ? '✅ Finished' :
                 '📅 Scheduled'}
              </span>
            </div>
          </div>
          
          <div className="flex space-x-2">
            {/* Group Chat Button - Available to signed up users and hosts */}
            {user && (isHost || userSignup) && (
              <>
                {isHost && !hasGroupChat ? (
                  <button
                    onClick={() => setShowCreateGroupChat(true)}
                    className="btn bg-green-600 text-white hover:bg-green-700 flex items-center space-x-2"
                  >
                    <span>💬</span>
                    <span>Create Event Chat</span>
                  </button>
                ) : hasGroupChat && userSignup ? (
                  <button
                    onClick={handleJoinGroupChat}
                    disabled={joiningGroupChat}
                    className="btn bg-green-600 text-white hover:bg-green-700 flex items-center space-x-2"
                  >
                    <span>💬</span>
                    <span>{joiningGroupChat ? 'Joining...' : 'Join Event Chat'}</span>
                  </button>
                ) : null}
              </>
            )}
          </div>
        </div>

        {/* Host Controls - Moved outside header for proper alignment */}
        {isHost && event.event_status !== 'finished' && (
          <div className="mb-6 space-y-3 sm:space-y-0 sm:flex sm:flex-row sm:gap-3">
            {/* Edit Event and Add Participants - Available for all non-finished events */}
            <button
              onClick={() => setShowEditEventForm(true)}
              className="btn btn-secondary w-full sm:w-auto py-3 px-4 text-base font-medium"
            >
              ✏️ Edit Event
            </button>
            <button
              onClick={() => setShowAddParticipantsModal(true)}
              className="btn bg-purple-600 text-white hover:bg-purple-700 w-full sm:w-auto py-3 px-4 text-base font-medium"
            >
              👥 Add Participants
            </button>
            
            {/* Event Status Controls */}
            {event.event_status === 'live' ? (
              <button
                onClick={handleFinishEvent}
                disabled={submitting}
                className="btn bg-red-600 text-white hover:bg-red-700 w-full sm:w-auto py-3 px-4 text-base font-medium"
              >
                {submitting ? 'Finishing...' : 'Finish Event'}
              </button>
            ) : (
              <button
                onClick={handleStartEvent}
                disabled={submitting}
                className="btn btn-primary w-full sm:w-auto py-3 px-4 text-base font-medium"
              >
                {submitting ? 'Starting...' : 'Start Event'}
              </button>
            )}
          </div>
        )}

        <div className="grid sm:grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          <div>
            <h2 className="text-xl font-semibold mb-4">Event Details</h2>
            <div className="space-y-3">
              <div className="flex items-center">
                <span className="text-gray-600 w-20">📍 Venue:</span>
                <span>{event.venue_name}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 w-20">📍 Address:</span>
                <span>{event.venue_address}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 w-20">📅 Date:</span>
                <span>{formatDate(event.date)}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 w-20">🕐 Time:</span>
                <span>{formatTime12Hour(event.start_time)} - {formatTime12Hour(event.end_time)}</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 w-20">🎤 Slots:</span>
                <span>{confirmedSignups.length}/{event.max_performers} performers</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 w-20">⏱️ Length:</span>
                <span>{event.performance_length} minutes per performer</span>
              </div>
              <div className="flex items-center">
                <span className="text-gray-600 w-20">📋 List Type:</span>
                <span className="flex items-center">
                  {event.signup_list_mode === 'signup_order' && (
                    <>
                      <span className="text-blue-600 font-medium">Sign-up Order</span>
                      <span className="text-gray-500 text-sm ml-2">(First come, first served)</span>
                    </>
                  )}
                  {event.signup_list_mode === 'random_order' && (
                    <>
                      <span className="text-purple-600 font-medium">Random Order</span>
                      <span className="text-gray-500 text-sm ml-2">(Shuffled when event starts)</span>
                    </>
                  )}
                  {event.signup_list_mode === 'bucket' && (
                    <>
                      <span className="text-orange-600 font-medium">Bucket Style</span>
                      <span className="text-gray-500 text-sm ml-2">(Host selects performers)</span>
                    </>
                  )}
                  {event.signup_list_mode === 'booked_mic' && (
                    <>
                      <span className="text-purple-600 font-medium">Booked Mic</span>
                      <span className="text-gray-500 text-sm ml-2">(Invite-only performers)</span>
                    </>
                  )}
                </span>
              </div>
              {event.started_at && (
                <div className="flex items-center">
                  <span className="text-gray-600 w-20">🚀 Started:</span>
                  <span>{new Date(event.started_at).toLocaleString()}</span>
                </div>
              )}
            </div>

            {event.description && (
              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Description</h3>
                <p className="text-gray-700">{event.description}</p>
              </div>
            )}

            <div className="mt-6">
              <h3 className="text-lg font-semibold mb-2">Event Host</h3>
              <p className="text-gray-700">{event.host_name}</p>
            </div>
          </div>

          <div>
            {event.event_status === 'scheduled' && (
              <>
                <h2 className="text-xl font-semibold mb-4">
                  {isHost ? 'Host Signup' : 
                   event.signup_list_mode === 'booked_mic' ? 'Invitation Status' : 'Sign Up to Perform'}
                </h2>
                
                {isHost ? (
                  // Host signup section
                  userSignup ? (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-blue-700 mb-2">
                        <strong>You're performing at your own event!</strong>
                      </p>
                      <p className="text-blue-600 mb-4">
                        Performance: "{userSignup.performance_name}"
                      </p>
                      <button 
                        onClick={handleCancelSignup}
                        disabled={submitting}
                        className="btn bg-red-600 text-white hover:bg-red-700"
                      >
                        {submitting ? 'Canceling...' : 'Cancel My Performance'}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-green-50 p-4 rounded-lg">
                      <p className="text-green-700 mb-2">
                        <strong>Want to perform at your own event?</strong>
                      </p>
                      <p className="text-gray-600 mb-4">
                        As the host, you can add yourself to the performer list.
                      </p>
                      <button 
                        onClick={() => {
                          setSignupForm({
                            performerName: user.name,
                            performanceType: 'music',
                            notes: ''
                          })
                          setShowSignupForm(true)
                        }}
                        className="btn btn-primary"
                      >
                        Add Myself as Performer
                      </button>
                    </div>
                  )
                ) : event.signup_list_mode === 'booked_mic' ? (
                  userSignup ? (
                    <div className="bg-blue-50 p-4 rounded-lg">
                      <p className="text-blue-700 mb-2">
                        <strong>You're signed up!</strong>
                      </p>
                      <p className="text-blue-600 mb-4">
                        Performance: "{userSignup.performance_name}"
                      </p>
                      <button 
                        onClick={handleCancelSignup}
                        disabled={submitting}
                        className="btn bg-red-600 text-white hover:bg-red-700"
                      >
                        {submitting ? 'Canceling...' : 'Cancel Signup'}
                      </button>
                    </div>
                  ) : (
                    <div className="bg-purple-50 p-4 rounded-lg">
                      <p className="text-purple-700 mb-2">
                        <strong>Invite-Only Event</strong>
                      </p>
                      <p className="text-purple-600">
                        This is a booked mic event. Performers are invited by the host. You have not been invited to this event.
                      </p>
                    </div>
                  )
                ) : !user ? (
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <p className="text-gray-600 mb-4">
                      You need to be logged in to sign up for events.
                    </p>
                    <div className="space-x-2">
                      <a href="/login" className="btn btn-primary">
                        Login
                      </a>
                      <a href="/register" className="btn btn-secondary">
                        Sign Up
                      </a>
                    </div>
                  </div>
                ) : signupsNotOpenYet ? (
                  <div className="bg-yellow-50 p-4 rounded-lg">
                    <p className="text-yellow-700 mb-2">
                      <strong>Signups Not Open Yet</strong>
                    </p>
                    <p className="text-yellow-600">
                      Sign-ups open on {signupOpens?.toLocaleDateString()} at {event.signup_opens ? formatTimeOnly12Hour(event.signup_opens) : ''}
                    </p>
                  </div>
                ) : signupsClosed ? (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-red-700">
                      <strong>Signups Closed</strong>
                    </p>
                    <p className="text-red-600">
                      The signup deadline has passed.
                    </p>
                  </div>
                ) : isEventFull ? (
                  <div className="bg-red-50 p-4 rounded-lg">
                    <p className="text-red-700">
                      <strong>Event Full</strong>
                    </p>
                    <p className="text-red-600">
                      This event is currently full. Check back later for cancellations.
                    </p>
                  </div>
                ) : userSignup ? (
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-blue-700 mb-2">
                      <strong>You're signed up!</strong>
                    </p>
                    <p className="text-blue-600 mb-4">
                      Performance: "{userSignup.performance_name}"
                    </p>
                    <button 
                      onClick={handleCancelSignup}
                      disabled={submitting}
                      className="btn bg-red-600 text-white hover:bg-red-700"
                    >
                      {submitting ? 'Canceling...' : 'Cancel Signup'}
                    </button>
                  </div>
                ) : (
                  <div className="bg-green-50 p-4 rounded-lg">
                    <p className="text-green-700 mb-4">
                      <strong>Signups Open!</strong> Spots available.
                    </p>
                    <button 
                      onClick={() => {
                        setSignupForm({
                          performerName: user.name,
                          performanceType: 'music',
                          notes: ''
                        })
                        setShowSignupForm(true)
                      }}
                      className="btn btn-primary"
                    >
                      Sign Up to Perform
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Performer List - Shows for live events or for hosts */}
      {(event.event_status === 'live' || event.event_status === 'finished' || isHost) && (
        <div className="card">
          {/* Different interfaces based on signup list mode */}
          {event.signup_list_mode === 'booked_mic' ? (
            // Booked Mic Interface - Enhanced for hosts, read-only for performers
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  {event.event_status === 'live' ? 'Performance Order' : 
                   event.event_status === 'finished' ? 'Final Performance List' : 
                   'Booked Performers'}
                </h2>
                
                {isHost && (
                  <div className="flex space-x-2">
                    {event.event_status === 'scheduled' && (
                      <button
                        onClick={() => handleSavePerformerOrder()}
                        disabled={submitting}
                        className="btn btn-primary text-sm"
                      >
                        Save Order
                      </button>
                    )}
                    {event.event_status === 'live' && (
                      <button
                        onClick={() => setShowAddPerformerForm(true)}
                        className="btn btn-secondary"
                      >
                        Add Performer
                      </button>
                    )}
                  </div>
                )}
              </div>

              {sortedSignups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  {event.event_status === 'scheduled' ? 'No performers have accepted invites yet.' : 'No performers signed up.'}
                </div>
              ) : (
                <>
                  {isHost && event.event_status === 'scheduled' && (
                    <div className="mb-4 p-3 bg-purple-50 border border-purple-200 rounded-lg">
                      <p className="text-sm text-purple-700">
                        <strong>Host Controls:</strong> Drag performers to reorder, set individual performance lengths, and manage the show lineup.
                      </p>
                    </div>
                  )}
                  
                  <div className="space-y-3">
                    {sortedSignups.map((signup, index) => (
                      <div
                        key={signup.id}
                        className={`p-4 rounded-lg border ${
                          signup.is_finished ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                        } ${isHost && event.event_status === 'scheduled' ? 'cursor-move hover:shadow-md transition-shadow' : ''}`}
                        draggable={!!(isHost && event.event_status === 'scheduled')}
                        onDragStart={(e) => handleDragStart(e, signup.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              {isHost && event.event_status === 'scheduled' && (
                                <div className="text-gray-400 cursor-move">
                                  ⋮⋮
                                </div>
                              )}
                              <div className="text-lg font-semibold text-purple-600 w-8">
                                #{signup.performance_order || index + 1}
                              </div>
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center space-x-2">
                                <h3 className={`font-semibold ${signup.is_finished ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                  {signup.performance_name}
                                </h3>
                                <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                                  BOOKED
                                </span>
                              </div>
                              <p className={`text-sm ${signup.is_finished ? 'text-gray-400' : 'text-gray-600'}`}>
                                {signup.user_name} • {signup.performance_type}
                              </p>
                              {signup.notes && (
                                <p className={`text-sm mt-1 ${signup.is_finished ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {signup.notes}
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-3">
                            {/* Performance Length Control */}
                            {isHost && event.event_status === 'scheduled' ? (
                              <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-600">Length:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="60"
                                  value={signup.individual_performance_length || event.performance_length}
                                  onChange={(e) => handleUpdatePerformerLength(signup.id, parseInt(e.target.value))}
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-500">min</span>
                              </div>
                            ) : (
                              <div className="text-sm text-gray-500">
                                {signup.individual_performance_length || event.performance_length} min
                              </div>
                            )}
                            
                            {/* Live Event Controls */}
                            {isHost && event.event_status === 'live' && (
                              <div className="flex space-x-2">
                                {signup.is_finished ? (
                                  <button
                                    onClick={() => handleUnmarkFinished(signup.id)}
                                    disabled={submitting}
                                    className="btn btn-secondary text-sm"
                                  >
                                    Undo
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleMarkFinished(signup.id)}
                                    disabled={submitting}
                                    className="btn btn-primary text-sm"
                                  >
                                    Mark Finished
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                  
                  {/* Show total runtime for hosts */}
                  {isHost && (
                    <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                      <p className="text-sm text-gray-700">
                        <strong>Total Show Length:</strong> {calculateTotalRuntime()} minutes
                        {sortedSignups.length > 0 && (
                          <span className="ml-2 text-gray-500">
                            ({sortedSignups.length} performer{sortedSignups.length !== 1 ? 's' : ''})
                          </span>
                        )}
                      </p>
                    </div>
                  )}
                </>
              )}
            </>
          ) : event.signup_list_mode === 'bucket' ? (
            // Bucket Mode Interface
            <>
              {isHost ? (
                // Host view for bucket mode
                <>
                  <div className="flex justify-between items-center mb-6">
                    <h2 className="text-xl font-semibold">
                      {event.event_status === 'live' ? 'Bucket Mode - Select Next Performer' :
                       event.event_status === 'finished' ? 'Bucket Mode - Final Results' :
                       'Bucket Mode - Signed Up Performers'}
                    </h2>
                    {event.event_status === 'live' && (
                      <button
                        onClick={() => setShowAddPerformerForm(true)}
                        className="btn btn-secondary"
                      >
                        Add Performer
                      </button>
                    )}
                  </div>

                  {/* Current Performer - Only show for live events */}
                  {event.event_status === 'live' && (() => {
                    const currentPerformer = sortedSignups.find(s => s.is_current_performer)
                    return currentPerformer ? (
                      <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg">
                        <h3 className="text-lg font-semibold text-green-800 mb-2">🎤 Currently Performing</h3>
                        <div className="text-green-700">
                          <p className="font-medium">{currentPerformer.performance_name}</p>
                          <p className="text-sm">{currentPerformer.user_name || 'Walk-in performer'} • {currentPerformer.performance_type}</p>
                        </div>
                        {sortedSignups.filter(s => !s.is_finished && !s.is_current_performer).length > 0 ? (
                          <button
                            onClick={handleSelectRandomPerformer}
                            disabled={submitting}
                            className="btn btn-primary text-sm mt-3"
                          >
                            🎲 Next Performer
                          </button>
                        ) : (
                          <button
                            onClick={() => handleMarkFinished(currentPerformer.id)}
                            disabled={submitting}
                            className="btn btn-primary text-sm mt-3"
                          >
                            Mark as Finished
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="mb-6 p-4 bg-gray-50 border border-gray-200 rounded-lg">
                        <p className="text-gray-600">No performer currently selected</p>
                      </div>
                    )
                  })()}

                  {/* Available Performers - Only show for live events */}
                  {event.event_status === 'live' && (
                    <div className="mb-6">
                      <div className="flex justify-between items-center mb-4">
                        <h3 className="text-lg font-semibold">Available Performers ({sortedSignups.filter(s => !s.is_finished && !s.is_current_performer).length})</h3>
                        {sortedSignups.filter(s => !s.is_finished && !s.is_current_performer).length > 0 && (
                          <button
                            onClick={handleSelectRandomPerformer}
                            disabled={submitting}
                            className="btn btn-primary"
                          >
                            🎲 Select Next Performer
                          </button>
                        )}
                      </div>
                      
                      {sortedSignups.filter(s => !s.is_finished && !s.is_current_performer).length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No more performers available.
                        </div>
                      ) : (
                        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                          <p className="text-gray-600 text-center">
                            {sortedSignups.filter(s => !s.is_finished && !s.is_current_performer).length} performer(s) waiting in the bucket
                          </p>
                          <div className="mt-3 flex flex-wrap gap-2 justify-center">
                            {sortedSignups
                              .filter(s => !s.is_finished && !s.is_current_performer)
                              .map((signup) => (
                                <span
                                  key={signup.id}
                                  className="inline-block px-3 py-1 bg-white border border-gray-300 rounded-full text-sm text-gray-700"
                                >
                                  {signup.performance_name} ({signup.performance_type})
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Simple list for non-live bucket events */}
                  {event.event_status !== 'live' && (
                    <div className="mb-6">
                      <h3 className="text-lg font-semibold mb-4">
                        {event.event_status === 'finished' ? 'All Performers' : 'Signed Up Performers'} ({sortedSignups.length})
                      </h3>
                      {sortedSignups.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                          No performers signed up yet.
                        </div>
                      ) : (
                        <div className="space-y-3">
                          {sortedSignups.map((signup) => (
                            <div
                              key={signup.id}
                              className={`p-4 rounded-lg border ${
                                signup.is_finished ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                              }`}
                            >
                              <div className="flex justify-between items-start">
                                <div className="flex-1">
                                  <h4 className={`font-semibold ${signup.is_finished ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                    {signup.performance_name}
                                  </h4>
                                  <p className={`text-sm ${signup.is_finished ? 'text-gray-400' : 'text-gray-600'}`}>
                                    {signup.user_name || (signup as any).performer_name || 'Walk-in performer'} • {signup.performance_type}
                                    {(signup as any).is_walk_in && <span className="ml-2 text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded">Walk-in</span>}
                                  </p>
                                  {signup.notes && (
                                    <p className={`text-sm mt-1 ${signup.is_finished ? 'text-gray-400' : 'text-gray-500'}`}>
                                      {signup.notes}
                                    </p>
                                  )}
                                </div>
                                
                                {/* Host Controls */}
                                {isHost && event.event_status !== 'finished' && (
                                  <div className="flex space-x-2 ml-4">
                                    <button
                                      onClick={() => handleRemovePerformer(signup.id)}
                                      disabled={submitting}
                                      className="text-red-600 hover:text-red-800 text-sm px-2 py-1 border border-red-300 rounded hover:bg-red-50"
                                      title="Remove performer"
                                    >
                                      Remove
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Finished Performers */}
                  {sortedSignups.filter(s => s.is_finished).length > 0 && (
                    <>
                      <h3 className="text-lg font-semibold mb-4">Finished Performers</h3>
                      <div className="space-y-3">
                        {sortedSignups
                          .filter(s => s.is_finished)
                          .map((signup) => (
                            <div
                              key={signup.id}
                              className="flex items-center justify-between p-4 rounded-lg border bg-gray-50 border-gray-200"
                            >
                              <div>
                                <h4 className="font-semibold text-gray-500 line-through">{signup.performance_name}</h4>
                                <p className="text-sm text-gray-400">
                                  {signup.user_name || 'Walk-in performer'} • {signup.performance_type}
                                </p>
                              </div>
                              <button
                                onClick={() => handleUnmarkFinished(signup.id)}
                                disabled={submitting}
                                className="btn btn-secondary text-sm"
                              >
                                Undo
                              </button>
                            </div>
                          ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                // Non-host view for bucket mode
                <>
                  <div className="mb-6">
                    <h2 className="text-xl font-semibold">
                      {event.event_status === 'live' ? 'Currently Performing' :
                       event.event_status === 'finished' ? 'Event Results' :
                       'Signed Up Performers'}
                    </h2>
                  </div>
                  
                  {event.event_status === 'live' ? (
                    // Live event - show current performer only
                    (() => {
                      const currentPerformer = sortedSignups.find(s => s.is_current_performer)
                      return currentPerformer ? (
                        <div className="p-6 bg-green-50 border border-green-200 rounded-lg text-center">
                          <h3 className="text-2xl font-bold text-green-800 mb-2">🎤 {currentPerformer.performance_name}</h3>
                          <p className="text-green-700">{currentPerformer.user_name || 'Walk-in performer'}</p>
                          <p className="text-sm text-green-600 mt-1">{currentPerformer.performance_type}</p>
                        </div>
                      ) : (
                        <div className="p-6 bg-gray-50 border border-gray-200 rounded-lg text-center">
                          <p className="text-gray-600">No performer currently selected</p>
                        </div>
                      )
                    })()
                  ) : (
                    // Non-live event - show simple list without slot numbers
                    sortedSignups.length === 0 ? (
                      <div className="text-center py-8 text-gray-500">
                        No performers signed up yet.
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {sortedSignups.map((signup) => (
                          <div
                            key={signup.id}
                            className={`p-4 rounded-lg border ${
                              signup.is_finished ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                            }`}
                          >
                            <h4 className={`font-semibold ${signup.is_finished ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                              {signup.performance_name}
                            </h4>
                            <p className={`text-sm ${signup.is_finished ? 'text-gray-400' : 'text-gray-600'}`}>
                              {signup.user_name || 'Walk-in performer'} • {signup.performance_type}
                            </p>
                            {signup.notes && (
                              <p className={`text-sm mt-1 ${signup.is_finished ? 'text-gray-400' : 'text-gray-500'}`}>
                                {signup.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )
                  )}
                </>
              )}
            </>
          ) : (
            // Standard Mode Interface (signup_order or random_order)
            <>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-semibold">
                  {event.event_status === 'live' ? 'Performance Order' : 
                   event.event_status === 'finished' ? 'Final Performance List' : 
                   'Signed Up Performers'}
                  {event.signup_list_mode === 'random_order' && event.event_status === 'live' && (
                    <span className="text-sm text-gray-500 ml-2">(Randomized)</span>
                  )}
                </h2>
                
                <div className="flex space-x-2">
                  {isHost && event.event_status === 'scheduled' && (
                    <>
                      <button
                        onClick={() => setShowAddPerformerForm(true)}
                        className="btn btn-secondary text-sm"
                      >
                        Add Performer
                      </button>
                      <button
                        onClick={() => handleSavePerformerOrder()}
                        disabled={submitting}
                        className="btn btn-primary text-sm"
                      >
                        Save Order
                      </button>
                    </>
                  )}
                  {isHost && event.event_status === 'live' && event.signup_list_mode === 'random_order' && (
                    <button
                      onClick={handleRandomizeOrder}
                      disabled={submitting}
                      className="btn btn-secondary text-sm"
                    >
                      🎲 Randomize Again
                    </button>
                  )}
                  {isHost && event.event_status === 'live' && (
                    <>
                      <button
                        onClick={() => setShowAddPerformerForm(true)}
                        className="btn btn-secondary"
                      >
                        Add Performer
                      </button>
                      <button
                        onClick={() => setShowWalkInForm(true)}
                        className="btn bg-yellow-600 text-white hover:bg-yellow-700"
                      >
                        Add Walk-in
                      </button>
                    </>
                  )}
                </div>
              </div>

              {sortedSignups.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  No performers signed up yet.
                </div>
              ) : (
                <>
                  {isHost && event.event_status === 'scheduled' && (
                    <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <p className="text-sm text-blue-700">
                        <strong>Host Controls:</strong> Drag and drop performers to reorder them, adjust individual performance lengths, and click "Save Order" to save changes.
                      </p>
                    </div>
                  )}
                  <div className="space-y-3">
                    {sortedSignups.map((signup, index) => (
                      <div
                        key={signup.id}
                        className={`p-4 rounded-lg border ${
                          signup.is_finished ? 'bg-gray-50 border-gray-200' : 'bg-white border-gray-300'
                        } ${isHost && event.event_status === 'scheduled' ? 'cursor-move hover:shadow-md transition-shadow' : ''}`}
                        draggable={!!(isHost && event.event_status === 'scheduled')}
                        onDragStart={(e) => handleDragStart(e, signup.id)}
                        onDragOver={handleDragOver}
                        onDrop={(e) => handleDrop(e, index)}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-4">
                            <div className="flex items-center space-x-2">
                              {isHost && event.event_status === 'scheduled' && (
                                <div className="text-gray-400 cursor-move">
                                  ⋮⋮
                                </div>
                              )}
                              <div className="text-lg font-semibold text-gray-500 w-8">
                                #{index + 1}
                              </div>
                            </div>
                            <div>
                              <h3 className={`font-semibold ${signup.is_finished ? 'line-through text-gray-500' : 'text-gray-900'}`}>
                                {signup.performance_name}
                              </h3>
                              <p className={`text-sm ${signup.is_finished ? 'text-gray-400' : 'text-gray-600'}`}>
                                {signup.user_name || 'Walk-in performer'} • {signup.performance_type}
                              </p>
                              {signup.notes && (
                                <p className={`text-sm mt-1 ${signup.is_finished ? 'text-gray-400' : 'text-gray-500'}`}>
                                  {signup.notes}
                                </p>
                              )}
                            </div>
                          </div>
                      
                          <div className="flex items-center space-x-3">
                            {/* Performance Length Control */}
                            {isHost && event.event_status === 'scheduled' ? (
                              <div className="flex items-center space-x-2">
                                <label className="text-sm text-gray-600">Length:</label>
                                <input
                                  type="number"
                                  min="1"
                                  max="30"
                                  value={signup.individual_performance_length || event.performance_length || 5}
                                  onChange={(e) => handleUpdatePerformerLength(signup.id, parseInt(e.target.value))}
                                  className="w-16 px-2 py-1 text-sm border border-gray-300 rounded"
                                />
                                <span className="text-sm text-gray-500">min</span>
                              </div>
                            ) : event.event_status === 'live' || event.event_status === 'finished' ? (
                              <div className="text-sm text-gray-500">
                                {signup.individual_performance_length || event.performance_length || 5} min
                              </div>
                            ) : null}

                            {/* Remove Performer Button for Scheduled Events */}
                            {isHost && event.event_status === 'scheduled' && (
                              <button
                                onClick={() => handleRemovePerformer(signup.id)}
                                className="text-red-500 hover:text-red-700 text-sm"
                                title="Remove performer"
                              >
                                Remove
                              </button>
                            )}

                            {/* Live Event Controls */}
                            {isHost && event.event_status === 'live' && (
                              <div className="flex space-x-2">
                                {signup.is_finished ? (
                                  <button
                                    onClick={() => handleUnmarkFinished(signup.id)}
                                    disabled={submitting}
                                    className="btn btn-secondary text-sm"
                                  >
                                    Undo
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => handleMarkFinished(signup.id)}
                                    disabled={submitting}
                                    className="btn btn-primary text-sm"
                                  >
                                    Mark Finished
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                    </div>
                    ))}
                  </div>
                </>
              )}
            </>
          )}
        </div>
      )}

      {/* Add Performer Modal */}
      {showAddPerformerForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Add Walk-in Performer</h3>
            <form onSubmit={handleAddPerformer} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performer Name *
                </label>
                <input
                  type="text"
                  value={addPerformerForm.performerName}
                  onChange={(e) => setAddPerformerForm(prev => ({ ...prev, performerName: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Name *
                </label>
                <input
                  type="text"
                  value={addPerformerForm.performanceName}
                  onChange={(e) => setAddPerformerForm(prev => ({ ...prev, performanceName: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Type *
                </label>
                <select
                  value={addPerformerForm.performanceType}
                  onChange={(e) => setAddPerformerForm(prev => ({ ...prev, performanceType: e.target.value }))}
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
                  Notes
                </label>
                <textarea
                  value={addPerformerForm.notes}
                  onChange={(e) => setAddPerformerForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="input"
                  rows={2}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1 order-2 sm:order-1 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  {submitting ? 'Adding...' : 'Add Performer'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddPerformerForm(false)}
                  className="btn btn-secondary flex-1 order-1 sm:order-2 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Participants Modal */}
      {showAddParticipantsModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Add Participants</h3>
            <form onSubmit={handleAddParticipants} className="space-y-5" noValidate>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performer Name *
                </label>
                <input
                  type="text"
                  value={addParticipantsForm.performerName}
                  onChange={(e) => setAddParticipantsForm(prev => ({ ...prev, performerName: e.target.value }))}
                  className="input"
                  required
                  autoComplete="name"
                  inputMode="text"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Name
                </label>
                <input
                  type="text"
                  value={addParticipantsForm.performanceName}
                  onChange={(e) => setAddParticipantsForm(prev => ({ ...prev, performanceName: e.target.value }))}
                  className="input"
                  placeholder="Optional - can be added later"
                  autoComplete="off"
                  inputMode="text"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Type *
                </label>
                <select
                  value={addParticipantsForm.performanceType}
                  onChange={(e) => setAddParticipantsForm(prev => ({ ...prev, performanceType: e.target.value }))}
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
                  Notes
                </label>
                <textarea
                  value={addParticipantsForm.notes}
                  onChange={(e) => setAddParticipantsForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="input"
                  rows={2}
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1 order-2 sm:order-1 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  {submitting ? 'Adding...' : 'Add Participant'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowAddParticipantsModal(false)}
                  className="btn btn-secondary flex-1 order-1 sm:order-2 py-3 px-4 text-base font-medium"
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
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Edit Event</h3>
            <form onSubmit={handleEditEvent} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Event Title *
                </label>
                <input
                  type="text"
                  value={editEventForm.title}
                  onChange={(e) => setEditEventForm(prev => ({ ...prev, title: e.target.value }))}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={editEventForm.description}
                  onChange={(e) => setEditEventForm(prev => ({ ...prev, description: e.target.value }))}
                  className="input"
                  rows={3}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Performers *
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editEventForm.maxPerformers}
                  onChange={(e) => setEditEventForm(prev => ({ ...prev, maxPerformers: parseInt(e.target.value) }))}
                  className="input"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Length (minutes) *
                </label>
                <input
                  type="number"
                  min="1"
                  max="30"
                  value={editEventForm.performanceLength}
                  onChange={(e) => setEditEventForm(prev => ({ ...prev, performanceLength: parseInt(e.target.value) }))}
                  className="input"
                  required
                />
              </div>
              
              {/* Performer Search for Booked Mic Events */}
              {event?.signup_list_mode === 'booked_mic' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Invite Additional Performers
                  </label>
                  <p className="text-xs text-gray-500 mb-3">
                    Search for users to invite to this booked mic event
                  </p>
                  
                  {/* Selected Performers */}
                  {selectedPerformers.length > 0 && (
                    <div className="mb-3">
                      <p className="text-sm font-medium text-gray-700 mb-2">Performers to invite:</p>
                      <div className="flex flex-wrap gap-2">
                        {selectedPerformers.map(performer => (
                          <div
                            key={performer.id}
                            className="flex items-center space-x-2 bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm"
                          >
                            <span>{performer.name}</span>
                            <button
                              type="button"
                              onClick={() => removePerformer(performer.id)}
                              className="text-purple-600 hover:text-purple-800"
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
                      placeholder="Search by name, email, or performer type..."
                      className="input"
                    />
                    
                    {/* Search Results */}
                    {performerResults.length > 0 && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-40 overflow-y-auto">
                        {performerResults.map(user => (
                          <button
                            key={user.id}
                            type="button"
                            onClick={() => addPerformerInvite(user)}
                            className="w-full px-3 py-2 text-left hover:bg-gray-50"
                          >
                            <div className="flex items-center space-x-3">
                              <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                                <span className="text-sm font-medium text-gray-700">
                                  {user.name?.charAt(0)?.toUpperCase() || '?'}
                                </span>
                              </div>
                              <div>
                                <div className="font-medium text-gray-900">{user.name}</div>
                                <div className="text-sm text-gray-500">
                                  {user.performer_type && <span className="capitalize">{user.performer_type}</span>}
                                  {user.email && <span> • {user.email}</span>}
                                </div>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
              
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1 order-2 sm:order-1 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  {submitting ? 'Updating...' : 'Update Event'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowEditEventForm(false)}
                  className="btn btn-secondary flex-1 order-1 sm:order-2 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Sign-up Form Modal */}
      {showSignupForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">
              {isHost ? 'Add Myself as Performer' : 'Sign Up to Perform'}
            </h3>
            <form onSubmit={handleSignup} className="space-y-5">
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
                  rows={3}
                  placeholder="Any special requirements, song titles, etc."
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-6">
                <button 
                  type="submit" 
                  className="btn btn-primary flex-1 order-2 sm:order-1 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  {submitting ? 'Signing Up...' : 'Sign Me Up!'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSignupForm(false)}
                  className="btn btn-secondary flex-1 order-1 sm:order-2 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Create Group Chat Modal */}
      {showCreateGroupChat && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Create Event Group Chat</h3>
            <p className="text-gray-600 mb-6">
              Create a group chat for this event where all participants can communicate. 
              Only signed-up performers will be able to join.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 pt-4">
              <button
                onClick={handleCreateGroupChat}
                disabled={joiningGroupChat}
                className="btn btn-primary flex-1 order-2 sm:order-1 py-3 px-4 text-base font-medium"
              >
                {joiningGroupChat ? 'Creating...' : 'Create Chat'}
              </button>
              <button
                type="button"
                onClick={() => setShowCreateGroupChat(false)}
                className="btn btn-secondary flex-1 order-1 sm:order-2 py-3 px-4 text-base font-medium"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Walk-in Modal */}
      {showWalkInForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-xl p-5 sm:p-6 w-full max-w-sm sm:max-w-md max-h-[85vh] overflow-y-auto shadow-2xl">
            <h3 className="text-lg font-semibold mb-4">Add Walk-in Performer</h3>
            <form onSubmit={handleAddWalkIn} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performer Name *
                </label>
                <input
                  type="text"
                  value={walkInForm.performerName}
                  onChange={(e) => setWalkInForm(prev => ({ ...prev, performerName: e.target.value }))}
                  className="input"
                  placeholder="Walk-in performer's name"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Name *
                </label>
                <input
                  type="text"
                  value={walkInForm.performanceName}
                  onChange={(e) => setWalkInForm(prev => ({ ...prev, performanceName: e.target.value }))}
                  className="input"
                  placeholder="Song title, act name, etc."
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Performance Type *
                </label>
                <select
                  value={walkInForm.performanceType}
                  onChange={(e) => setWalkInForm(prev => ({ ...prev, performanceType: e.target.value }))}
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
                  value={walkInForm.notes}
                  onChange={(e) => setWalkInForm(prev => ({ ...prev, notes: e.target.value }))}
                  className="input"
                  rows={3}
                  placeholder="Any special requirements or notes"
                />
              </div>
              
              <div className="flex flex-col sm:flex-row gap-4 pt-4">
                <button
                  type="submit"
                  className="btn btn-primary flex-1 order-2 sm:order-1 py-3 px-4 text-base font-medium"
                  disabled={submitting}
                >
                  {submitting ? 'Adding...' : 'Add Walk-in'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowWalkInForm(false)}
                  className="btn btn-secondary flex-1 order-1 sm:order-2 py-3 px-4 text-base font-medium"
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