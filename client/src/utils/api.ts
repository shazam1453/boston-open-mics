import axios from 'axios'
import type { AuthResponse, User, Event, Venue, Signup, RecurringEventTemplate, Invite } from '../types'

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000, // 10 second timeout
})

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// Add response interceptor to handle errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Log API errors for debugging
    console.error('API Error:', {
      url: error.config?.url,
      method: error.config?.method,
      status: error.response?.status,
      data: error.response?.data
    })
    return Promise.reject(error)
  }
)

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
  
  changePassword: (passwordData: {
    currentPassword: string
    newPassword: string
  }) => api.put<{ message: string }>('/auth/change-password', passwordData),
  
  requestPasswordReset: (email: string) => 
    api.post<{ message: string }>('/auth/request-password-reset', { email }),
  
  resetPassword: (resetData: {
    token: string
    newPassword: string
  }) => api.post<{ message: string }>('/auth/reset-password', resetData),
}

// Users API
export const usersAPI = {
  search: (query: string) => api.get<User[]>(`/users/search?q=${encodeURIComponent(query)}`),
}

// Admin API
export const adminAPI = {
  getAllUsers: () => api.get<User[]>('/admin/users'),
  deleteUser: (userId: string | number) => api.delete(`/admin/users/${userId}`),
  getAllEvents: () => api.get<Event[]>('/admin/events'),
  deleteEvent: (eventId: string | number) => api.delete(`/admin/events/${eventId}`),
  getAllVenues: () => api.get<Venue[]>('/admin/venues'),
  deleteVenue: (venueId: string | number) => api.delete(`/admin/venues/${venueId}`),
  updateUserRole: (userId: string | number, role: string) => api.put<{ user: User }>(`/admin/users/${userId}/role`, { role }),
}

