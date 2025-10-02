// Utility functions for date and time formatting

export const formatTime12Hour = (timeString: string): string => {
  // timeString is in format "HH:MM" (24-hour)
  const [hours, minutes] = timeString.split(':').map(Number)
  const date = new Date()
  date.setHours(hours, minutes, 0, 0)
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export const formatDateTime12Hour = (dateTimeString: string): string => {
  const date = new Date(dateTimeString)
  
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString)
  
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const formatTimeOnly12Hour = (dateTimeString: string): string => {
  const date = new Date(dateTimeString)
  
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  })
}