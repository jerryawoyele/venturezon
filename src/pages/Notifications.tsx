import { useState, useEffect } from "react";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Sidebar } from "@/components/home/Sidebar";
import { MobileHeader } from "@/components/home/MobileHeader";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { MainLayout } from "@/layouts/MainLayout";
import { formatDistanceToNow } from "date-fns";
import { NotificationType, markAllNotificationsAsRead } from "@/utils/notification-helper";
import { 
  Heart, 
  MessageSquare, 
  UserPlus, 
  Star, 
  Bell, 
  Briefcase, 
  AtSign,
  Package,
  ArrowLeft
} from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Notification {
  id: string;
  message: string;
  type: NotificationType;
  created_at: string;
  is_read: boolean;
  user_id: string;
  actor_id: string | null;
  entity_id: string | null;
  actor_name: string | null;
  actor_profile?: {
    username: string;
    avatar_url: string | null;
  };
}

export default function Notifications() {
  const [activeTab, setActiveTab] = useState("Notifications");
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const [userRole, setUserRole] = useState<"business" | "customer" | null>(null);
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);

  useEffect(() => {
    fetchUserRole();
  }, []);

  // When userId is set, fetch notifications
  useEffect(() => {
    if (userId) {
      fetchNotifications();
    }
  }, [userId]);

  const fetchUserRole = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        navigate('/auth');
        return;
      }
      
      setUserId(user.id);
      
      const { data, error } = await supabase
        .from('profiles')
        .select('user_role')
        .eq('id', user.id)
        .single();
          
      if (data) {
        setUserRole(data.user_role as "business" | "customer" | null);
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const fetchNotifications = async () => {
    if (!userId) return;
    
    try {
      setLoading(true);
      
      console.log("Fetching notifications for user:", userId);
      
      // Fetch notifications for the current user
      const { data: notificationsData, error: notificationsError } = await supabase
        .from('notifications')
        .select(`*`)
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (notificationsError) {
        console.error("Error fetching notifications:", notificationsError);
        throw notificationsError;
      }
      
      console.log("Notifications data:", notificationsData);
      
      // Separately fetch actor profiles if needed
      const notifications = notificationsData || [];
      const actorIds = notifications
        .filter(notification => notification.actor_id)
        .map(notification => notification.actor_id);
      
      // Get unique actor IDs to fetch profiles
      const uniqueActorIds = [...new Set(actorIds)];
      
      if (uniqueActorIds.length > 0) {
        const { data: actorProfiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', uniqueActorIds);
          
        if (!profilesError && actorProfiles) {
          // Create a map of actor profiles by ID for quick lookup
          const profilesMap = actorProfiles.reduce((acc, profile) => {
            acc[profile.id] = profile;
            return acc;
          }, {});
          
          // Attach actor profiles to notifications
          const notificationsWithProfiles = notifications.map(notification => {
            if (notification.actor_id && profilesMap[notification.actor_id]) {
              return {
                ...notification,
                actor_profile: profilesMap[notification.actor_id]
              };
            }
            return notification;
          });
          
          setNotifications(notificationsWithProfiles);
        } else {
          setNotifications(notifications);
        }
      } else {
        setNotifications(notifications);
      }
    } catch (error) {
      console.error('Error fetching notifications:', error);
      toast({
        title: "Error",
        description: "Failed to load notifications",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const markAsRead = async (id: string) => {
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('id', id);
      
      if (error) throw error;
      
      // Update local state
      setNotifications(notifications.map(notification => 
        notification.id === id ? { ...notification, is_read: true } : notification
      ));
      
      toast({
        title: "Notification marked as read",
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
      toast({
        title: "Error",
        description: "Failed to update notification",
        variant: "destructive",
      });
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!userId) return;
    
    try {
      const { error } = await supabase
        .from('notifications')
        .update({ is_read: true })
        .eq('user_id', userId)
        .eq('is_read', false);
      
      if (error) throw error;
      
      // Update local state
      setNotifications(notifications.map(notification => ({ ...notification, is_read: true })));
      
      toast({
        title: "All notifications marked as read",
      });
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      toast({
        title: "Error",
        description: "Failed to update notifications",
        variant: "destructive",
      });
    }
  };
  
  const handleNotificationClick = (notification: Notification) => {
    // If unread, mark as read
    if (!notification.is_read) {
      markAsRead(notification.id);
    }
    
    // Navigate based on notification type
    if (notification.entity_id) {
      switch (notification.type) {
        case 'follow':
          // Go to follower's profile
          if (notification.actor_id) {
            navigate(`/user/${notification.actor_id}`);
          }
          break;
        case 'like':
        case 'comment':
          // Go to the post
          navigate(`/user/${notification.user_id}/${notification.entity_id}`);
          break;
        case 'message':
          // Go to messages with this user
          navigate(`/messages?user=${notification.actor_id}`);
          break;
        case 'booking':
        case 'service':
        case 'review':
          // Go to the service tab in user profile
          navigate(`/user/${notification.user_id}?tab=services`);
          break;
        default:
          // Default just go to the entity owner's profile
          navigate(`/user/${notification.user_id}`);
      }
    }
  };
  
  // Get notification icon based on type
  const getNotificationIcon = (type: NotificationType) => {
    switch (type) {
      case 'follow':
        return <UserPlus className="h-5 w-5 text-primary" />;
      case 'like':
        return <Heart className="h-5 w-5 text-red-500" />;
      case 'comment':
        return <MessageSquare className="h-5 w-5 text-blue-500" />;
      case 'message':
        return <MessageSquare className="h-5 w-5 text-green-500" />;
      case 'service':
        return <Briefcase className="h-5 w-5 text-amber-500" />;
      case 'review':
        return <Star className="h-5 w-5 text-yellow-500" />;
      case 'mention':
        return <AtSign className="h-5 w-5 text-purple-500" />;
      case 'booking':
        return <Package className="h-5 w-5 text-indigo-500" />;
      default:
        return <Bell className="h-5 w-5 text-white" />;
    }
  };
  
  // Format timestamp
  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch (error) {
      return 'some time ago';
    }
  };

  if (loading) {
    return (
      <LoadingScreen 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole} 
      />
    );
  }

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} isAuthenticated={true}>
      <div>
        <div className="flex items-center justify-between gap-4 mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/profile')}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Profile
          </Button>
        {notifications.some(n => !n.is_read) && (
          <Button
            variant="default"
            size="sm"
            onClick={handleMarkAllAsRead}
            className="items-center"
          >
            Mark all as read
          </Button>
        )}
        </div>
        <div className="space-y-4">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <Card
                key={notification.id}
                className={`p-4 transition-colors cursor-pointer hover:bg-black/30 ${
                  notification.is_read ? 'bg-black/20' : 'bg-black/40 border-l-4 border-primary'
                }`}
                onClick={() => handleNotificationClick(notification)}
              >
                <div className="flex gap-4">
                  <Avatar>
                    {notification.actor_profile?.avatar_url ? (
                      <AvatarImage src={notification.actor_profile.avatar_url} />
                    ) : (
                      <AvatarFallback className="bg-white/10 flex items-center justify-center">
                        {getNotificationIcon(notification.type)}
                      </AvatarFallback>
                    )}
                  </Avatar>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium max-lg:truncate max-lg:max-w-[130px]">{notification.actor_name || 'Notification'}</h3>
                      {!notification.is_read && (
                        <span className="bg-primary w-2 h-2 rounded-full"></span>
                      )}
                    </div>
                    <p className="text-sm text-white/60 max-lg:max-w-[130px]">{notification.message}</p>
                    <span className="text-xs text-white/40">
                      {formatTimestamp(notification.created_at)}
                    </span>
                  </div>
                  {!notification.is_read && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      onClick={(e) => {
                        e.stopPropagation();
                        markAsRead(notification.id);
                      }}
                    >
                      Mark as read
                    </Button>
                  )}
                </div>
              </Card>
            ))
          ) : (
            <Card className="p-8 text-center text-white/60">
              <Package className="mx-auto h-12 w-12 mb-4 text-white/30" />
              <p className="text-lg mb-2">No notifications yet</p>
              <p className="text-sm mb-4">When you receive notifications, they'll appear here</p>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}
