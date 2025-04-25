import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Card, 
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  CardFooter 
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Sidebar } from "@/components/home/Sidebar";
import { MobileHeader } from "@/components/home/MobileHeader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Send, Search, ArrowLeft } from "lucide-react";
import ProfileImage from "@/components/ProfileImage";
import { formatDistance, format, isToday, isYesterday, parseISO } from "date-fns";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { Profile as ProfileType } from "@/types";
import { createNotification } from '@/utils/notification-helper';
import { useNotifications } from "@/contexts/NotificationContext";
import { DeleteMessageModal } from "@/components/messages/DeleteMessageModal";

// Define types for our data
interface Profile {
  id: string;
  username: string;
  avatar_url: string | null;
  auth_metadata?: {
    full_name?: string;
    avatar_url?: string;
  };
}

interface Conversation {
  id: string;
  profile: Profile;
  last_message?: string;
  last_message_time?: string;
  unread_count: number;
}

// Message type as it exists in the database (only guaranteed fields)
interface DatabaseMessage {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  read: boolean;
}

interface Message {
  id: string;
  content: string;
  created_at: string;
  sender_id: string;
  receiver_id: string;
  read: boolean;
  is_edited: boolean;
  edited_at: string | null;
  is_deleted: boolean;
  deleted_at: string | null;
}

// Group messages by date for display
interface MessageGroup {
  date: string;
  formattedDate: string;
  messages: Message[];
}

