import { useState, useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { usersAPI } from '../utils/api'

interface Performer {
  id: number
  slug: string
  name: string
  performer_type: string | null
  bio: string | null
}

export default function PerformerSearch() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Performer[]>([])
  const [loading, setLoading] = useState(false)
  const [searched, setSearched] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setSearched(false)
      return
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await usersAPI.search(query.trim())
        setResults(res.data as unknown as Performer[])
        setSearched(true)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold mb-1">Find Performers</h1>
        <p className="text-stone-400">Search by name or type (e.g. comedian, musician, poet)</p>
      </div>

      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 text-lg pointer-events-none">🔍</span>
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search performers..."
          autoFocus
          className="w-full pl-10 pr-4 py-3 rounded-lg text-base bg-stone-800 border border-stone-700 text-stone-100 placeholder-stone-500 focus:outline-none focus:border-amber-500"
        />
        {loading && (
          <span className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-400 text-sm">...</span>
        )}
      </div>

      {searched && results.length === 0 && !loading && (
        <p className="text-center text-stone-400 py-8">No performers found for "{query}"</p>
      )}

      {results.length > 0 && (
        <div className="space-y-3">
          {results.map(performer => (
            <Link
              key={performer.id}
              to={`/users/${performer.slug}`}
              className="card flex items-center gap-4 hover:border-amber-500 border border-stone-700 transition-colors no-underline"
            >
              <div className="w-12 h-12 rounded-full bg-amber-500 flex items-center justify-center text-xl font-bold text-gray-900 flex-shrink-0">
                {performer.name?.charAt(0)?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-stone-100">{performer.name}</p>
                {performer.performer_type && (
                  <p className="text-sm text-amber-400 capitalize">{performer.performer_type}</p>
                )}
                {performer.bio && (
                  <p className="text-sm text-stone-400 truncate mt-0.5">{performer.bio}</p>
                )}
              </div>
              <span className="ml-auto text-stone-500 flex-shrink-0">›</span>
            </Link>
          ))}
        </div>
      )}

      {!searched && query.length < 2 && (
        <div className="text-center py-12 text-stone-500">
          <p className="text-4xl mb-3">🎤</p>
          <p>Start typing to find performers</p>
        </div>
      )}
    </div>
  )
}
