import { useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { boardAPI } from '../utils/api'

interface Props {
  targetType: 'thread' | 'reply'
  targetId: number
  ups: number
  downs: number
  myReaction: 'up' | 'down' | null
}

export default function ReactionButtons({ targetType, targetId, ups, downs, myReaction }: Props) {
  const { user } = useAuth()
  const [counts, setCounts] = useState({ ups, downs })
  const [active, setActive] = useState<'up' | 'down' | null>(myReaction)
  const [loading, setLoading] = useState(false)

  const handleReact = async (reaction: 'up' | 'down') => {
    if (!user || loading) return
    setLoading(true)
    try {
      const res = await boardAPI.react(targetType, targetId, reaction)
      setCounts({ ups: res.data.ups, downs: res.data.downs })
      setActive(res.data.my_reaction)
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-1">
      <button
        onClick={() => handleReact('up')}
        disabled={!user || loading}
        title={user ? 'Thumbs up' : 'Log in to react'}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors
          ${active === 'up'
            ? 'bg-green-700 text-green-100'
            : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'}
          ${!user ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
      >
        👍 {counts.ups > 0 && <span>{counts.ups}</span>}
      </button>
      <button
        onClick={() => handleReact('down')}
        disabled={!user || loading}
        title={user ? 'Thumbs down' : 'Log in to react'}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium transition-colors
          ${active === 'down'
            ? 'bg-red-800 text-red-200'
            : 'bg-stone-800 text-stone-400 hover:bg-stone-700 hover:text-stone-200'}
          ${!user ? 'opacity-50 cursor-default' : 'cursor-pointer'}`}
      >
        👎 {counts.downs > 0 && <span>{counts.downs}</span>}
      </button>
    </div>
  )
}
