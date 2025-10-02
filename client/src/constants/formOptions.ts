// Form option constants for consistent dropdown options across the app

export const EVENT_TYPES = [
  { value: 'open-mic', label: 'Open Mic' },
  { value: 'showcase', label: 'Showcase' },
  { value: 'competition', label: 'Competition' },
  { value: 'workshop', label: 'Workshop' }
] as const

export const SIGNUP_LIST_MODES = [
  { value: 'signup_order', label: 'Sign-up Order', description: 'First come, first served' },
  { value: 'random_order', label: 'Random Order', description: 'Shuffled when event starts' },
  { value: 'bucket', label: 'Bucket Style', description: 'Host selects performers' },
  { value: 'booked_mic', label: 'Booked Mic', description: 'Invite-only performers' }
] as const

export const PERFORMER_TYPES = [
  { value: 'musician', label: 'Musician' },
  { value: 'comedian', label: 'Comedian' },
  { value: 'poet', label: 'Poet' },
  { value: 'storyteller', label: 'Storyteller' },
  { value: 'other', label: 'Other' }
] as const

export const PERFORMANCE_TYPES = [
  { value: 'music', label: 'Music' },
  { value: 'comedy', label: 'Comedy' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'storytelling', label: 'Storytelling' },
  { value: 'other', label: 'Other' }
] as const

export const DAYS_OF_WEEK = [
  { value: 0, label: 'Sunday' },
  { value: 1, label: 'Monday' },
  { value: 2, label: 'Tuesday' },
  { value: 3, label: 'Wednesday' },
  { value: 4, label: 'Thursday' },
  { value: 5, label: 'Friday' },
  { value: 6, label: 'Saturday' }
] as const

export const USER_ROLES = [
  { value: 'user', label: 'User' },
  { value: 'moderator', label: 'Moderator' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super Admin' }
] as const

// Helper functions for getting labels
export const getEventTypeLabel = (value: string) => 
  EVENT_TYPES.find(type => type.value === value)?.label || value

export const getSignupListModeLabel = (value: string) => 
  SIGNUP_LIST_MODES.find(mode => mode.value === value)?.label || value

export const getPerformerTypeLabel = (value: string) => 
  PERFORMER_TYPES.find(type => type.value === value)?.label || value

export const getDayOfWeekLabel = (value: number) => 
  DAYS_OF_WEEK.find(day => day.value === value)?.label || value.toString()