import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { boardAPI } from '../utils/api'
import ReactionButtons from '../components/ReactionButtons'

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

function PostBody({ text }: { text: string }) {
  return (
    <div className="text-stone-300 whitespace-pre-wrap break-words leading-relaxed">
      {text}
    </div>
  )
}

export default function ThreadDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user } = useAuth()
  const [thread, setThread] = useState<any>(null)
  const [replies, setReplies] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Reply form
  const [replyBody, setReplyBody] = useState('')
  const [submitting, setSubmitting] = useState(false)

  // Edit state
  const [editingReplyId, setEditingReplyId] = useState<number | null>(null)
  const [editReplyBody, setEditReplyBody] = useState('')
  const [editingThread, setEditingThread] = useState(false)
  const [editTitle, setEditTitle] = useState('')
  const [editBody, setEditBody] = useState('')

  const replyRef = useRef<HTMLTextAreaElement>(null)

  const isModPlus = ['moderator', 'admin', 'super_admin'].includes(user?.role || '')

  useEffect(() => {
    if (!id) return
    boardAPI.getThread(id)
      .then(res => {
        setThread(res.data.thread)
        setReplies(res.data.replies)
      })
      .catch(() => setError('Thread not found'))
      .finally(() => setLoading(false))
  }, [id])

  const handleReply = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!replyBody.trim() || submitting) return
    setSubmitting(true)
    try {
      const res = await boardAPI.createReply(id!, replyBody)
      setReplies(prev => [...prev, res.data])
      setThread((t: any) => ({ ...t, reply_count: t.reply_count + 1, last_reply_at: new Date().toISOString() }))
      setReplyBody('')
    } catch (err: any) {
      setError(err.response?.data?.message || 'Failed to post reply')
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteThread = async () => {
    if (!confirm('Delete this thread? This cannot be undone.')) return
    try {
      await boardAPI.deleteThread(id!)
      navigate('/board')
    } catch {
      setError('Failed to delete thread')
    }
  }

  const handleDeleteReply = async (replyId: number) => {
    if (!confirm('Delete this reply?')) return
    try {
      await boardAPI.deleteReply(replyId)
      setReplies(prev => prev.filter(r => r.id !== replyId))
      setThread((t: any) => ({ ...t, reply_count: Math.max(0, t.reply_count - 1) }))
    } catch {
      setError('Failed to delete reply')
    }
  }

  const startEditReply = (reply: any) => {
    setEditingReplyId(reply.id)
    setEditReplyBody(reply.body)
  }

  const handleSaveReply = async (replyId: number) => {
    try {
      const res = await boardAPI.editReply(replyId, editReplyBody)
      setReplies(prev => prev.map(r => r.id === replyId ? { ...r, body: res.data.body, updated_at: res.data.updated_at } : r))
      setEditingReplyId(null)
    } catch {
      setError('Failed to save edit')
    }
  }

  const startEditThread = () => {
    setEditTitle(thread.title)
    setEditBody(thread.body)
    setEditingThread(true)
  }

  const handleSaveThread = async () => {
    try {
      const res = await boardAPI.editThread(id!, { title: editTitle, body: editBody })
      setThread((t: any) => ({ ...t, title: res.data.title, body: res.data.body }))
      setEditingThread(false)
    } catch {
      setError('Failed to save thread')
    }
  }

  const handlePin = async () => {
    try {
      const res = await boardAPI.pinThread(id!)
      setThread((t: any) => ({ ...t, is_pinned: res.data.is_pinned }))
    } catch {
      setError('Failed to pin thread')
    }
  }

  const handleLock = async () => {
    try {
      const res = await boardAPI.lockThread(id!)
      setThread((t: any) => ({ ...t, is_locked: res.data.is_locked }))
    } catch {
      setError('Failed to lock thread')
    }
  }

  if (loading) return <div className="text-center py-12">Loading...</div>
  if (error && !thread) return <div className="text-center py-12 text-red-400">{error}</div>

  const canEditThread = user && (user.id === thread.author_id || isModPlus)

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      {/* Back link */}
      <Link to="/board" className="text-stone-400 hover:text-amber-400 text-sm transition-colors">
        ← Back to board
      </Link>

      {/* Thread OP */}
      <div className="card space-y-3">
        {editingThread ? (
          <div className="space-y-3">
            <input
              className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-stone-100 text-lg font-semibold focus:outline-none focus:border-amber-500"
              value={editTitle}
              onChange={e => setEditTitle(e.target.value)}
            />
            <textarea
              className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 resize-none"
              rows={6}
              value={editBody}
              onChange={e => setEditBody(e.target.value)}
            />
            <div className="flex gap-2">
              <button onClick={handleSaveThread} className="btn btn-primary text-sm py-1.5">Save</button>
              <button onClick={() => setEditingThread(false)} className="btn btn-secondary text-sm py-1.5">Cancel</button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {thread.is_pinned && <span className="text-xs bg-amber-900 text-amber-300 px-1.5 py-0.5 rounded">📌 Pinned</span>}
                  {thread.is_locked && <span className="text-xs bg-stone-700 text-stone-300 px-1.5 py-0.5 rounded">🔒 Locked</span>}
                  <span className="text-xs bg-stone-800 text-stone-400 px-1.5 py-0.5 rounded capitalize">{thread.category}</span>
                </div>
                <h1 className="text-2xl font-bold mt-1">{thread.title}</h1>
                <p className="text-xs text-stone-500 mt-0.5">
                  posted by{' '}
                  <Link to={`/users/${thread.author_slug}`} className="text-amber-400 hover:underline">
                    {thread.author_name || 'deleted user'}
                  </Link>
                  {' · '}{timeAgo(thread.created_at)}
                </p>
              </div>
              {canEditThread && (
                <div className="flex gap-1 flex-shrink-0">
                  {isModPlus && (
                    <>
                      <button onClick={handlePin} className="text-xs px-2 py-1 rounded bg-stone-800 text-stone-400 hover:bg-stone-700">
                        {thread.is_pinned ? 'Unpin' : 'Pin'}
                      </button>
                      <button onClick={handleLock} className="text-xs px-2 py-1 rounded bg-stone-800 text-stone-400 hover:bg-stone-700">
                        {thread.is_locked ? 'Unlock' : 'Lock'}
                      </button>
                    </>
                  )}
                  <button onClick={startEditThread} className="text-xs px-2 py-1 rounded bg-stone-800 text-stone-400 hover:bg-stone-700">Edit</button>
                  <button onClick={handleDeleteThread} className="text-xs px-2 py-1 rounded bg-red-900 text-red-300 hover:bg-red-800">Delete</button>
                </div>
              )}
            </div>
            <PostBody text={thread.body} />
            <ReactionButtons
              targetType="thread"
              targetId={thread.id}
              ups={thread.ups ?? 0}
              downs={thread.downs ?? 0}
              myReaction={thread.my_reaction ?? null}
            />
          </>
        )}
      </div>

      {/* Replies */}
      {replies.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm text-stone-400 font-medium">{replies.length} {replies.length === 1 ? 'reply' : 'replies'}</p>
          {replies.map((reply, i) => {
            const canEditReply = user && (user.id === reply.author_id || isModPlus)
            return (
              <div key={reply.id} className="card space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-stone-500">
                    <span className="text-stone-600">#{i + 1}</span>
                    <Link to={`/users/${reply.author_slug}`} className="text-amber-400 hover:underline font-medium">
                      {reply.author_name || 'deleted user'}
                    </Link>
                    <span>{timeAgo(reply.created_at)}</span>
                    {reply.updated_at !== reply.created_at && <span className="italic">(edited)</span>}
                  </div>
                  {canEditReply && editingReplyId !== reply.id && (
                    <div className="flex gap-1">
                      <button onClick={() => startEditReply(reply)} className="text-xs px-2 py-0.5 rounded bg-stone-800 text-stone-400 hover:bg-stone-700">Edit</button>
                      <button onClick={() => handleDeleteReply(reply.id)} className="text-xs px-2 py-0.5 rounded bg-red-900 text-red-300 hover:bg-red-800">Delete</button>
                    </div>
                  )}
                </div>

                {editingReplyId === reply.id ? (
                  <div className="space-y-2">
                    <textarea
                      className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-stone-100 focus:outline-none focus:border-amber-500 resize-none text-sm"
                      rows={4}
                      value={editReplyBody}
                      onChange={e => setEditReplyBody(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => handleSaveReply(reply.id)} className="btn btn-primary text-sm py-1">Save</button>
                      <button onClick={() => setEditingReplyId(null)} className="btn btn-secondary text-sm py-1">Cancel</button>
                    </div>
                  </div>
                ) : (
                  <>
                    <PostBody text={reply.body} />
                    <ReactionButtons
                      targetType="reply"
                      targetId={reply.id}
                      ups={reply.ups ?? 0}
                      downs={reply.downs ?? 0}
                      myReaction={reply.my_reaction ?? null}
                    />
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Reply form */}
      {user ? (
        thread.is_locked ? (
          <div className="card text-center text-stone-500 text-sm py-4">🔒 This thread is locked</div>
        ) : (
          <div className="card space-y-3">
            <p className="text-sm font-medium text-stone-300">Post a reply</p>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <form onSubmit={handleReply} className="space-y-3">
              <textarea
                ref={replyRef}
                value={replyBody}
                onChange={e => setReplyBody(e.target.value)}
                placeholder="Write your reply..."
                rows={4}
                className="w-full px-3 py-2 rounded bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500 resize-none text-sm"
              />
              <button
                type="submit"
                disabled={submitting || !replyBody.trim()}
                className="btn btn-primary text-sm py-1.5"
              >
                {submitting ? 'Posting...' : 'Post Reply'}
              </button>
            </form>
          </div>
        )
      ) : (
        <div className="card text-center text-stone-400 text-sm py-4">
          <Link to="/login" className="text-amber-400 hover:underline">Log in</Link> to reply
        </div>
      )}
    </div>
  )
}
