import { useState, useEffect } from 'react'

interface TimePickerProps {
  value: string // HH:MM format
  onChange: (time: string) => void
  label: string
  required?: boolean
  className?: string
}

export default function TimePicker({ 
  value, 
  onChange, 
  label, 
  required = false, 
  className = '' 
}: TimePickerProps) {
  const [hour, setHour] = useState('8')
  const [minute, setMinute] = useState('00')
  const [period, setPeriod] = useState('PM')

  // Parse the 24-hour time value into 12-hour components
  useEffect(() => {
    if (value && value !== '') {
      const [h, m] = value.split(':')
      const hour24 = parseInt(h)
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24
      const periodValue = hour24 >= 12 ? 'PM' : 'AM'
      
      setHour(hour12.toString())
      setMinute(m)
      setPeriod(periodValue)
    } else if (value === '' || value === undefined) {
      // If value is empty or undefined, use the default UI state (8 PM) and notify parent
      const defaultTime = '20:00' // 8:00 PM (matches the default UI state)
      onChange(defaultTime)
    }
  }, [value, onChange])

  // Also set default on component mount if no initial value
  useEffect(() => {
    if (!value || value === '') {
      const defaultTime = '20:00' // 8:00 PM
      onChange(defaultTime)
    }
  }, []) // Only run on mount

  // Convert 12-hour time to 24-hour format and call onChange
  const updateTime = (newHour: string, newMinute: string, newPeriod: string) => {
    let hour24 = parseInt(newHour)
    
    if (newPeriod === 'AM' && hour24 === 12) {
      hour24 = 0
    } else if (newPeriod === 'PM' && hour24 !== 12) {
      hour24 += 12
    }
    
    const timeString = `${hour24.toString().padStart(2, '0')}:${newMinute}`
    onChange(timeString)
  }

  const handleHourChange = (newHour: string) => {
    setHour(newHour)
    updateTime(newHour, minute, period)
  }

  const handleMinuteChange = (newMinute: string) => {
    setMinute(newMinute)
    updateTime(hour, newMinute, period)
  }

  const handlePeriodChange = (newPeriod: string) => {
    setPeriod(newPeriod)
    updateTime(hour, minute, newPeriod)
  }



  // Generate hour options (1-12)
  const hourOptions = Array.from({ length: 12 }, (_, i) => (i + 1).toString())
  
  // Generate minute options (00, 15, 30, 45)
  const minuteOptions = ['00', '15', '30', '45']

  return (
    <div className={className}>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label} {required && '*'}
      </label>
      
      <div className="flex space-x-2">
        <select
          value={hour}
          onChange={(e) => handleHourChange(e.target.value)}
          className="input flex-1"
          required={required}
        >
          {hourOptions.map(h => (
            <option key={h} value={h}>{h}</option>
          ))}
        </select>
        
        <span className="flex items-center text-gray-500 font-medium">:</span>
        
        <select
          value={minute}
          onChange={(e) => handleMinuteChange(e.target.value)}
          className="input flex-1"
          required={required}
        >
          {minuteOptions.map(m => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
        
        <select
          value={period}
          onChange={(e) => handlePeriodChange(e.target.value)}
          className="input flex-1"
          required={required}
        >
          <option value="AM">AM</option>
          <option value="PM">PM</option>
        </select>
      </div>
    </div>
  )
}