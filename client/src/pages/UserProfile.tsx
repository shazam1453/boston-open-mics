import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usersAPI, chatAPI } from '../utils/api'

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

function getCalendarWeeks(year: number, month: number): (Date | null)[][] {
  const first = new Date(year, month, 1)
  const last = new Date(year, month + 1, 0)
  const weeks: (Date | null)[][] = []
  let week: (Date | null)[] = Array(first.getDay()).fill(null)
  for (let d = 1; d <= last.getDate(); d++) {
    week.push(new Date(year, month, d))
    if (week.length === 7) { weeks.push(week); week = [] }
  }
  if (week.length) {
    while (week.length < 7) week.push(null)
    weeks.push(week)
  }
  return weeks
}

export default function UserProfile() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [availability, setAvailability] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [startingChat, setStartingChat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const [viewYear, setViewYear] = useState(today.getFullYear())
  const [viewMonth, setViewMonth] = useState(today.getMonth())

  useEffect(() => {
    if (!slug) return
    Promise.all([
      usersAPI.getBySlug(slug),
      usersAPI.getAvailability(slug)
    ]).then(([profileRes, availRes]) => {
      setProfile(profileRes.data)
      setAvailability(availRes.data.availability || {})
    }).catch(() => setError('User not found')).finally(() => setLoading(false))
  }, [slug])

  const handleStartChat = async () => {
    if (!currentUser) { navigate('/login'); return }
    setStartingChat(true)
    try {
      await chatAPI.startConversation(profile.id)
      navigate('/chat')
    } catch {
      setError('Failed to start conversation')
    } finally {
      setStartingChat(false)
    }
  }

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1) }
    else setViewMonth(m => m - 1)
  }
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1) }
    else setViewMonth(m => m + 1)
  }

  if (loading) return <div className="text-center py-12">Loading...</div>
  if (error || !profile) return <div className="text-center py-12 text-red-500">{error || 'User not found'}</div>

  const weeks = getCalendarWeeks(viewYear, viewMonth)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Header */}
      <div className="card flex items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center text-2xl font-bold text-gray-900">
            {profile.name?.charAt(0)?.toUpperCase()}
          </div>
          <div>
            <h1 className="text-2xl font-bold">{profile.name}</h1>
            {profile.performer_type && (
              <p className="text-stone-400 capitalize">{profile.performer_type}</p>
            )}
          </div>
        </div>
        {currentUser && currentUser.id !== profile.id && (
          <button onClick={handleStartChat} disabled={startingChat} className="btn btn-primary whitespace-nowrap">
            {startingChat ? 'Opening...' : '💬 Message'}
          </button>
        )}
      </div>

      {/* Bio */}
      {profile.bio && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-2">About</h2>
          <p className="text-stone-300">{profile.bio}</p>
        </div>
      )}

      {/* Social Media */}
      {(profile.instagram_handle || profile.twitter_handle || profile.tiktok_handle || profile.youtube_handle || profile.website_url) && (
        <div className="card">
          <h2 className="text-lg font-semibold mb-3">Social Media</h2>
          <div className="flex flex-wrap gap-3">
            {profile.instagram_handle && (
              <a href={`https://instagram.com/${profile.instagram_handle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-pink-900 text-pink-200 hover:bg-pink-800">
                📷 @{profile.instagram_handle}
              </a>
            )}
            {profile.twitter_handle && (
              <a href={`https://twitter.com/${profile.twitter_handle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-blue-900 text-blue-200 hover:bg-blue-800">
                🐦 @{profile.twitter_handle}
              </a>
            )}
            {profile.tiktok_handle && (
              <a href={`https://tiktok.com/@${profile.tiktok_handle}`} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-stone-700 text-stone-200 hover:bg-stone-600">
                🎵 @{profile.tiktok_handle}
              </a>
            )}
            {profile.youtube_handle && (
              <a href={profile.youtube_handle.startsWith('http') ? profile.youtube_handle : `https://youtube.com/@${profile.youtube_handle}`}
                target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-900 text-red-200 hover:bg-red-800">
                📺 {profile.youtube_handle.startsWith('http') ? 'YouTube' : profile.youtube_handle}
              </a>
            )}
            {profile.website_url && (
              <a href={profile.website_url} target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-green-900 text-green-200 hover:bg-green-800">
                🌐 Website
              </a>
            )}
          </div>
        </div>
      )}

      {/* Availability Calendar */}
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Availability</h2>
          <div className="flex items-center gap-3">
            <button onClick={prevMonth} className="p-1 rounded hover:bg-stone-700 text-stone-300">‹</button>
            <span className="text-sm font-medium w-36 text-center">{MONTH_NAMES[viewMonth]} {viewYear}</span>
            <button onClick={nextMonth} className="p-1 rounded hover:bg-stone-700 text-stone-300">›</button>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-400 mb-2">
          {DAY_LABELS.map(d => <div key={d}>{d}</div>)}
        </div>

        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                if (!day) return <div key={di} />
                const key = day.toISOString().split('T')[0]
                const status = availability[key]
                const isPast = day < today
                return (
                  <div
                    key={di}
                    className={`aspect-square rounded flex items-center justify-center text-sm font-medium
                      ${isPast ? 'opacity-30' : ''}
                      ${status === 'available' ? 'bg-green-700 text-white' :
                        status === 'unavailable' ? 'bg-red-900 text-stone-400' :
                        'bg-stone-800 text-stone-500'}
                    `}
                  >
                    {day.getDate()}
                  </div>
                )
              })}
            </div>
          ))}
        </div>

        <div className="flex gap-4 mt-4 text-xs text-stone-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-700 inline-block" /> Available</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900 inline-block" /> Unavailable</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-stone-800 inline-block" /> Not set</span>
        </div>
      </div>
    </div>
  )
}
