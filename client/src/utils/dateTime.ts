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
  // Parse date string manually to avoid timezone issues
  // dateString is in format "YYYY-MM-DD"
  const [year, month, day] = dateString.split('-').map(Number)
  
  // Create date in local timezone (not UTC)
  const date = new Date(year, month - 1, day) // month is 0-indexed
  
  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
}

export const formatTimeOnly12Hour = (dateTimeString: string): string => {
  // Extract the time portion directly from the ISO string to avoid timezone conversion
  // e.g. "2026-06-22T20:00:00.000Z" -> parse hours/minutes as stored
  const timePart = dateTimeString.includes('T') ? dateTimeString.split('T')[1] : dateTimeString
  const [hourStr, minuteStr] = timePart.split(':')
  const hours = parseInt(hourStr)
  const minutes = parseInt(minuteStr)
  const ampm = hours >= 12 ? 'PM' : 'AM'
  const displayHour = hours % 12 || 12
  return `${displayHour}:${String(minutes).padStart(2, '0')} ${ampm}`
}