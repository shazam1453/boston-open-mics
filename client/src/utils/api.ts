import axios from 'axios'
import type { AuthResponse, User, Event, Venue, Signup, RecurringEventTemplate, Invite } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Auth API
export const authAPI = {
  login: (email: string, password: string) =>
    api.post<AuthResponse>('/auth/login', { email, password }),
  
  register: (userData: {
    email: string
    password: string
    name: string
    phone?: string
    performerType?: string
    bio?: string
  }) => api.post<AuthResponse>('/auth/register', userData),
  
  getProfile: () => api.get<{ user: User }>('/auth/me'),
  
  updateProfile: (updates: Partial<User>) =>
    api.put<{ user: User }>('/auth/profile', updates),
}

// Users API
export const usersAPI = {
  search: (query: string) => api.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`),
}

// Admin API
export const adminAPI = {
  getAllUsers: () => api.get<User[]>('/admin/users'),
  deleteUser: (userId: number) => api.delete(`/admin/users/${userId}`),
  getAllEvents: () => api.get<Event[]>('/admin/events'),
  deleteEvent: (eventId: number) => api.delete(`/admin/events/${eventId}`),
  getAllVenues: () => api.get<Venue[]>('/admin/venues'),
  deleteVenue: (venueId: number) => api.delete(`/admin/venues/${venueId}`),
  updateUserRole: (userId: number, role: string) => api.put<{ user: User }>(`/admin/users/${userId}/role`, { role }),
}

// Events API
export const eventsAPI = {
  getAll: (filters?: { date?: string; eventType?: string; venueId?: number }) =>
    api.get<Event[]>('/events', { params: filters }),
  
  getById: (id: number) => api.get<Event>(`/events/${id}`),
  
  create: (eventData: {
    title: string
    description?: string
    venueId: number
    date: string
    startTime: string
    endTime: string
    maxPerformers: number
    performanceLength: number
    eventType: string
    signupListMode?: string
    signupOpens?: string
    signupDeadline?: string
  }) => api.post<{ event: Event }>('/events', eventData),
  
  update: (id: number, updates: Partial<Event>) =>
    api.put<{ event: Event }>(`/events/${id}`, updates),
  
  delete: (id: number) => api.delete(`/events/${id}`),
  
  getByHost: (hostId: number) => api.get<Event[]>(`/events/host/${hostId}`),
  
  startEvent: (id: number) => api.post<{ event: Event }>(`/events/${id}/start`),
  
  finishEvent: (id: number) => api.post<{ event: Event }>(`/events/${id}/finish`),
  
  setCurrentPerformer: (eventId: number, signupId: number) => 
    api.post<{ event: Event }>(`/events/${eventId}/set-current-performer`, { signupId }),
  
  randomizeOrder: (eventId: number) => 
    api.post<{ signups: Signup[] }>(`/events/${eventId}/randomize-order`),
  
  addCohost: (eventId: number, userId: number) =>
    api.post<{ event: Event }>(`/events/${eventId}/cohosts`, { userId }),
  
  removeCohost: (eventId: number, cohostId: number) =>
    api.delete<{ event: Event }>(`/events/${eventId}/cohosts/${cohostId}`),
  
  // Invite management
  sendInvite: (eventId: number, userId: number) =>
    api.post<{ invite: Invite }>(`/events/${eventId}/invites`, { userId }),
  
  getEventInvites: (eventId: number) =>
    api.get<Invite[]>(`/events/${eventId}/invites`),
  
  respondToInvite: (inviteId: number, response: 'accepted' | 'declined', performanceData?: { performanceName: string; notes?: string }) =>
    api.put<{ invite: Invite }>(`/invites/${inviteId}/respond`, { response, ...performanceData }),
  
  // Booked mic management
  updatePerformerOrder: (eventId: number, performerOrder: { signupId: number; order: number; performanceLength?: number }[]) =>
    api.put<{ signups: Signup[] }>(`/events/${eventId}/performer-order`, { performerOrder }),
  
  updatePerformerLength: (signupId: number, performanceLength: number) =>
    api.put<{ signup: Signup }>(`/signups/${signupId}/performance-length`, { performanceLength }),
}

// Venues API
export const venuesAPI = {
  getAll: () => api.get<Venue[]>('/venues'),
  
  getById: (id: number) => api.get<Venue>(`/venues/${id}`),
  
  getByOwner: (ownerId: number) => api.get<Venue[]>(`/venues/owner/${ownerId}`),
  
  create: (venueData: {
    name: string
    address: string
    phone?: string
    email?: string
    description?: string
    capacity?: number
    amenities?: string[]
  }) => api.post<{ venue: Venue }>('/venues', venueData),
  
  update: (id: number, updates: Partial<Venue>) =>
    api.put<{ venue: Venue }>(`/venues/${id}`, updates),
  
  delete: (id: number) => api.delete(`/venues/${id}`),
}

// Signups API
export const signupsAPI = {
  create: (signupData: {
    eventId: number
    performanceName: string
    notes?: string
    performanceType: string
  }) => api.post<{ signup: Signup }>('/signups', signupData),
  
  getMySignups: () => api.get<Signup[]>('/signups/my-signups'),
  
  getByEvent: (eventId: number) => api.get<Signup[]>(`/signups/event/${eventId}`),
  
  cancel: (eventId: number) => api.delete(`/signups/event/${eventId}`),
  
  updatePerformerOrder: (eventId: number, signupIds: number[]) =>
    api.put<{ signups: Signup[] }>(`/signups/event/${eventId}/order`, { signupIds }),
  
  markAsFinished: (signupId: number) =>
    api.put<{ signup: Signup }>(`/signups/${signupId}/finish`),
  
  unmarkAsFinished: (signupId: number) =>
    api.put<{ signup: Signup }>(`/signups/${signupId}/unfinish`),
  
  addManualPerformer: (eventId: number, performerData: {
    performanceName: string
    performerName: string
    performanceType: string
    notes?: string
  }) => api.post<{ signup: Signup }>(`/signups/event/${eventId}/add-performer`, performerData),
}

// Recurring Events API
export const recurringEventsAPI = {
  getByVenue: (venueId: number) => api.get<RecurringEventTemplate[]>(`/recurring-events/venue/${venueId}`),
  
  create: (templateData: {
    venueId: number
    title: string
    description?: string
    startTime: string
    endTime: string
    maxPerformers: number
    performanceLength: number
    eventType: string
    recurrencePattern: string
    dayOfWeek?: number
    dayOfMonth?: number
    signupOpensHoursBefore?: number
    signupDeadlineHoursBefore?: number
  }) => api.post<{ template: RecurringEventTemplate }>('/recurring-events', templateData),
  
  generateEvents: (templateId: number, numberOfEvents?: number) =>
    api.post<{ events: Event[] }>(`/recurring-events/${templateId}/generate`, { numberOfEvents }),
  
  update: (id: number, updates: Partial<RecurringEventTemplate>) =>
    api.put<{ template: RecurringEventTemplate }>(`/recurring-events/${id}`, updates),
  
  deactivate: (id: number) => api.delete(`/recurring-events/${id}`),
}

export default api