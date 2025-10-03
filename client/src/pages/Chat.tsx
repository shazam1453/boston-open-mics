import { useState, useEffect } from 'react'
import { useAuth } from '../hooks/useAuth'
import { chatAPI } from '../utils/api'
import ChatConversationList from '../components/ChatConversationList'
import ChatMessageView from '../components/ChatMessageView'
import StartChatModal from '../components/StartChatModal'

export default function Chat() {
  const { user, loading } = useAuth()
  const [conversations, setConversations] = useState<any[]>([])
  const [selectedConversation, setSelectedConversation] = useState<any | null>(null)
  const [showStartChat, setShowStartChat] = useState(false)
  const [loadingConversations, setLoadingConversations] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [lastMessageIds, setLastMessageIds] = useState<{[key: string]: string}>({})
  const [notificationPermission, setNotificationPermission] = useState<NotificationPermission>('default')

  // Request notification permission
  const requestNotificationPermission = async () => {
    if ('Notification' in window) {
      const permission = await Notification.requestPermission()
      setNotificationPermission(permission)
    }
  }

  // Show notification for new message
  const showNotification = (conversation: any, message: any) => {
    if (notificationPermission === 'granted' && document.hidden) {
      const title = conversation.type === 'group' 
        ? `${conversation.title}: ${message.sender_name}`
        : message.sender_name || 'New Message'
      
      const notification = new Notification(title, {
        body: message.message_text,
        icon: '/favicon.ico',
        tag: `chat-${conversation.id}` // Prevents duplicate notifications
      })

      // Close notification after 5 seconds
      setTimeout(() => notification.close(), 5000)

      // Focus window when notification is clicked
      notification.onclick = () => {
        window.focus()
        setSelectedConversation(conversation)
        notification.close()
      }
    }
  }

  // Load conversations with smart refresh
  const loadConversations = async (silent = false) => {
    try {
      if (!silent) {
        setLoadingConversations(true)
      }
      const response = await chatAPI.getConversations()
      const newConversations = response.data

      // Check for new messages and show notifications
      if (user && lastMessageIds && Object.keys(lastMessageIds).length > 0) {
        newConversations.forEach((conversation: any) => {
          const lastMessage = conversation.last_message
          if (lastMessage && 
              lastMessage.sender_id !== user.id.toString() && 
              lastMessageIds[conversation.id] !== lastMessage.id) {
            showNotification(conversation, lastMessage)
          }
        })
      }

      // Update last message IDs for notification tracking
      const newLastMessageIds: {[key: string]: string} = {}
      newConversations.forEach((conversation: any) => {
        if (conversation.last_message) {
          newLastMessageIds[conversation.id] = conversation.last_message.id
        }
      })
      setLastMessageIds(newLastMessageIds)

      setConversations(newConversations)
      setError(null)
    } catch (error: any) {
      console.error('Failed to load conversations:', error)
      if (!silent) {
        setError('Failed to load conversations')
      }
    } finally {
      if (!silent) {
        setLoadingConversations(false)
      }
    }
  }

  useEffect(() => {
    if (user) {
      loadConversations()
      requestNotificationPermission()
    }
  }, [user])

  // Smart polling for new messages
  useEffect(() => {
    if (!user) return

    const interval = setInterval(() => {
      // Use silent refresh to avoid loading indicators
      loadConversations(true)
    }, 3000) // Reduced to 3 seconds for better responsiveness

    return () => clearInterval(interval)
  }, [user, lastMessageIds])

  // Faster polling when window is focused and chat is active
  useEffect(() => {
    if (!user || !selectedConversation) return

    const handleVisibilityChange = () => {
      if (!document.hidden) {
        // Refresh immediately when user returns to tab
        loadConversations(true)
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange)
  }, [user, selectedConversation])

  const handleStartChat = async (otherUserId: string) => {
    try {
      const response = await chatAPI.startConversation(otherUserId)
      const newConversation = response.data
      
      // Add to conversations if not already there
      setConversations(prev => {
        const exists = prev.find(c => c.id === newConversation.id)
        if (exists) return prev
        return [newConversation, ...prev]
      })
      
      setSelectedConversation(newConversation)
      setShowStartChat(false)
    } catch (error: any) {
      console.error('Failed to start conversation:', error)
      setError('Failed to start conversation')
    }
  }

  if (loading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>
  }

  if (!user) {
    return <div className="text-center">Please log in to access chat.</div>
  }

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Mobile: Single view with toggle between conversations and messages */}
      {/* Desktop: Side-by-side layout */}
      
      {/* Conversations Sidebar - Hidden on mobile when chat is selected */}
      <div className={`
        ${selectedConversation ? 'hidden md:flex' : 'flex'} 
        w-full md:w-1/3 bg-white border-r border-gray-200 flex-col
      `}>
        <div className="p-4 border-b border-gray-200">
          <div className="flex justify-between items-center">
            <h1 className="text-xl font-bold">Messages</h1>
            <button
              onClick={() => setShowStartChat(true)}
              className="btn btn-primary btn-sm"
            >
              <span className="hidden sm:inline">New Chat</span>
              <span className="sm:hidden">+</span>
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loadingConversations ? (
            <div className="p-4 text-center text-gray-500">Loading conversations...</div>
          ) : error ? (
            <div className="p-4 text-center text-red-500">{error}</div>
          ) : conversations.length === 0 ? (
            <div className="p-4 text-center text-gray-500">
              No conversations yet. Start a new chat!
            </div>
          ) : (
            <ChatConversationList
              conversations={conversations}
              selectedConversation={selectedConversation}
              onSelectConversation={(conversation) => {
                setSelectedConversation(conversation)
                // On mobile, selecting a conversation hides the sidebar
              }}
              currentUserId={user.id.toString()}
            />
          )}
        </div>
      </div>

      {/* Messages Area - Hidden on mobile when no chat selected */}
      <div className={`
        ${selectedConversation ? 'flex' : 'hidden md:flex'} 
        flex-1 flex-col
      `}>
        {selectedConversation ? (
          <div className="flex flex-col h-full">
            {/* Mobile: Back button header */}
            <div className="md:hidden bg-white border-b border-gray-200 p-4">
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => setSelectedConversation(null)}
                  className="text-gray-600 hover:text-gray-800"
                >
                  ← Back
                </button>
                <div className="flex-1">
                  <h2 className="font-semibold text-gray-900">
                    {selectedConversation.type === 'group' 
                      ? selectedConversation.title 
                      : selectedConversation.other_user_name || 'Chat'
                    }
                  </h2>
                </div>
              </div>
            </div>
            
            {/* Chat messages */}
            <div className="flex-1">
              <ChatMessageView
                conversation={selectedConversation}
                currentUserId={user.id.toString()}
                onMessageSent={() => loadConversations(true)}
                onChatDeleted={() => {
                  setSelectedConversation(null)
                  loadConversations(true)
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-gray-500">
            <div className="text-center">
              <div className="text-6xl mb-4">💬</div>
              <h2 className="text-xl font-semibold mb-2">Select a conversation</h2>
              <p className="hidden md:block">Choose a conversation from the sidebar to start messaging</p>
              <p className="md:hidden">No conversations selected</p>
            </div>
          </div>
        )}
      </div>

      {/* Start Chat Modal */}
      {showStartChat && (
        <StartChatModal
          onClose={() => setShowStartChat(false)}
          onStartChat={handleStartChat}
        />
      )}
    </div>
  )
}