export default function Messages() {
  const [activeTab, setActiveTab] = useState("Messages");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messageGroups, setMessageGroups] = useState<MessageGroup[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const [editMessageId, setEditMessageId] = useState<string | null>(null);
  const [editMessageContent, setEditMessageContent] = useState("");
  const [userRole, setUserRole] = useState<"business" | "customer" | null>(null);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  
  // Get unread notifications and messages from context
  const { unreadNotifications, unreadMessages, refreshCounts } = useNotifications();

  // Client-side read status tracking to work around RLS policy restrictions
  const [readStatusMap, setReadStatusMap] = useState<Record<string, boolean>>({});

  // Add state variables for message deletion confirmation
  const [messageToDelete, setMessageToDelete] = useState<string | null>(null);
  const [showDeleteMessageModal, setShowDeleteMessageModal] = useState(false);

  // Check auth and initialize user
  useEffect(() => {
    async function initializeUser() {
      try {
        // Get authenticated user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate('/auth');
          return;
        }
        
        setCurrentUserId(user.id);
        
        // Get user's role from profile
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (profile) {
          const typedProfile = profile as unknown as ProfileType;
          if (typedProfile.user_role) {
            setUserRole(typedProfile.user_role);
          }
        }
        
        // Check for direct message URL parameter
        const params = new URLSearchParams(window.location.search);
        const directUserId = params.get('user');
        
        if (directUserId) {
          // Get profile of user to message
          const { data: targetProfile } = await supabase
            .from('profiles')
            .select('id, username, avatar_url')
            .eq('id', directUserId)
            .single();
            
          if (targetProfile) {
            // Create conversation object
            const conversation = {
              id: directUserId,
              profile: targetProfile,
              last_message: "",
              unread_count: 0
            };
            
            setSelectedConversation(conversation);
            await fetchMessages(directUserId);
            
            // Focus on the input field after navigating from profile
            setTimeout(() => {
              if (messageInputRef.current) {
                messageInputRef.current.focus();
              }
            }, 300);
            
            // Clean up URL
            window.history.replaceState({}, document.title, "/messages");
          }
        }
        
        // Load all conversations
        await loadConversations(user.id);
      } catch (error) {
        console.error("Error initializing user:", error);
        navigate('/auth');
      }
    }
    
    initializeUser();
  }, [navigate]);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Load conversations with client-side read status
  async function loadConversations(userId: string) {
    try {
      setLoading(true);
      
      // Ensure messages table exists
      const { error: tableError } = await supabase
        .from('messages')
        .select('id')
        .limit(1);
      
      if (tableError) {
        console.log("Messages table might not exist yet");
        setConversations([]);
        setLoading(false);
        return;
      }
      
      // Get all messages for this user
      const { data: messages, error } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, receiver_id, read')
        .or(`sender_id.eq.${userId},receiver_id.eq.${userId}`)
        .order('created_at', { ascending: false });
        
      if (error) {
        throw error;
      }
      
      if (!messages || messages.length === 0) {
        setConversations([]);
        setLoading(false);
        return;
      }
      
      // Get unique conversation partners
      const partnerIds = new Set<string>();
      messages.forEach(msg => {
        const partnerId = msg.sender_id === userId ? msg.receiver_id : msg.sender_id;
        partnerIds.add(partnerId);
      });
      
      // Fetch all conversation partners' profiles
      const { data: profiles, error: profileError } = await supabase
        .from('profiles')
        .select('id, username, avatar_url')
        .in('id', Array.from(partnerIds));
      
      if (profileError) {
        throw profileError;
      }
      
      // Map profiles for easy lookup
      const profileMap = new Map();
      profiles?.forEach(profile => profileMap.set(profile.id, profile));
      
      // Create conversations map
      const conversationsMap = new Map<string, Conversation>();
      
      // First pass - create conversations with last message info
      messages.forEach(message => {
        const partnerId = message.sender_id === userId ? message.receiver_id : message.sender_id;
        const profile = profileMap.get(partnerId);
        
        if (!profile) return; // Skip if no profile found
        
        if (!conversationsMap.has(partnerId)) {
          conversationsMap.set(partnerId, {
            id: partnerId,
            profile,
            last_message: message.content,
            last_message_time: message.created_at,
            unread_count: 0
          });
        }
      });
      
      // Second pass - count unread messages using client-side tracking
      messages.forEach(message => {
        // Only count messages where user is the receiver and message is unread
        if (message.receiver_id === userId && !message.read && !readStatusMap[message.id]) {
          const conversation = conversationsMap.get(message.sender_id);
          if (conversation) {
            conversation.unread_count += 1;
          }
        }
      });
      
      // Convert map to array for state
      setConversations(Array.from(conversationsMap.values()));
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load conversations",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }

  // Fetch messages for a specific conversation
  async function fetchMessages(conversationId: string) {
    if (!currentUserId) return;
    
    try {
      // Get all messages between current user and conversation partner
      const { data, error } = await supabase
        .from('messages')
        .select('id, content, created_at, sender_id, receiver_id, read')
        .or(`and(sender_id.eq.${currentUserId},receiver_id.eq.${conversationId}),and(sender_id.eq.${conversationId},receiver_id.eq.${currentUserId})`)
        .order('created_at', { ascending: true });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        setMessages([]);
        groupMessagesByDate([]);
        return;
      }
      
      // Find messages that should be marked as read (where current user is receiver)
      const messagesToMarkAsRead = data
        .filter(msg => 
          msg.receiver_id === currentUserId && 
          !msg.read &&
          !readStatusMap[msg.id]
        )
        .map(msg => msg.id);
      
      console.log(`Found ${messagesToMarkAsRead.length} messages to mark as read`);
      
      if (messagesToMarkAsRead.length > 0) {
        // Update our client-side read status map
        const newReadStatusMap = { ...readStatusMap };
        messagesToMarkAsRead.forEach(id => {
          newReadStatusMap[id] = true;
        });
        setReadStatusMap(newReadStatusMap);
        
        // Try database update, but don't depend on it
        try {
          console.log("Attempting to update read status in database (may fail due to permissions)");
          for (const msgId of messagesToMarkAsRead) {
          await supabase
            .from('messages')
            .update({ read: true })
              .eq('id', msgId);
          }
        } catch (updateErr) {
          console.log("Database update failed (expected if RLS policy restricts it):", updateErr);
        }
      }
      
      // Process messages for display with client-side read status
      const processedMessages: Message[] = data.map((msg: DatabaseMessage) => ({
        id: msg.id,
        content: msg.content,
        created_at: msg.created_at,
        sender_id: msg.sender_id,
        receiver_id: msg.receiver_id,
        read: msg.read || readStatusMap[msg.id] || false, // Use our client-side read status
        is_edited: false,
        edited_at: null,
        is_deleted: false,
        deleted_at: null
      }));
      
      setMessages(processedMessages);
      groupMessagesByDate(processedMessages);
      scrollToBottom();
      
      // Update conversation unread count in UI
      setConversations(prev => 
        prev.map(conv => 
          conv.id === conversationId ? { ...conv, unread_count: 0 } : conv
        )
      );

      // After marking messages as read, refresh notification counts
      refreshCounts();
    } catch (error) {
      console.error("Error fetching messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    }
  }

  // Group messages by date for display
  function groupMessagesByDate(messages: Message[]) {
    const groups: MessageGroup[] = [];
    
    messages.forEach(message => {
      const messageDate = parseISO(message.created_at);
      const dateStr = format(messageDate, 'yyyy-MM-dd');
      
      // Get appropriate date display format
      let formattedDate = '';
      if (isToday(messageDate)) {
        formattedDate = 'Today';
      } else if (isYesterday(messageDate)) {
        formattedDate = 'Yesterday';
      } else {
        formattedDate = format(messageDate, 'dd/MM/yyyy');
      }
      
      // Find or create group
      let group = groups.find(g => g.date === dateStr);
      if (!group) {
        group = {
          date: dateStr,
          formattedDate,
          messages: []
        };
        groups.push(group);
      }
      
      group.messages.push(message);
    });
    
    setMessageGroups(groups);
  }

  // Handle selecting a conversation
  async function handleSelectConversation(conversation: Conversation) {
    // Update UI immediately
    setSelectedConversation(conversation);
    setConversations(prev => 
      prev.map(conv => 
        conv.id === conversation.id ? { ...conv, unread_count: 0 } : conv
      )
    );
    
    // Load messages and mark as read
    await fetchMessages(conversation.id);
    
    // Focus the message input after a short delay to ensure it's rendered
    setTimeout(() => {
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    }, 100);
  }

  // Send a new message
  async function handleSendMessage() {
    if (!newMessage.trim() || !selectedConversation || !currentUserId) return;
    
    setSendingMessage(true);
    
    try {
      // Create message object
      const messageData = {
        content: newMessage.trim(),
        sender_id: currentUserId,
        receiver_id: selectedConversation.id,
        read: false // Messages are unread when sent
      };
      
      // Insert message
      const { data, error } = await supabase
        .from('messages')
        .insert(messageData)
        .select();

      if (error) throw error;

      if (data && data[0]) {
        // Add to messages with proper typing
        const newMsg: Message = {
          id: data[0].id,
          content: data[0].content,
          created_at: data[0].created_at,
          sender_id: data[0].sender_id,
          receiver_id: data[0].receiver_id,
          read: data[0].read,
          is_edited: false,
          edited_at: null,
          is_deleted: false,
          deleted_at: null
        };
        
        // Update the messages array with the new message
        setMessages(prevMessages => [...prevMessages, newMsg]);
        groupMessagesByDate([...messages, newMsg]);
        
        // Clear the input field
      setNewMessage("");
        
        // Update conversation list
        setConversations(prev => 
          prev.map(conv => 
            conv.id === selectedConversation.id 
              ? { 
                  ...conv, 
                  last_message: messageData.content,
                  last_message_time: data[0].created_at
                } 
              : conv
          )
        );
        
        // Scroll to the bottom to show the new message
        scrollToBottom();
        
        // Create a notification for the recipient
        // Get current user's profile info for the notification
        const { data: profileData, error: profileError } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUserId)
          .single();
          
        if (!profileError && profileData) {
          await createNotification({
            userId: selectedConversation.id,
            actorId: currentUserId,
            actorName: profileData.username || 'Someone',
            type: 'message',
            entityId: data[0].id,
            message: `${profileData.username} sent you a message: "${newMessage.slice(0, 30)}${newMessage.length > 30 ? '...' : ''}"`
          });
        }
      }

      // Add this line at the end of the function to refresh notification counts
      refreshCounts();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  }

  // Scroll to bottom of messages
  function scrollToBottom() {
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  }

  // Format relative time (e.g. "5 minutes ago")
  function formatMessageTime(dateString: string) {
    return formatDistance(new Date(dateString), new Date(), { addSuffix: true });
  }
  
  // Format exact time (e.g. "14:30")
  function formatExactTime(dateString: string) {
    return format(parseISO(dateString), 'HH:mm');
  }
  
  // Handle edit message
  function handleEditMessage(message: Message) {
    setEditMessageId(message.id);
    setEditMessageContent(message.content);
  }
  
  // Save edited message
  async function handleSaveEdit() {
    if (!editMessageId || !editMessageContent.trim()) return;
    
    setSendingMessage(true);
    try {
      // Update message in database
      const updateData = { 
        content: editMessageContent
      };
      
      // Only update the fields that are known to exist in the database
      const { error } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', editMessageId);

      if (error) throw error;

      // Update UI with proper type handling
      const updatedMessages = messages.map(msg =>
        msg.id === editMessageId ? 
          {
            ...msg, 
            content: editMessageContent,
            is_edited: true,
            edited_at: new Date().toISOString()
          } : 
          msg
      );
      
      setMessages(updatedMessages);
      groupMessagesByDate(updatedMessages);
      
      // Clear edit state
      setEditMessageId(null);
      setEditMessageContent("");
      
      console.log("Message edited successfully");
      
    } catch (error) {
      console.error("Error updating message:", error);
      toast({
        title: "Error",
        description: "Failed to update message",
        variant: "destructive",
      });
    } finally {
      setSendingMessage(false);
    }
  }
  
  // Delete message
  async function handleDeleteMessage(messageId: string) {
    setMessageToDelete(messageId);
    setShowDeleteMessageModal(true);
  }

  // Create a new function to perform the actual deletion
  async function confirmDeleteMessage() {
    if (!messageToDelete) return;
    
    try {
      // Update message in database - only update content field that is known to exist
      const updateData = { 
        content: "[This message was deleted]"
      };
      
      const { error } = await supabase
        .from('messages')
        .update(updateData)
        .eq('id', messageToDelete);

      if (error) throw error;

      // Update UI with proper type handling
      const updatedMessages = messages.map(msg =>
        msg.id === messageToDelete ? 
          {
            ...msg, 
            content: "[This message was deleted]", 
            is_deleted: true, 
            deleted_at: new Date().toISOString()
          } : 
          msg
      );
      
      setMessages(updatedMessages);
      groupMessagesByDate(updatedMessages);
      
      console.log("Message deleted successfully");
      
    } catch (error) {
      console.error("Error deleting message:", error);
      toast({
        title: "Error",
        description: "Failed to delete message",
        variant: "destructive",
      });
    }
  }
  
  // Navigate to user profile
  function handleProfileClick(userId: string, username?: string) {
    if (username) {
      navigate(`/@${username}`);
    } else {
      navigate(`/user/${userId}`);
    }
  }

  // Filter conversations based on search
  const filteredConversations = conversations.filter(conv => 
    conv.profile.username?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !currentUserId) {
    return (
      <LoadingScreen 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole} 
      />
    );
  }

  return (
    <div className="lg:ml-64 min-h-screen overflow-x-hidden">
       <div className={`${selectedConversation && isMobile ? "hidden md:flex" : ""}`}>
        <Sidebar 
          activeTab={activeTab} 
          setActiveTab={setActiveTab} 
          userRole={userRole} 
          unreadNotifications={unreadNotifications}
          unreadMessages={unreadMessages}
        />
        </div>
      <div className="flex flex-col h-screen md:pt-0">
        
        {/* Always show the mobile header on the Messages page */}
        <MobileHeader 
          unreadNotifications={unreadNotifications}
          unreadMessages={unreadMessages}
        />
        
        <div className="flex flex-1 overflow-hidden">
          {/* Conversations sidebar */}
          <div className={`w-full md:w-80 border-r border-white/10 flex flex-col ${selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            <div className="p-4 border-b border-white/10">
                  <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 h-4 w-4" />
                    <Input
                  placeholder="Search conversations" 
                      className="pl-9"
                      value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                    />
                  </div>
                </div>

            <div className="flex-1 overflow-y-auto">
                  {loading ? (
                <div className="p-8 text-center text-foreground/60">
                  Loading conversations...
                </div>
              ) : filteredConversations.length > 0 ? (
                <>
                  {filteredConversations.map((conversation) => (
                    <div 
                      key={conversation.id}
                      className={`p-4 flex items-center gap-3 cursor-pointer hover:bg-foreground/5 ${
                        selectedConversation?.id === conversation.id ? 'bg-foreground/10' : ''
                      }`}
                      onClick={() => handleSelectConversation(conversation)}
                    >
                      <ProfileImage 
                        src={conversation.profile.avatar_url || conversation.profile.auth_metadata?.avatar_url} 
                        alt={conversation.profile.username}
                        className="w-12 h-12 rounded-full"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent conversation selection
                          handleProfileClick(conversation.id, conversation.profile.username);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center">
                          <h3 className="font-medium truncate text-foreground">
                            {conversation.profile.username || conversation.profile.auth_metadata?.full_name || 'User'}
                          </h3>
                          {conversation.last_message_time && (
                            <span className="text-xs text-foreground/40">
                              {formatMessageTime(conversation.last_message_time)}
                            </span>
                          )}
                        </div>
                        <div className="flex justify-between items-center">
                          <p className="text-sm text-foreground/60 truncate">
                            {conversation.last_message || "No messages yet"}
                          </p>
                          {conversation.unread_count > 0 && (
                            <span className="bg-primary rounded-full px-2 py-0.5 text-xs font-medium">
                              {conversation.unread_count}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </>
              ) : (
                <div className="p-8 text-center text-foreground/60">
                  {searchQuery ? 'No conversations found' : 'No conversations yet'}
              </div>
            )}
            </div>
          </div>
          
          {/* Message area */}
          <div className={`flex-1 flex flex-col ${!selectedConversation ? 'hidden md:flex' : 'flex'}`}>
            {selectedConversation ? (
              <>
                {/* Fixed header on mobile */}
                <div className="p-2 border-b border-foreground/10 flex items-center gap-1 w-full fixed top-0 z-10 bg-background">
                        <Button 
                          variant="ghost" 
                          size="icon" 
                          className="md:hidden"
                          onClick={() => setSelectedConversation(null)}
                        >
                          <ArrowLeft className="h-5 w-5" />
                        </Button>
                  <div 
                    className="cursor-pointer" 
                    onClick={() => handleProfileClick(selectedConversation.id, selectedConversation.profile.username)}
                  >
                    <ProfileImage 
                      src={selectedConversation.profile.avatar_url || selectedConversation.profile.auth_metadata?.avatar_url} 
                      alt={selectedConversation.profile.username}
                      className="w-8 h-8 rounded-full"
                    />
                  </div>
                  <div className="min-w-0 flex-1">
                    <h2 
                      className="font-medium cursor-pointer hover:underline truncate max-w-[200px]"
                      onClick={() => handleProfileClick(selectedConversation.id, selectedConversation.profile.username)}
                    >
                      {selectedConversation.profile.username || selectedConversation.profile.auth_metadata?.full_name || 'User'}
                    </h2>
                  </div>
                </div>
                
                {/* Message content area with padding to accommodate fixed elements */}
                <div className="flex-1 overflow-y-auto p-1 space-y-4 pt-12 pb-20 md:pb-2">
                  {messageGroups.length > 0 ? (
                    messageGroups.map((group) => (
                      <div key={group.date} className="space-y-4">
                        {/* Date header */}
                        <div className="flex items-center justify-center my-2">
                          <div className="bg-foreground/10 rounded-full px-3 py-1 text-xs">
                            {group.formattedDate}
                          </div>
                    </div>
                        
                        {/* Messages for this date */}
                        {group.messages.map((message) => (
                          <div
                            key={message.id}
                            className={`flex ${message.sender_id === currentUserId ? 'justify-end' : 'justify-start'}`}
                          >
                            {message.sender_id === currentUserId && editMessageId === message.id ? (
                              <div className="max-w-full bg-black/30 p-3 rounded-lg">
                                <Input
                                  value={editMessageContent}
                                  onChange={(e) => setEditMessageContent(e.target.value)}
                                  className="mb-2"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-2">
                                  <Button 
                                    variant="ghost" 
                                    size="sm" 
                                    onClick={() => setEditMessageId(null)}
                                  >
                                    Cancel
                                  </Button>
                                  <Button 
                                    size="sm" 
                                    onClick={handleSaveEdit}
                                    disabled={sendingMessage || !editMessageContent.trim()}
                                  >
                                    Save
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="group relative">
                                <div 
                                  className={`max-w-[75%] p-3 rounded-lg ${
                                    message.sender_id === currentUserId 
                                      ? 'bg-primary m-2 justify-self-end text-primary-foreground' 
                                      : 'bg-foreground/10 m-2 justify-self-start'
                                  }`}
                                >
                                  {message.is_deleted ? (
                                    <p className="italic text-foreground/50">This message was deleted</p>
                                  ) : (
                                    <>
                              <p>{message.content}</p>
                                      {message.is_edited && (
                                        <span className="text-xs opacity-70 italic">edited</span>
                                      )}
                                    </>
                                  )}
                                  <div className="text-xs mt-1 opacity-70 text-right">
                                    <span>{formatExactTime(message.created_at)}</span>
                                  </div>
                                </div>
                                
                                {/* Message options popup (shows on hover for own messages) */}
                                {message.sender_id === currentUserId && !message.is_deleted && (
                                  <div className="absolute top-0 right-full pr-2 h-full opacity-0 group-hover:opacity-100 transition-opacity flex items-center">
                                    <div className="bg-black/70 rounded p-1 flex gap-1">
                                      <button 
                                        onClick={() => handleEditMessage(message)} 
                                        className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
                                        title="Edit"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                                          <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                                        </svg>
                                      </button>
                                      <button 
                                        onClick={() => handleDeleteMessage(message.id)} 
                                        className="text-white/80 hover:text-white p-1 rounded hover:bg-white/10"
                                        title="Delete"
                                      >
                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                          <path d="M3 6h18"></path>
                                          <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"></path>
                                          <path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                                        </svg>
                                      </button>
                                    </div>
                                  </div>
                                )}
                            </div>
                            )}
                          </div>
                        ))}
                          </div>
                        ))
                      ) : (
                    <div className="h-full flex items-center justify-center text-foreground/40">
                      <p>Start a conversation with {selectedConversation.profile.username}</p>
                    </div>
                  )}
                  <div ref={messagesEndRef} />
                    </div>

                <div className="p-2 border-t border-white/10 fixed bottom-0 left-0 right-0 md:static bg-background max-sm:z-50">
                      <div className="flex gap-2 md:max-w-full mx-auto">
                        <Input
                          placeholder="Type a message..."
                          value={newMessage}
                          onChange={(e) => setNewMessage(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && handleSendMessage()}
                          className="flex-1"
                          ref={messageInputRef}
                        />
                        <Button 
                          onClick={handleSendMessage}
                          disabled={!newMessage.trim() || sendingMessage}
                        >
                          <Send className="h-4 w-4" />
                        </Button>
                      </div>
                </div>
                  </>
                ) : (
              <div className="h-full flex items-center justify-center flex-col p-8 text-center">
                <div className="bg-foreground/5 w-16 h-16 rounded-full flex items-center justify-center mb-4">
                  <Send className="h-8 w-8 text-foreground/40" />
                  </div>
                <h2 className="text-xl font-medium mb-2">Your Messages</h2>
                <p className="text-foreground/60 max-w-md">
                  Select a conversation from the list or start a new one by visiting someone's profile
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
      
      {/* Delete Message Confirmation Modal */}
      <DeleteMessageModal
        isOpen={showDeleteMessageModal}
        onClose={() => setShowDeleteMessageModal(false)}
        onConfirm={confirmDeleteMessage}
      />
    </div>
  );
}
