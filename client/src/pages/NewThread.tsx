import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { boardAPI } from '../utils/api'

const CATEGORIES = [
  { value: 'general', label: 'General' },
  { value: 'shows', label: 'Shows' },
  { value: 'gear', label: 'Gear' },
  { value: 'intros', label: 'Intros' },
  { value: 'other', label: 'Other' },
]

export default function NewThread() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('general')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!user) {
    return (
      <div className="max-w-xl mx-auto text-center py-16 text-stone-400">
        <Link to="/login" className="text-amber-400 hover:underline">Log in</Link> to post a thread
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim() || !body.trim()) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await boardAPI.createThread({ title: title.trim(), body: body.trim(), category })
      navigate(`/board/${res.data.id}`)
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to create thread')
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <Link to="/board" className="text-stone-400 hover:text-amber-400 text-sm transition-colors">
          ← Back to board
        </Link>
        <h1 className="text-2xl font-bold mt-2">New Thread</h1>
      </div>

      {error && <p className="text-red-400 text-sm">{error}</p>}

      <form onSubmit={handleSubmit} className="card space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-300 mb-1">Category</label>
          <div className="flex gap-2 flex-wrap">
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                type="button"
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
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-300 mb-1">Title</label>
          <input
            type="text"
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Thread title..."
            maxLength={255}
            required
            className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-stone-300 mb-1">Body</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="What's on your mind?"
            rows={8}
            required
            className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 resize-y"
          />
        </div>

        <div className="flex gap-3">
          <button type="submit" disabled={submitting || !title.trim() || !body.trim()} className="btn btn-primary">
            {submitting ? 'Posting...' : 'Post Thread'}
          </button>
          <Link to="/board" className="btn btn-secondary">Cancel</Link>
        </div>
      </form>
    </div>
  )
}
