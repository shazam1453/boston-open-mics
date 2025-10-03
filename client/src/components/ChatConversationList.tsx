import { formatDistanceToNow } from 'date-fns'

interface ChatConversationListProps {
  conversations: any[]
  selectedConversation: any | null
  onSelectConversation: (conversation: any) => void
  currentUserId: string
}

export default function ChatConversationList({
  conversations,
  selectedConversation,
  onSelectConversation,
  currentUserId
}: ChatConversationListProps) {
  
  const formatLastMessageTime = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true })
    } catch {
      return ''
    }
  }

  return (
    <div className="divide-y divide-gray-200">
      {conversations.map((conversation) => {
        const isSelected = selectedConversation?.id === conversation.id
        const isGroupChat = conversation.type === 'group'
        const otherUser = conversation.other_user
        const lastMessage = conversation.last_message
        const hasUnreadMessages = lastMessage && 
          lastMessage.sender_id !== currentUserId && 
          !lastMessage.read_at

        // Display name and avatar logic
        const displayName = isGroupChat 
          ? conversation.display_name || conversation.title
          : otherUser?.name || 'Unknown User'
        
        const avatarText = isGroupChat 
          ? '👥' 
          : otherUser?.name?.charAt(0)?.toUpperCase() || '?'

        return (
          <div
            key={conversation.id}
            onClick={() => onSelectConversation(conversation)}
            className={`p-4 cursor-pointer hover:bg-gray-50 transition-colors ${
              isSelected ? 'bg-blue-50 border-r-2 border-blue-500' : ''
            }`}
          >
            <div className="flex items-start space-x-3">
              {/* Avatar */}
              <div className="flex-shrink-0">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isGroupChat ? 'bg-green-100' : 'bg-gray-300'
                }`}>
                  <span className={`text-sm font-medium ${
                    isGroupChat ? 'text-green-700' : 'text-gray-700'
                  }`}>
                    {avatarText}
                  </span>
                </div>
              </div>

              {/* Conversation Info */}
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className={`text-sm font-medium truncate ${
                      hasUnreadMessages ? 'text-gray-900' : 'text-gray-700'
                    }`}>
                      {displayName}
                    </h3>
                    {/* Group chat info or user type */}
                    {isGroupChat ? (
                      <div className="flex items-center space-x-2 mt-1">
                        <span className="text-xs text-green-600 bg-green-100 px-2 py-0.5 rounded">
                          Group
                        </span>
                        {conversation.participant_count && (
                          <span className="text-xs text-gray-500">
                            {conversation.participant_count} members
                          </span>
                        )}
                        {conversation.event && (
                          <span className="text-xs text-blue-600">
                            📅 Event Chat
                          </span>
                        )}
                      </div>
                    ) : otherUser?.performer_type && (
                      <p className="text-xs text-gray-400 mt-1 capitalize">
                        {otherUser.performer_type}
                      </p>
                    )}
                  </div>
                  {lastMessage && (
                    <span className="text-xs text-gray-500 flex-shrink-0 ml-2">
                      {formatLastMessageTime(lastMessage.timestamp)}
                    </span>
                  )}
                </div>

                {/* Last Message Preview */}
                {lastMessage ? (
                  <div className="flex items-center mt-1">
                    <p className={`text-sm truncate ${
                      hasUnreadMessages ? 'font-medium text-gray-900' : 'text-gray-500'
                    }`}>
                      {lastMessage.sender_id === currentUserId ? 'You: ' : 
                       lastMessage.sender_id === 'system' ? '🔔 ' :
                       isGroupChat ? `${lastMessage.sender_name || 'Someone'}: ` : ''}
                      {lastMessage.message_text}
                    </p>
                    {hasUnreadMessages && (
                      <div className="ml-2 w-2 h-2 bg-blue-500 rounded-full flex-shrink-0"></div>
                    )}
                  </div>
                ) : (
                  <p className="text-sm text-gray-400 mt-1">No messages yet</p>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}