import { useState, useRef, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Profile } from "@/types";
import { ProfileAvatar } from "./ProfileAvatar";
import { Button } from "@/components/ui/button";
import { UserPlus, MessageSquare, Star } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface ProfileCardProps {
  profile: Profile;
  isOwnProfile?: boolean;
  onFollow?: () => void;
  onMessage?: () => void;
  onShowReviews?: () => void;
  isFollowing?: boolean;
}

export function ProfileCard({
  profile,
  isOwnProfile = false,
  onFollow,
  onMessage,
  onShowReviews,
  isFollowing = false,
}: ProfileCardProps) {
  const [isFollowingState, setIsFollowingState] = useState(isFollowing);
  const [isTruncated, setIsTruncated] = useState(true);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const [showAboutModal, setShowAboutModal] = useState(false);
  const aboutRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const checkHeight = () => {
      if (aboutRef.current && profile?.about_business) {
        // If about business exceeds 80px in height, it should be truncated
        setShouldTruncate(aboutRef.current.scrollHeight > 80);
      }
    };
    
    // Check immediately and when window resizes
    checkHeight();
    window.addEventListener('resize', checkHeight);
    
    return () => {
      window.removeEventListener('resize', checkHeight);
    };
  }, [profile?.about_business]);

  useEffect(() => {
    setIsFollowingState(isFollowing);
  }, [isFollowing]);

  const handleFollow = () => {
    setIsFollowingState(!isFollowingState);
    if (onFollow) onFollow();
  };

  return (
    <>
      <Card className="overflow-hidden bg-black/60 border-white/5">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row items-center gap-4">
            <ProfileAvatar userProfile={profile} size={80} />
            <div className="flex-1 space-y-4">
              <div>
                {profile?.user_role === 'business' && profile?.business_name ? (
                  <>
                    <h1 className="text-2xl font-bold">{profile.business_name}</h1>
                    <p className="text-muted-foreground mb-1">@{profile?.username}</p>
                  </>
                ) : (
                  <>
                    <h1 className="text-2xl font-bold">{profile?.display_name || profile?.username || "User"}</h1>
                    {profile?.username && <p className="text-muted-foreground mb-1">@{profile?.username}</p>}
                  </>
                )}
                <p className="text-white/60 mt-2">{profile?.bio}</p>
                
                {/* Add about business section with truncation */}
                {profile?.user_role === 'business' && profile?.about_business && (
                  <div className="mt-3">
                    <h3 className="text-sm font-medium mb-1">About the Business</h3>
                    <div>
                      <p 
                        ref={aboutRef}
                        className={isTruncated && shouldTruncate ? "dark:text-white/60 text-black/60 text-sm line-clamp-3" : "dark:text-white/60 text-black/60 text-sm"}
                      >
                        {profile.about_business}
                      </p>
                      {shouldTruncate && (
                        <button 
                          onClick={() => setShowAboutModal(true)}
                          className="text-primary text-xs mt-1 hover:underline"
                        >
                          Show more
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              
              {!isOwnProfile && (
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button 
                    variant={isFollowingState ? "outline" : "default"}
                    className="flex-1 sm:flex-none"
                    onClick={handleFollow}
                  >
                    <UserPlus className="h-4 w-4 mr-2" />
                    {isFollowingState ? "Following" : "Follow"}
                  </Button>
                  
                  <Button
                    variant="outline"
                    className="flex-1 sm:flex-none"
                    onClick={onMessage}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Message
                  </Button>
                </div>
              )}
              
              <div className="flex justify-between">
                <div className="text-center cursor-pointer hover:bg-black/20 px-4 py-2 rounded-md transition-colors">
                  <p className="font-semibold">{profile?.followers_count || 0}</p>
                  <p className="text-white/60 text-sm">Followers</p>
                </div>
                
                <div className="text-center cursor-pointer hover:bg-black/20 px-4 py-2 rounded-md transition-colors">
                  <p className="font-semibold">{profile?.following_count || 0}</p>
                  <p className="text-white/60 text-sm">Following</p>
                </div>
                
                {profile?.user_role === "business" && (
                  <div 
                    onClick={onShowReviews}
                    className="text-center cursor-pointer hover:bg-black/20 px-4 py-2 rounded-md transition-colors"
                  >
                    <div className="flex items-center justify-center gap-1">
                      <Star className="w-4 h-4 text-yellow-400" />
                      <p className="font-semibold">
                        {profile?.reviews_count && profile.reviews_count > 0
                          ? (profile?.reviews_rating?.toFixed(1) || '0.0')
                          : '-'}
                      </p>
                    </div>
                    <p className="text-white/60 text-sm">
                      {profile?.reviews_count && profile.reviews_count > 0
                        ? `Reviews (${profile?.reviews_count})`
                        : 'No reviews'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* About Business Modal */}
      <Dialog open={showAboutModal} onOpenChange={setShowAboutModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>About {profile?.business_name || "the Business"}</DialogTitle>
          </DialogHeader>
          <div className="mt-2 max-h-[60vh] overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap">
              {profile?.about_business}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
} 