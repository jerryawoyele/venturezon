import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";

type Follower = {
  follower_id: string;
  username: string | null;
  avatar_url: string | null;
  created_at: string;
};

interface FollowersModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
  currentUserId: string | null;
  onFollowersLoaded?: (count: number) => void;
}

export function FollowersModal({ isOpen, onClose, userId, currentUserId, onFollowersLoaded }: FollowersModalProps) {
  const [followers, setFollowers] = useState<Follower[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchFollowers = async () => {
      if (!isOpen) return;
      
      setLoading(true);
      setError(null);
      
      try {
        // Try to use the get_followers function
        const { data, error } = await supabase.rpc('get_followers', { 
          user_id: userId 
        });
        
        if (error) {
          throw error;
        }
        
        setFollowers(data || []);
        // Notify parent component about the followers count
        if (onFollowersLoaded) {
          onFollowersLoaded(data?.length || 0);
        }
      } catch (fnError) {
        console.error("Error using get_followers function:", fnError);
        
        // Fallback to manual query if the function call fails
        try {
          const { data, error } = await supabase
            .from('follows')
            .select(`
              follower_id,
              created_at,
              profiles!follows_follower_id_fkey (
                username,
                avatar_url
              )
            `)
            .eq('following_id', userId)
            .order('created_at', { ascending: false });
            
          if (error) throw error;
          
          // Transform the data to match the expected format
          const formattedData = data.map(item => ({
            follower_id: item.follower_id,
            username: item.profiles?.username || null,
            avatar_url: item.profiles?.avatar_url || null,
            created_at: item.created_at
          }));
          
          setFollowers(formattedData);
          // Notify parent component about the followers count
          if (onFollowersLoaded) {
            onFollowersLoaded(formattedData.length);
          }
        } catch (error) {
          console.error("Error fetching followers:", error);
          setError("Failed to load followers. Please try again later.");
          // Send 0 as the count in case of an error
          if (onFollowersLoaded) {
            onFollowersLoaded(0);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    
    fetchFollowers();
  }, [isOpen, userId]);
  
  const handleFollowerClick = (followerId: string) => {
    onClose();
    navigate(`/user/${followerId}`);
  };
  
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    }).format(date);
  };

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="sm:max-w-[425px] max-h-[80vh] p-0">
        <DialogHeader className="p-6 pb-2">
          <DialogTitle>Followers</DialogTitle>
        </DialogHeader>
        
        <ScrollArea className="p-6 pt-2 max-h-[calc(80vh-80px)]">
          {loading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : error ? (
            <div className="text-center py-8 text-white/60">
              <p>{error}</p>
            </div>
          ) : followers.length === 0 ? (
            <div className="text-center py-8 text-white/60">
              <p>No followers yet</p>
            </div>
          ) : (
            <div className="space-y-4">
              {followers.map(follower => (
                <div 
                  key={follower.follower_id}
                  className="flex items-center justify-between p-3 rounded-md transition-colors cursor-pointer"
                  onClick={() => handleFollowerClick(follower.follower_id)}
                >
                  <div className="flex items-center gap-3">
                    <Avatar className="h-10 w-10">
                      {follower.avatar_url ? (
                        <AvatarImage src={follower.avatar_url} alt={follower.username || ""} />
                      ) : (
                        <AvatarFallback>{follower.username?.[0]?.toUpperCase() || '?'}</AvatarFallback>
                      )}
                    </Avatar>
                    <div>
                      <h4 className="font-medium">{follower.username || "Anonymous"}</h4>
                      <p className="text-xs text-white/60">Following since {formatDate(follower.created_at)}</p>
                    </div>
                  </div>
                  
                  {currentUserId === follower.follower_id && (
                    <div className="text-xs bg-primary/20 text-primary px-2 py-1 rounded">
                      You
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
} 