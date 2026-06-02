import { useState, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { boardAPI } from '../utils/api'

const CATEGORIES = [
  { value: '', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'shows', label: 'Shows' },
  { value: 'gear', label: 'Gear' },
  { value: 'intros', label: 'Intros' },
  { value: 'other', label: 'Other' },
]

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m ago`
  const hrs = Math.floor(mins / 60)
  if (hrs < 24) return `${hrs}h ago`
  const days = Math.floor(hrs / 24)
  if (days < 30) return `${days}d ago`
  return new Date(dateStr).toLocaleDateString()
}

export default function Board() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [threads, setThreads] = useState<any[]>([])
  const [category, setCategory] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    boardAPI.listThreads(category || undefined)
      .then(res => setThreads(res.data))
      .catch(() => setThreads([]))
      .finally(() => setLoading(false))
  }, [category])

  return (
    <div className="max-w-3xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Message Board</h1>
          <p className="text-stone-400 text-sm mt-0.5">Talk shows, gear, introductions, and more</p>
        </div>
        {user ? (
          <button onClick={() => navigate('/board/new')} className="btn btn-primary">
            + New Thread
          </button>
        ) : (
          <Link to="/login" className="btn btn-secondary text-sm">Log in to post</Link>
        )}
      </div>

      {/* Category tabs */}
      <div className="flex gap-1 flex-wrap">
        {CATEGORIES.map(c => (
          <button
            key={c.value}
            onClick={() => setCategory(c.value)}
            className={`px-3 py-1.5 rounded text-sm font-medium transition-colors ${
              category === c.value
                ? 'bg-amber-500 text-gray-900'
                : 'bg-stone-800 text-stone-300 hover:bg-stone-700'
            }`}
          >
            {c.label}
          </button>
        ))}
      </div>

      {/* Thread list */}
      {loading ? (
        <div className="text-center py-12 text-stone-400">Loading...</div>
      ) : threads.length === 0 ? (
        <div className="text-center py-16 text-stone-500">
          <p className="text-3xl mb-3">📋</p>
          <p>No threads yet. {user ? 'Start one!' : 'Log in to start one!'}</p>
        </div>
      ) : (
        <div className="divide-y divide-stone-800 border border-stone-800 rounded-lg overflow-hidden">
          {threads.map(thread => (
            <Link
              key={thread.id}
              to={`/board/${thread.id}`}
              className="flex items-start gap-3 px-4 py-3 bg-stone-900 hover:bg-stone-800 transition-colors no-underline group"
            >
              {/* Status icons */}
              <div className="flex flex-col items-center gap-1 pt-0.5 w-5 flex-shrink-0 text-stone-500 text-xs">
                {thread.is_pinned && <span title="Pinned">📌</span>}
                {thread.is_locked && <span title="Locked">🔒</span>}
                {!thread.is_pinned && !thread.is_locked && <span className="text-stone-600">💬</span>}
              </div>

              {/* Main content */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-stone-100 group-hover:text-amber-400 transition-colors truncate">
                  {thread.title}
                </p>
                <p className="text-xs text-stone-500 mt-0.5">
                  by {thread.author_name || 'deleted user'} ·{' '}
                  <span className="capitalize">{thread.category}</span>
                </p>
              </div>

              {/* Stats */}
              <div className="text-right flex-shrink-0 text-xs text-stone-500">
                <p>{thread.reply_count} {thread.reply_count === 1 ? 'reply' : 'replies'}</p>
                <p className="mt-0.5">
                  {thread.last_reply_at
                    ? timeAgo(thread.last_reply_at)
                    : timeAgo(thread.created_at)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
