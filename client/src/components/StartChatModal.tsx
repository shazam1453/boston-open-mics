import { useState } from 'react'
import { usersAPI } from '../utils/api'

interface StartChatModalProps {
  onClose: () => void
  onStartChat: (userId: string) => void
}

export default function StartChatModal({ onClose, onStartChat }: StartChatModalProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<any[]>([])
  const [searching, setSearching] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async (query: string) => {
    setSearchQuery(query)
    
    if (query.length < 2) {
      setSearchResults([])
      return
    }

    setSearching(true)
    setError(null)

    try {
      const response = await usersAPI.search(query)
      setSearchResults(response.data)
    } catch (error: any) {
      console.error('Search failed:', error)
      setError('Failed to search users')
      setSearchResults([])
    } finally {
      setSearching(false)
    }
  }

  const handleStartChat = (user: any) => {
    onStartChat(user.id)
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full max-h-96">
        <div className="p-6">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-xl font-bold text-gray-900">Start New Chat</h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>

          <div className="mb-4">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => handleSearch(e.target.value)}
              placeholder="Search for users by name..."
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded">
              {error}
            </div>
          )}

          <div className="max-h-64 overflow-y-auto">
            {searching ? (
              <div className="text-center py-4 text-gray-500">Searching...</div>
            ) : searchQuery.length < 2 ? (
              <div className="text-center py-4 text-gray-500">
                Type at least 2 characters to search for users
              </div>
            ) : searchResults.length === 0 ? (
              <div className="text-center py-4 text-gray-500">
                No users found matching "{searchQuery}"
              </div>
            ) : (
              <div className="space-y-2">
                {searchResults.map((user) => (
                  <div
                    key={user.id}
                    onClick={() => handleStartChat(user)}
                    className="p-3 hover:bg-gray-50 rounded-md cursor-pointer transition-colors"
                  >
                    <div className="flex items-center space-x-3">
                      <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                        <span className="text-sm font-medium text-gray-700">
                          {user.name?.charAt(0)?.toUpperCase() || '?'}
                        </span>
                      </div>
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{user.name}</h3>
                        <div className="flex items-center space-x-2 text-sm text-gray-500">
                          {user.performer_type && (
                            <span className="capitalize">{user.performer_type}</span>
                          )}
                          {user.email && (
                            <span>• {user.email}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}