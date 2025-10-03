import { useState, useEffect, useRef } from 'react'
import { chatAPI } from '../utils/api'
import { formatDistanceToNow, format } from 'date-fns'

interface ChatMessageViewProps {
  conversation: any
  currentUserId: string
  onMessageSent: () => void
}

export default function ChatMessageView({
  conversation,
  currentUserId,
  onMessageSent
}: ChatMessageViewProps) {
  const [messages, setMessages] = useState<any[]>([])
  const [newMessage, setNewMessage] = useState('')
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)

  const otherUser = conversation.other_user

  // Load messages for this conversation
  const loadMessages = async () => {
    try {
      setLoading(true)
      const response = await chatAPI.getMessages(conversation.id, 50)
      setMessages(response.data.messages)
      setError(null)
    } catch (error: any) {
      console.error('Failed to load messages:', error)
      setError('Failed to load messages')
    } finally {
      setLoading(false)
    }
  }

  // Load messages when conversation changes
  useEffect(() => {
    if (conversation) {
      loadMessages()
    }
  }, [conversation.id])

  // Poll for new messages every 3 seconds
  useEffect(() => {
    if (!conversation) return

    const interval = setInterval(() => {
      loadMessages()
    }, 3000)

    return () => clearInterval(interval)
  }, [conversation.id])

  // Scroll to bottom when messages change
  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Mark messages as read when they come into view
  useEffect(() => {
    const unreadMessages = messages.filter(msg => 
      msg.recipient_id === currentUserId && !msg.read_at
    )

    unreadMessages.forEach(async (msg) => {
      try {
        await chatAPI.markMessageAsRead(msg.id)
      } catch (error) {
        console.error('Failed to mark message as read:', error)
      }
    })
  }, [messages, currentUserId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    
    if (!newMessage.trim() || sending) return

    const messageText = newMessage.trim()
    setNewMessage('')
    setSending(true)

    try {
      await chatAPI.sendMessage(conversation.id, messageText)
      await loadMessages() // Reload to get the new message
      onMessageSent() // Update conversation list
      scrollToBottom()
    } catch (error: any) {
      console.error('Failed to send message:', error)
      setError('Failed to send message')
      setNewMessage(messageText) // Restore message on error
    } finally {
      setSending(false)
    }
  }

  const formatMessageTime = (timestamp: string) => {
    const date = new Date(timestamp)
    const now = new Date()
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60)

    if (diffInHours < 24) {
      return format(date, 'h:mm a')
    } else if (diffInHours < 168) { // 7 days
      return format(date, 'EEE h:mm a')
    } else {
      return format(date, 'MMM d, h:mm a')
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 bg-white">
        <div className="flex items-center space-x-3">
          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
            <span className="text-sm font-medium text-gray-700">
              {otherUser?.name?.charAt(0)?.toUpperCase() || '?'}
            </span>
          </div>
          <div>
            <h2 className="font-semibold text-gray-900">{otherUser?.name || 'Unknown User'}</h2>
            {otherUser?.performer_type && (
              <p className="text-sm text-gray-500 capitalize">{otherUser.performer_type}</p>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50"
      >
        {loading ? (
          <div className="text-center text-gray-500">Loading messages...</div>
        ) : error ? (
          <div className="text-center text-red-500">{error}</div>
        ) : messages.length === 0 ? (
          <div className="text-center text-gray-500">
            No messages yet. Start the conversation!
          </div>
        ) : (
          messages.map((message, index) => {
            const isFromCurrentUser = message.sender_id === currentUserId
            const showTimestamp = index === 0 || 
              (new Date(message.timestamp).getTime() - new Date(messages[index - 1].timestamp).getTime()) > 300000 // 5 minutes

            return (
              <div key={message.id}>
                {showTimestamp && (
                  <div className="text-center text-xs text-gray-400 my-4">
                    {formatMessageTime(message.timestamp)}
                  </div>
                )}
                <div className={`flex ${isFromCurrentUser ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                    isFromCurrentUser 
                      ? 'bg-blue-500 text-white' 
                      : 'bg-white text-gray-900 border border-gray-200'
                  }`}>
                    <p className="text-sm">{message.message_text}</p>
                    <div className={`text-xs mt-1 ${
                      isFromCurrentUser ? 'text-blue-100' : 'text-gray-500'
                    }`}>
                      {formatDistanceToNow(new Date(message.timestamp), { addSuffix: true })}
                      {isFromCurrentUser && message.read_at && (
                        <span className="ml-2">✓</span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )
          })
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Message Input */}
      <div className="p-4 bg-white border-t border-gray-200">
        <form onSubmit={handleSendMessage} className="flex space-x-2">
          <input
            type="text"
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            placeholder="Type a message..."
            className="flex-1 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            maxLength={1000}
            disabled={sending}
          />
          <button
            type="submit"
            disabled={!newMessage.trim() || sending}
            className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {sending ? '...' : 'Send'}
          </button>
        </form>
      </div>
    </div>
  )
}