// Events API
export const eventsAPI = {
  getAll: (filters?: { date?: string; eventType?: string; venueId?: string | number }) =>
    api.get<Event[]>('/events', { params: filters }),
  
  getById: (id: string | number) => api.get<Event>(`/events/${id}`),
  
  create: (eventData: {
    title: string
    description?: string
    venueId: string | number
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
  
  update: (id: string | number, updates: Partial<Event>) =>
    api.put<{ event: Event }>(`/events/${id}`, updates),
  
  delete: (id: string | number) => api.delete(`/events/${id}`),
  
  getByHost: (hostId: string | number) => api.get<Event[]>(`/events/host/${hostId}`),
  
  startEvent: (id: string | number) => api.post<{ event: Event }>(`/events/${id}/start`),
  
  finishEvent: (id: string | number) => api.post<{ event: Event }>(`/events/${id}/finish`),
  
  setCurrentPerformer: (eventId: string | number, signupId: string | number) => 
    api.post<{ event: Event }>(`/events/${eventId}/set-current-performer`, { signupId }),
  
  randomizeOrder: (eventId: string | number) => 
    api.post<{ signups: Signup[] }>(`/events/${eventId}/randomize-order`),
  
  addCohost: (eventId: string | number, userId: string | number) =>
    api.post<{ event: Event }>(`/events/${eventId}/cohosts`, { userId }),
  
  removeCohost: (eventId: string | number, cohostId: string | number) =>
    api.delete<{ event: Event }>(`/events/${eventId}/cohosts/${cohostId}`),
  
  // Invite management
  sendInvite: (eventId: string | number, userId: string | number) =>
    api.post<{ invite: Invite }>(`/events/${eventId}/invites`, { userId }),
  
  getEventInvites: (eventId: string | number) =>
    api.get<Invite[]>(`/events/${eventId}/invites`),
  
  respondToInvite: (inviteId: string | number, response: 'accepted' | 'declined', performanceData?: { performanceName: string; notes?: string }) =>
    api.put<{ invite: Invite }>(`/invites/${inviteId}/respond`, { response, ...performanceData }),
  
  // Booked mic management
  updatePerformerOrder: (eventId: string | number, performerOrder: { signupId: string | number; order: number; performanceLength?: number }[]) =>
    api.put<{ signups: Signup[] }>(`/events/${eventId}/performer-order`, { performerOrder }),
  
  updatePerformerLength: (signupId: string | number, performanceLength: number) =>
    api.put<{ signup: Signup }>(`/signups/${signupId}/performance-length`, { performanceLength }),

  // Host management methods
  removePerformer: (eventId: string | number, signupId: string | number) =>
    api.delete<{ message: string; removedSignup: any }>(`/events/${eventId}/performers/${signupId}/remove`),
  
  addWalkIn: (eventId: string | number, walkInData: {
    performerName: string
    performanceName: string
    performanceType?: string
    notes?: string
  }) => api.post<{ message: string; signup: any }>(`/events/${eventId}/walk-ins`, walkInData),
}

// Venues API
export const venuesAPI = {
  getAll: () => api.get<Venue[]>('/venues'),
  
  getById: (id: string | number) => api.get<Venue>(`/venues/${id}`),
  
  getByOwner: (ownerId: string | number) => api.get<Venue[]>(`/venues/owner/${ownerId}`),
  
  create: (venueData: {
    name: string
    address: string
    phone?: string
    email?: string
    description?: string
    capacity?: number
    amenities?: string[]
  }) => api.post<{ venue: Venue }>('/venues', venueData),
  
  update: (id: string | number, updates: Partial<Venue>) =>
    api.put<{ venue: Venue }>(`/venues/${id}`, updates),
  
  delete: (id: string | number) => api.delete(`/venues/${id}`),
}

// Signups API
export const signupsAPI = {
  create: (signupData: {
    eventId: string | number
    performanceName: string
    notes?: string
    performanceType: string
  }) => api.post<{ signup: Signup }>('/signups', signupData),
  
  getMySignups: () => api.get<Signup[]>('/signups/my-signups'),
  
  getByEvent: (eventId: string | number) => api.get<Signup[]>(`/signups/event/${eventId}`),
  
  cancel: (eventId: string | number) => api.delete(`/signups/event/${eventId}`),
  
  updatePerformerOrder: (eventId: string | number, signupIds: (string | number)[]) =>
    api.put<{ signups: Signup[] }>(`/signups/event/${eventId}/order`, { signupIds }),
  
  markAsFinished: (signupId: string | number) =>
    api.put<{ signup: Signup }>(`/signups/${signupId}/finish`),
  
  unmarkAsFinished: (signupId: string | number) =>
    api.put<{ signup: Signup }>(`/signups/${signupId}/unfinish`),
  
  addManualPerformer: (eventId: string | number, performerData: {
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

// Chat API
export const chatAPI = {
  getConversations: () => api.get<any[]>('/chat/conversations'),
  
  startConversation: (otherUserId: string | number) => 
    api.post<any>('/chat/conversations', { other_user_id: otherUserId }),
  
  getMessages: (conversationId: string, limit?: number, lastMessageId?: string) => {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());
    if (lastMessageId) params.append('lastMessageId', lastMessageId);
    const query = params.toString() ? `?${params.toString()}` : '';
    return api.get<{ messages: any[], hasMore: boolean }>(`/chat/conversations/${conversationId}/messages${query}`);
  },
  
  sendMessage: (conversationId: string, messageText: string) =>
    api.post<any>(`/chat/conversations/${conversationId}/messages`, { message_text: messageText }),
  
  markMessageAsRead: (messageId: string) =>
    api.put<{ message: string }>(`/chat/messages/${messageId}/read`),

  // Group chat methods
  createEventGroupChat: (eventId: string | number) =>
    api.post<{ message: string; conversation: any }>(`/events/${eventId}/chat/create`),
  
  getEventGroupChat: (eventId: string | number) =>
    api.get<{ conversation: any }>(`/events/${eventId}/chat`),
  
  joinEventGroupChat: (eventId: string | number) =>
    api.post<{ message: string; conversation: any }>(`/events/${eventId}/chat/join`),
  
  leaveEventGroupChat: (eventId: string | number) =>
    api.post<{ message: string }>(`/events/${eventId}/chat/leave`)
}

export default api