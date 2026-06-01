import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { usersAPI, chatAPI } from '../utils/api'

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function getNext6Weeks() {
  const weeks: Date[][] = []
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const start = new Date(today)
  start.setDate(start.getDate() - start.getDay())
  for (let w = 0; w < 6; w++) {
    const week: Date[] = []
    for (let d = 0; d < 7; d++) {
      const day = new Date(start)
      day.setDate(start.getDate() + w * 7 + d)
      week.push(day)
    }
    weeks.push(week)
  }
  return weeks
}

export default function UserProfile() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user: currentUser } = useAuth()
  const [profile, setProfile] = useState<any>(null)
  const [availability, setAvailability] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)
  const [startingChat, setStartingChat] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) return
    Promise.all([
      usersAPI.getById(id),
      usersAPI.getAvailability(id)
    ]).then(([profileRes, availRes]) => {
      setProfile(profileRes.data)
      setAvailability(availRes.data.availability || {})
    }).catch(() => setError('User not found')).finally(() => setLoading(false))
  }, [id])

  const handleStartChat = async () => {
    if (!currentUser) { navigate('/login'); return }
    setStartingChat(true)
    try {
      await chatAPI.startConversation(id!)
      navigate('/chat')
    } catch {
      setError('Failed to start conversation')
    } finally {
      setStartingChat(false)
    }
  }

  if (loading) return <div className="text-center py-12">Loading...</div>
  if (error || !profile) return <div className="text-center py-12 text-red-500">{error || 'User not found'}</div>

  const weeks = getNext6Weeks()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

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
          <button
            onClick={handleStartChat}
            disabled={startingChat}
            className="btn btn-primary whitespace-nowrap"
          >
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
        <h2 className="text-lg font-semibold mb-4">Availability</h2>
        <div className="grid grid-cols-7 gap-1 text-center text-xs text-stone-400 mb-1">
          {DAYS.map(d => <div key={d}>{d}</div>)}
        </div>
        <div className="space-y-1">
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 gap-1">
              {week.map((day, di) => {
                const key = day.toISOString().split('T')[0]
                const status = availability[key]
                const isPast = day < today
                return (
                  <div
                    key={di}
                    className={`aspect-square rounded flex flex-col items-center justify-center text-xs
                      ${isPast ? 'opacity-30' : ''}
                      ${status === 'available' ? 'bg-green-700 text-white' :
                        status === 'unavailable' ? 'bg-red-900 text-stone-400' :
                        'bg-surface-700 text-stone-500'}
                    `}
                  >
                    <span className="text-xs leading-none">{MONTHS[day.getMonth()]}</span>
                    <span className="font-semibold">{day.getDate()}</span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
        <div className="flex gap-4 mt-3 text-xs text-stone-400">
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-700 inline-block"/> Available</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-900 inline-block"/> Unavailable</span>
          <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-surface-700 inline-block"/> Not set</span>
        </div>
      </div>
    </div>
  )
}
