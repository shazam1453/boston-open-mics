export interface User {
  id: string | number
  email: string
  name: string
  phone?: string
  performer_type?: 'musician' | 'comedian' | 'poet' | 'storyteller' | 'other'
  bio?: string
  instagram_handle?: string
  twitter_handle?: string
  tiktok_handle?: string
  youtube_handle?: string
  website_url?: string
  role?: 'user' | 'moderator' | 'admin' | 'super_admin'
  created_at: string
}

export interface Venue {
  id: string | number
  name: string
  address: string
  phone?: string
  email?: string
  description?: string
  capacity?: number
  amenities: string[]
  owner_id: string | number
  owner_name?: string
  created_at: string
}

export interface EventCohost {
  id: string | number
  event_id: string | number
  user_id: string | number
  user_name: string
  user_email: string
  added_by: string | number
  created_at: string
}

export interface Event {
  id: string | number
  title: string
  description?: string
  venue_id: string | number
  venue_name?: string
  venue_address?: string
  date: string
  start_time: string
  end_time: string
  max_performers: number
  performance_length: number
  event_type: 'open-mic' | 'showcase' | 'competition' | 'workshop'
  signup_opens?: string
  signup_deadline?: string
  host_id: string | number
  host_name?: string
  current_signups: number
  event_status: 'scheduled' | 'live' | 'finished'
  signup_list_mode: 'signup_order' | 'random_order' | 'bucket' | 'booked_mic'
  current_performer_id?: string | number
  started_at?: string
  recurring_template_id?: string | number
  cohosts?: EventCohost[]
  created_at: string
}

export interface Signup {
  id: string | number
  event_id: string | number
  user_id: string | number
  performance_name: string
  notes?: string
  performance_type: 'music' | 'comedy' | 'poetry' | 'storytelling' | 'other'
  status: 'confirmed' | 'waitlist' | 'cancelled' | 'performing' | 'performed'
  performance_order?: number
  individual_performance_length?: number
  is_finished: boolean
  finished_at?: string
  is_current_performer: boolean
  created_at: string
  event_title?: string
  event_date?: string
  venue_name?: string
  user_name?: string
}

export interface AuthResponse {
  message: string
  token: string
  user: User
}

export interface RecurringEventTemplate {
  id: number
  venue_id: number
  venue_name?: string
  title: string
  description?: string
  start_time: string
  end_time: string
  max_performers: number
  performance_length: number
  event_type: 'open-mic' | 'showcase' | 'competition' | 'workshop'
  recurrence_pattern: 'weekly' | 'biweekly' | 'monthly'
  day_of_week?: number
  day_of_month?: number
  signup_opens_hours_before: number
  signup_deadline_hours_before: number
  is_active: boolean
  created_by: number
  created_by_name?: string
  created_at: string
}

export interface Invite {
  id: number
  event_id: number
  user_id: number
  user_name: string
  user_email: string
  status: 'pending' | 'accepted' | 'declined'
  invited_by: number
  invited_at: string
  responded_at?: string
  performance_name?: string
  notes?: string
}

export interface ApiError {
  message: string
  errors?: Array<{ msg: string; param: string }>
}