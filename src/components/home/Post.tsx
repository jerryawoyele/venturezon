import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Heart, 
  MessageCircle, 
  Send, 
  MoreVertical, 
  Trash, 
  Edit,
  ChevronLeft,
  ChevronRight,
  LoaderCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format, formatDistance } from "date-fns";
import ProfileImage from "@/components/ProfileImage";
import { useToast } from "@/components/ui/use-toast";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import { Badge } from "@/components/ui/badge";
import { LikesModal } from "./LikesModal";
import { createNotification } from "@/utils/notification-helper";
import { PromotedLabel } from './PromotedLabel';
import { PromotePostModal } from "./PromotePostModal";

interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  auth_metadata?: {
    full_name?: string;
    avatar_url?: string;
    name?: string;
  };
  display_name?: string;
}

interface Comment {
  id: string;
  content: string;
  created_at: string;
  user_id: string;
  post_id: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  } | { username: any; avatar_url: any; }[];
}

interface Like {
  id: string;
  user_id: string;
  post_id: string;
  created_at: string;
  profile?: {
    username: string | null;
    avatar_url: string | null;
  } | { username: any; avatar_url: any; }[];
}

interface PostProps {
  id: string; 
  user_id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  profiles: Profile;
  onLike?: () => void;
  onComment?: (postId: string, comment: string) => Promise<void>;
  onShare?: () => void;
  onDelete?: (postId: string) => Promise<void>;
  onEdit?: (postId: string, newCaption: string) => Promise<void>;
  currentUserId?: () => Promise<string | null>;
  showDetailOnClick?: boolean;
  isAuthenticated?: boolean;
  isPromoted?: boolean;
  promotionLevel?: 'basic' | 'premium' | 'featured';
  userRole?: 'business' | 'customer' | null;
}

export function Post({ 
  id, 
  user_id,
  profiles, 
  image_url, 
  caption, 
  created_at,
  onLike, 
  onComment, 
  onShare,
  onDelete,
  onEdit,
  currentUserId,
  showDetailOnClick = false,
  isAuthenticated = true,
  isPromoted = false,
  promotionLevel = 'basic',
  userRole,
}: PostProps) {
  const [showComments, setShowComments] = useState(false);
  const [newComment, setNewComment] = useState("");
  const [liked, setLiked] = useState(false);
  const [likesCount, setLikesCount] = useState(0);
  const [commentsCount, setCommentsCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [likes, setLikes] = useState<Like[]>([]);
  const [showCommentsModal, setShowCommentsModal] = useState(false);
  const [showLikesModal, setShowLikesModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [isOwner, setIsOwner] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editedCaption, setEditedCaption] = useState(caption || "");
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [parsedImages, setParsedImages] = useState<string[]>([]);
  const [lastTap, setLastTap] = useState<number>(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [captionState, setCaptionState] = useState(caption || "");
  const navigate = useNavigate();
  const postCardRef = useRef<HTMLDivElement>(null);
  const location = useLocation();
  const isDetailClickEnabled = showDetailOnClick || location.pathname.includes('/discover') || location.pathname.includes('/user/');
  const commentInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [currentUserObj, setCurrentUserObj] = useState<{ id: string } | null>(null);
  const [commentLikes, setCommentLikes] = useState<Record<string, boolean>>({});
  const [showPromoteModal, setShowPromoteModal] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);
  const [touchEnd, setTouchEnd] = useState<number | null>(null);
  
  // Minimum distance required for swipe
  const minSwipeDistance = 50;

  // Add states for caption truncation
  const [isTruncated, setIsTruncated] = useState(true);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const captionRef = useRef<HTMLParagraphElement>(null);
  
  useEffect(() => {
    const checkOwnership = async () => {
      if (currentUserId) {
        const userId = await currentUserId();
        setIsOwner(userId === user_id);
      }
    };
    checkOwnership();
  }, [currentUserId, user_id]);

  useEffect(() => {
    try {
      const parsedData = JSON.parse(image_url);
      if (Array.isArray(parsedData)) {
        setParsedImages(parsedData);
      } else {
        setParsedImages([image_url]);
      }
    } catch (e) {
      setParsedImages([image_url]);
    }
  }, [image_url]);

  useEffect(() => {
    const fetchLikesAndComments = async () => {
      // Skip fetching if post ID is undefined or null
      if (!id) {
        console.log('Skipping fetch because post ID is undefined');
        setLikesCount(0);
        setCommentsCount(0);
        return;
      }
      
      try {
        const { data: likesData, error: likesError } = await supabase
          .from('likes')
          .select(`
            id,
            user_id,
            post_id,
            created_at,
            profile:profiles(
              username,
              avatar_url
            )
          `)
          .eq('post_id', id);
          
        if (likesError) throw likesError;
        
        const user = await supabase.auth.getUser();
        const currentUserId = user.data.user?.id;
        
        if (likesData) {
          setLikes(likesData as Like[]);
          setLikesCount(likesData.length);
          setLiked(currentUserId ? likesData.some(like => like.user_id === currentUserId) : false);
        }
        
        // Only fetch comments if the post ID is valid
        const { data: commentsData, error: commentsError } = await supabase
          .from('comments')
          .select(`
            id,
            content,
            user_id,
            post_id,
            created_at,
            profile:profiles(
              username,
              avatar_url
            )
          `)
          .eq('post_id', id)
          .order('created_at', { ascending: false });
          
        if (commentsError) throw commentsError;
        
        if (commentsData) {
          setComments(commentsData as Comment[]);
          setCommentsCount(commentsData.length);
        }
      } catch (error) {
        console.error('Error fetching likes and comments:', error);
        setLikesCount(0);
        setCommentsCount(0);
      }
    };
    
    fetchLikesAndComments();
  }, [id]);

  useEffect(() => {
    const getCurrentUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        setCurrentUserObj({ id: data.user.id });
      }
    };
    
    getCurrentUser();
  }, []);

  useEffect(() => {
    try {
      const savedLikes = localStorage.getItem('commentLikes');
      if (savedLikes) {
        setCommentLikes(JSON.parse(savedLikes));
      }
    } catch (err) {
      console.error('Error loading comment likes from localStorage:', err);
    }
  }, []);

  const handleLikeComment = async (commentId: string) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Just toggle the like state in the UI
    setCommentLikes(prev => {
      const newState = {
        ...prev,
        [commentId]: !prev[commentId]
      };
      
      // Store in localStorage to persist across page refreshes
      try {
        localStorage.setItem('commentLikes', JSON.stringify(newState));
      } catch (err) {
        console.error('Error saving comment likes to localStorage:', err);
      }
      
      return newState;
    });
    
    // Show a toast notification
    const isLiked = !commentLikes[commentId];
    
    toast({
      title: isLiked ? "Comment liked" : "Comment unliked",
      description: isLiked 
        ? "You've liked this comment" 
        : "You've removed your like from this comment"
    });
  };

  const handleDeleteComment = async (commentId: string) => {
    if (!isAuthenticated || !currentUserObj) {
      setShowAuthModal(true);
      return;
    }
    
    const comment = comments.find(c => c.id === commentId);
    
    if (!comment || comment.user_id !== currentUserObj.id) {
      toast({
        title: "Permission denied",
        description: "You can only delete your own comments",
        variant: "destructive"
      });
      return;
    }
    
    setComments(prev => prev.filter(c => c.id !== commentId));
    setCommentsCount(prev => prev - 1);
    
    toast({
      title: "Comment deleted",
      description: "Your comment has been removed"
    });
    
    try {
      await supabase
        .from('comments')
        .delete()
        .eq('id', commentId);
    } catch (error) {
      console.error("Error deleting comment:", error);
    }
  };

  const checkAuth = (callback: Function) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return false;
    }
    return callback();
  };

  const handleLike = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    try {
      setLiked(!liked);
      
      if (liked) {
        setLikesCount(prev => Math.max(0, prev - 1));
      } else {
        setLikesCount(prev => prev + 1);
      }
      
      if (onLike) onLike();
      
      if (!currentUserId) return;
      
      const userId = await currentUserId();
      if (!userId) return;
      
      if (!liked) {
        const { error } = await supabase
          .from('likes')
          .insert({ post_id: id, user_id: userId });
          
        if (error) throw error;
        
        // Create notification for post owner if the liker isn't the post owner
        if (userId !== user_id) {
          // Get current user's username
          const { data: userData } = await supabase
            .from('profiles')
            .select('username')
            .eq('id', userId)
            .single();
            
          const username = userData?.username || 'Someone';
          
          // Create like notification
          await createNotification({
            userId: user_id,
            actorId: userId,
            actorName: username,
            type: 'like',
            entityId: id,
            message: `${username} liked your post`
          });
        }
      } else {
        const { error } = await supabase
          .from('likes')
          .delete()
          .match({ post_id: id, user_id: userId });
          
        if (error) throw error;
      }
    } catch (error) {
      console.error("Error liking post:", error);
      setLiked(liked);
      if (liked) {
        setLikesCount(prev => prev + 1);
      } else {
        setLikesCount(prev => Math.max(0, prev - 1));
      }
    }
  };

  const handleComment = async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    if (!newComment.trim()) return;
    
    setLoading(true);
    try {
      const user = await supabase.auth.getUser();
      const currentUserId = user.data.user?.id;
      
      if (!currentUserId) {
        setShowAuthModal(true);
        return;
      }
      
      // Create the comment
      const { data, error } = await supabase
        .from('comments')
        .insert({
          content: newComment,
          post_id: id,
          user_id: currentUserId,
        })
        .select('*, profile:profiles(username, avatar_url)')
        .single();
      
      if (error) throw error;
      
      // Add the new comment to the state
      setComments([data as Comment, ...comments]);
      setCommentsCount(prev => prev + 1);
      setNewComment("");
      
      // Call the onComment callback if provided
      if (onComment) {
        await onComment(id, newComment);
      }
      
      // Create notification for post owner if the commenter isn't the post owner
      if (currentUserId !== user_id) {
        // Get current user's username
        const { data: userData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', currentUserId)
          .single();
          
        const username = userData?.username || 'Someone';
        
        // Create comment notification
        await createNotification({
          userId: user_id,
          actorId: currentUserId,
          actorName: username,
          type: 'comment',
          entityId: id,
          message: `${username} commented on your post: "${newComment.slice(0, 30)}${newComment.length > 30 ? '...' : ''}"`
        });
      }
    } catch (error) {
      console.error("Error adding comment:", error);
      toast({
        title: "Error",
        description: "Failed to add comment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleShare = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    const postUrl = `${window.location.origin}/user/${user_id}/${id}`;
    
    if (navigator.share) {
      navigator.share({
        title: caption || 'Check out this post',
        url: postUrl
      }).catch(error => console.log('Error sharing:', error));
    } else {
      navigator.clipboard.writeText(postUrl)
        .then(() => {
          toast({
            title: "Link Copied!",
            description: "Post link copied to clipboard",
          });
        })
        .catch(err => {
          console.error('Failed to copy: ', err);
          toast({
            title: "Error",
            description: "Failed to copy link",
            variant: "destructive",
          });
        });
    }
    
    if (onShare) onShare();
  };

  const handleProfileClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (profiles?.username) {
      navigate(`/@${profiles.username}`);
    } else {
      navigate(`/user/${user_id}`);
    }
  };

  const handleDelete = async () => {
    if (!showDeleteConfirm) {
      setShowDeleteConfirm(true);
      return;
    }
    
    setLoading(true);
    try {
      if (!onDelete) {
        await supabase.from('likes').delete().eq('post_id', id);
        await supabase.from('comments').delete().eq('post_id', id);
        
        const { error } = await supabase.from('posts').delete().eq('id', id);
        
        if (error) throw error;
        
        toast({
          title: "Post deleted",
          description: "Your post has been deleted successfully."
        });
        
        setShowPostModal(false);
        
        if (postCardRef.current) {
          postCardRef.current.style.display = 'none';
        }
      } else {
        await onDelete(id);
      }
      
      setShowDeleteConfirm(false);
    } catch (error) {
      console.error("Error deleting post:", error);
      toast({
        title: "Delete failed",
        description: "There was an error deleting your post. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = async () => {
    if (!editMode) {
      setEditMode(true);
      return;
    }
    
    // Now we're in edit mode and need to save
    setLoading(true);
    
    try {
      if (onEdit) {
        // Use provided callback if available
        await onEdit(id, editedCaption);
      } else {
        // Direct database update
        const { error } = await supabase
          .from('posts')
          .update({ caption: editedCaption })
          .eq('id', id);
        
        if (error) throw error;
        
        // Update local state with the edited caption
        setCaptionState(editedCaption);
      }
      
      // Close edit mode and modal
      setEditMode(false);
      setShowPostModal(false);
      
      toast({
        title: "Post updated",
        description: "Your post has been updated successfully."
      });
    } catch (error) {
      console.error("Error updating post:", error);
      toast({
        title: "Update failed",
        description: "There was an error updating your post. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const handleNextImage = () => {
    if (currentImageIndex < parsedImages.length - 1) {
      setCurrentImageIndex(prev => prev + 1);
    }
  };

  const handlePrevImage = () => {
    if (currentImageIndex > 0) {
      setCurrentImageIndex(prev => prev - 1);
    }
  };

  const handleImageTap = (e: React.MouseEvent) => {
    e.stopPropagation(); // Prevent card click from triggering
    const now = Date.now();
    const doubleTapDelay = 300;
    
    if (lastTap && (now - lastTap) < doubleTapDelay) {
      // Double tap detected
      handleLike();
    }
    
    setLastTap(now);
  };

  // Handle touch start
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchEnd(null); // Reset touchEnd
    setTouchStart(e.targetTouches[0].clientX);
  };
  
  // Handle touch move
  const handleTouchMove = (e: React.TouchEvent) => {
    setTouchEnd(e.targetTouches[0].clientX);
  };
  
  // Handle touch end - process the swipe
  const handleTouchEnd = () => {
    if (!touchStart || !touchEnd) return;
    
    const distance = touchStart - touchEnd;
    const isLeftSwipe = distance > minSwipeDistance;
    const isRightSwipe = distance < -minSwipeDistance;
    
    // Handle left swipe (next image)
    if (isLeftSwipe && currentImageIndex < parsedImages.length - 1) {
      handleNextImage();
    }
    
    // Handle right swipe (previous image)
    if (isRightSwipe && currentImageIndex > 0) {
      handlePrevImage();
    }
    
    // Reset values
    setTouchStart(null);
    setTouchEnd(null);
  };

  const formatTimeAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'just now';
    }
    
    if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m`;
    }
    
    if (diffInSeconds < 86400) {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h`;
    }
    
    if (diffInSeconds < 604800) {
      const days = Math.floor(diffInSeconds / 86400);
      return `${days}d`;
    }
    
    if (date.getFullYear() === now.getFullYear()) {
      return format(date, 'MMM d');
    }
    
    return format(date, 'MMM d, yyyy');
  };

  const formatCommentDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    
    if (date.toDateString() === now.toDateString()) {
      return format(date, 'h:mm a');
    }
    
    return format(date, 'MMM d, h:mm a');
  };

  const isTextPost = () => {
    // Check if there's no image URL at all
    if (!image_url) return true;
    
    // Check if it's explicitly marked as text
    if (image_url === 'text') return true;
    
    // Check if image_url is exactly the same as caption (unlikely for real images)
    if (image_url === caption) return true;
    
    // If image_url is a valid array of images
    try {
      if (image_url.startsWith('[') && image_url.endsWith(']')) {
        const parsed = JSON.parse(image_url);
        // If array is empty or contains empty strings, it's a text post
        if (!Array.isArray(parsed) || parsed.length === 0 || parsed.every(url => !url)) {
          return true;
        }
        return false;
      }
    } catch (e) {
      // If parsing fails, continue with other checks
    }
    
    // Check for common image URL patterns
    const isImageUrl = 
      image_url.startsWith('http') || 
      image_url.startsWith('data:image') ||
      image_url.includes('storage') ||
      image_url.includes('://');
    
    return !isImageUrl;
  };

  const handleCardClick = () => {
    if (showDetailOnClick) {
      setShowPostModal(true);
    }
  };

  const openCommentsModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    setShowCommentsModal(true);
    
    setTimeout(() => {
      commentInputRef.current?.focus();
    }, 100);
  };

  // Update the caption state when the prop changes
  useEffect(() => {
    setCaptionState(caption || "");
  }, [caption]);

  // Update edited caption when captionState changes
  useEffect(() => {
    setEditedCaption(captionState);
  }, [captionState]);

  // Add effect to check if caption should be truncated
  useEffect(() => {
    const checkHeight = () => {
      if (captionRef.current) {
        // If caption exceeds 80px in height, it should be truncated
        setShouldTruncate(captionRef.current.scrollHeight > 80);
      }
    };
    
    // Check immediately and when window resizes
    checkHeight();
    window.addEventListener('resize', checkHeight);
    
    return () => {
      window.removeEventListener('resize', checkHeight);
    };
  }, [captionState]);

  // Helper function to get initials from a name
  const getInitials = (name: string): string => {
    if (!name || typeof name !== 'string') return '?';
    
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .substring(0, 2); // Limit to 2 characters
  };

  return (
    <>
      <div className="max-w-2xl mx-auto w-full">
        <Card 
          className="bg-white dark:bg-black/60 border-border transition-colors duration-200 overflow-hidden"
          onClick={handleCardClick}
        >
          <div className="px-3 pt-3 pb-1 flex items-start gap-3" onClick={(e) => e.stopPropagation()}>
            <Avatar className="h-8 w-8" onClick={handleProfileClick} style={{ cursor: 'pointer' }}>
              <AvatarImage 
                src={profiles?.avatar_url || profiles?.auth_metadata?.avatar_url}
                alt={profiles?.username || profiles?.auth_metadata?.full_name || "User"}
              />
              <AvatarFallback>{getInitials(profiles?.username || profiles?.auth_metadata?.full_name || "User")}</AvatarFallback>
            </Avatar>
            <div>
              <div className="font-medium text-sm cursor-pointer hover:underline" onClick={handleProfileClick}>
                {profiles?.username || 
                  profiles?.auth_metadata?.name ||
                  profiles?.auth_metadata?.full_name ||
                  "User"}
              </div>
              <span className="text-xs text-muted-foreground">
                {formatTimeAgo(created_at || new Date().toISOString())}
              </span>
            </div>
            
            {isPromoted && promotionLevel && (
              <PromotedLabel level={promotionLevel}/>
            )}
            
            {/* Post Options Menu - Only visible for post owner */}
            {isOwner && (
              <div className="ml-auto">
                <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                      <MoreVertical className="h-4 w-4" />
                      <span className="sr-only">Post options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => {
                      setDropdownOpen(false);
                      setShowPromoteModal(true);
                    }}>
                      <Heart className="h-4 w-4 mr-2" />
                      Promote
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setDropdownOpen(false);
                      setEditMode(true);
                    }}>
                      <Edit className="h-4 w-4 mr-2" />
                      Edit Post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setDropdownOpen(false);
                      setShowDeleteConfirm(true);
                    }}>
                      <Trash className="h-4 w-4 mr-2" />
                      Delete Post
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
          
          {isTextPost() ? (
            <div 
              className="p-6 bg-background dark:bg-gradient-to-br dark:from-gray-900 dark:to-black flex items-center justify-center min-h-[200px]"
              onClick={handleImageTap}
            >
              <p className="text-lg md:text-xl font-medium text-center line-clamp-5">{captionState}</p>
            </div>
          ) : (
            <div className="relative overflow-hidden bg-background dark:bg-black">
              <div 
                className="w-full flex transition-transform duration-300 ease-in-out" 
                style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
              >
                {parsedImages.map((image, index) => (
                  <div key={index} className="w-full flex-shrink-0 relative">
                    <div className="pt-[75%] sm:pt-[100%] relative overflow-hidden">
                      <img 
                        src={image} 
                        alt={caption || `Post image ${index + 1}`}
                        className="absolute top-0 left-0 w-full h-full object-fill bg-black"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://source.unsplash.com/800x600/?abstract';
                        }}
                        onClick={handleImageTap}
                      />
                    </div>
                  </div>
                ))}
              </div>
              
              {parsedImages.length > 1 && (
                <>
                  {currentImageIndex > 0 && (
                    <button 
                      className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 p-1 rounded-full transition-colors duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handlePrevImage();
                      }}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                  )}
                  
                  {currentImageIndex < parsedImages.length - 1 && (
                    <button 
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 p-1 rounded-full transition-colors duration-200"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleNextImage();
                      }}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                  )}
                  
                  <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                    {parsedImages.map((_, index) => (
                      <div 
                        key={index} 
                        className={`w-2 h-2 rounded-full transition-colors duration-200 ${index === currentImageIndex ? 'bg-primary' : 'bg-white/30'}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          setCurrentImageIndex(index);
                        }}
                        style={{ cursor: 'pointer' }}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>
          )}
          
          <div className="p-4">
            {!isTextPost() && captionState && (
              <div className="mb-3 text-sm">
                <p className="font-medium inline mr-1">
                  {profiles?.username || profiles?.auth_metadata?.full_name || 'User'}:
                </p>
                <div>
                  <p 
                    ref={captionRef}
                    className={isTruncated && shouldTruncate ? "line-clamp-3" : ""}
                  >
                    {captionState}
                  </p>
                  {shouldTruncate && (
                    <button 
                      onClick={(e) => {
                        e.stopPropagation();
                        setIsTruncated(!isTruncated);
                      }}
                      className="text-primary text-xs mt-1 hover:underline"
                    >
                      {isTruncated ? "Show more" : "Show less"}
                    </button>
                  )}
                </div>
              </div>
            )}
            
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleLike();
                }}
                className={`${liked ? 'hover:bg-secondary/50 dark:hover:bg-black/80' : 'hover:bg-secondary dark:hover:bg-white/10'}`}
              >
                <Heart className={`w-5 h-5 ${liked ? 'fill-current text-primary' : ''}`} />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={openCommentsModal}
              >
                <MessageCircle className="w-5 h-5" />
              </Button>
              <Button 
                variant="ghost" 
                size="icon" 
                onClick={(e) => {
                  e.stopPropagation();
                  handleShare();
                }}
              >
                <Send className="w-5 h-5" />
              </Button>
            </div>
            
            <div className="mt-2 text-sm">
              <button 
                className="font-medium hover:underline" 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowLikesModal(true);
                }}
              >
                {likesCount} likes
              </button>
              <div className="text-muted-foreground">
                {commentsCount > 0 ? (
              <button 
                className="hover:underline"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowCommentsModal(true);
                  }}
              >
                  View all {commentsCount} comments
              </button>
                ) : (
                  <span>No comments yet</span>
                )}
              </div>
            </div>
          </div>
        </Card>
        
        <Dialog open={showCommentsModal} onOpenChange={setShowCommentsModal}>
          <DialogContent className="sm:max-w-[600px] bg-card border-border max-h-[90vh]">
            <DialogHeader>
              <DialogTitle>Comments</DialogTitle>
            </DialogHeader>
            
            <div className="my-4 space-y-4 max-h-[60vh] overflow-hidden flex flex-col">
              <div className="flex gap-2">
                <Input
                  placeholder="Add a comment..."
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleComment()}
                  className="flex-1"
                  ref={commentInputRef}
                />
                <Button onClick={handleComment} disabled={loading}>
                  {loading ? "Posting..." : "Post"}
                </Button>
              </div>
              
              {comments.length > 0 ? (
                <div className="space-y-4 overflow-y-auto flex-1 pb-4">
                  {comments.map((comment) => (
                    <div key={comment.id} className="flex gap-2">
                      <ProfileImage 
                        src={comment.profile?.avatar_url || 'https://source.unsplash.com/100x100/?portrait'} 
                        alt={comment.profile?.username || 'User'}
                        className="w-8 h-8 rounded-full"
                      />
                      <div className="bg-secondary dark:bg-white/5 p-2 rounded-lg flex-1">
                        <div className="flex justify-between">
                          <p className="text-sm font-medium">
                            {comment.profile?.username || 'User'}
                          </p>
                          <span className="text-xs text-muted-foreground">{formatCommentDate(comment.created_at)}</span>
                        </div>
                        <p className="text-sm">{comment.content}</p>
                        <div className="flex items-center mt-2 gap-4">
                          <Button
                            variant="ghost"
                            size="icon"
                            className={`h-7 w-7 rounded-full ${
                              commentLikes[comment.id] ? 'bg-red-500/10' : ''
                            }`}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleLikeComment(comment.id);
                            }}
                          >
                            <Heart 
                              className={`h-3 w-3 ${
                                commentLikes[comment.id] ? 'fill-red-500 text-red-500' : 'text-black/60 dark:text-white/60'
                              }`} 
                            />
                          </Button>
                          
                          {isAuthenticated && currentUserObj && comment.user_id === currentUserObj.id && (
                            <button 
                              className="flex items-center gap-1 text-xs dark:text-white/60 text-black/60 hover:text-white/80" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleDeleteComment(comment.id);
                              }}
                            >
                              <Trash className="h-3 w-3" />
                              <span>Delete</span>
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-white/60">
                  No comments yet. Be the first to comment!
                </div>
              )}
            </div>
          </DialogContent>
        </Dialog>
        
        <LikesModal 
          open={showLikesModal} 
          onOpenChange={setShowLikesModal} 
          postId={id} 
        />
        
        <Dialog open={showPostModal} onOpenChange={setShowPostModal}>
          <DialogContent className="sm:max-w-[650px] bg-black/90 border-white/10 h-[90vh] max-h-[90vh] p-0 overflow-hidden">
            <div className="flex flex-col h-full overflow-hidden">
              {editMode ? (
                <div className="flex flex-col h-full overflow-hidden">
                  <DialogHeader className="p-4 border-b border-white/10">
                    <DialogTitle>Edit Post</DialogTitle>
                    <DialogDescription>
                      Make changes to your post caption below.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="flex-1 p-4 overflow-y-auto">
                    {!isTextPost() && parsedImages.length > 0 && (
                      <div className="mb-6">
                        <img 
                          src={parsedImages[0]} 
                          alt="Post preview" 
                          className="w-full max-h-[200px] object-cover rounded-lg"
                        />
                      </div>
                    )}
                    
                    <Textarea
                      value={editedCaption}
                      onChange={(e) => setEditedCaption(e.target.value)}
                      placeholder="Edit your caption..."
                      className="min-h-[150px] bg-gray-800 text-white border-gray-700 resize-none"
                      autoFocus
                    />
                  </div>
                  
                  <div className="p-4 border-t border-white/10 flex justify-end gap-2">
                    <Button 
                      variant="ghost" 
                      onClick={() => {
                        setEditedCaption(captionState || "");
                        setEditMode(false);
                      }}
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button 
                      onClick={handleEdit}
                      disabled={loading}
                    >
                      {loading ? (
                        <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                      ) : (
                        'Save Changes'
                      )}
                    </Button>
                  </div>
                </div>
              ) : (
                <>
                  {isTextPost() ? (
                    <div className="relative h-auto max-h-[60%] min-h-[200px] bg-black/40 flex items-center justify-center p-8">
                      <p className="text-xl font-medium text-center">{captionState}</p>
                    </div>
                  ) : parsedImages.length > 0 && (
                    <div className="relative h-auto flex-grow bg-black flex items-center justify-center overflow-hidden">
                      <div 
                        className="w-full flex transition-transform duration-300 ease-in-out" 
                        style={{ transform: `translateX(-${currentImageIndex * 100}%)` }}
                        onTouchStart={handleTouchStart}
                        onTouchMove={handleTouchMove}
                        onTouchEnd={handleTouchEnd}
                      >
                        {parsedImages.map((image, index) => (
                          <div key={index} className="w-full flex-shrink-0 flex items-center justify-center">
                            <img 
                              src={image}
                              alt={caption || `Post image ${index + 1}`}
                              className="max-w-full max-h-[60vh] object-contain"
                              onError={(e) => {
                                (e.target as HTMLImageElement).src = 'https://source.unsplash.com/800x600/?abstract';
                              }}
                            />
                          </div>
                        ))}
                      </div>
                      
                      {parsedImages.length > 1 && (
                        <>
                          {currentImageIndex > 0 && (
                            <button 
                              className="absolute left-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 p-1 rounded-full transition-colors duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePrevImage();
                              }}
                            >
                              <ChevronLeft className="h-6 w-6" />
                            </button>
                          )}
                          
                          {currentImageIndex < parsedImages.length - 1 && (
                            <button 
                              className="absolute right-2 top-1/2 transform -translate-y-1/2 bg-black/30 hover:bg-black/50 p-1 rounded-full transition-colors duration-200"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleNextImage();
                              }}
                            >
                              <ChevronRight className="h-6 w-6" />
                            </button>
                          )}
                          
                          <div className="absolute bottom-2 left-1/2 transform -translate-x-1/2 flex gap-1">
                            {parsedImages.map((_, index) => (
                              <div 
                                key={index} 
                                className={`w-2 h-2 rounded-full transition-colors duration-200 ${index === currentImageIndex ? 'bg-primary' : 'bg-white/30'}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setCurrentImageIndex(index);
                                }}
                                style={{ cursor: 'pointer' }}
                              />
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}

                  <div className="p-4 overflow-y-auto flex-1">
                    <div className="flex items-center gap-3 mb-4">
                      <ProfileImage 
                        src={profiles?.avatar_url || profiles?.auth_metadata?.avatar_url} 
                        alt={profiles?.username || profiles?.auth_metadata?.full_name || "User"}
                        className="w-8 h-8 rounded-full cursor-pointer"
                        onClick={handleProfileClick}
                      />
                      <div>
                        <div className="font-medium text-sm cursor-pointer hover:underline" onClick={handleProfileClick}>
                          {profiles?.username ||
                            profiles?.auth_metadata?.name ||
                            profiles?.auth_metadata?.full_name ||
                            "User"}
                        </div>
                        <span className="text-xs text-white/60">
                          {formatTimeAgo(created_at || new Date().toISOString())}
                        </span>
                      </div>
                      
                      {isOwner && (
                        <div className="ml-auto">
                          <DropdownMenu open={dropdownOpen} onOpenChange={setDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 p-0">
                                <MoreVertical className="h-4 w-4" />
                                <span className="sr-only">Post options</span>
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => {
                                setDropdownOpen(false);
                                setShowPromoteModal(true);
                              }}>
                                <Heart className="h-4 w-4 mr-2" />
                                Promote
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setDropdownOpen(false);
                                setEditMode(true);
                              }}>
                                <Edit className="h-4 w-4 mr-2" />
                                Edit Post
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={() => {
                                setDropdownOpen(false);
                                setShowDeleteConfirm(true);
                              }}>
                                <Trash className="h-4 w-4 mr-2" />
                                Delete Post
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                    </div>

                    {!isTextPost() && (
                      <div className="mb-4">
                        <p ref={captionRef} className={isTruncated && shouldTruncate ? "text-sm line-clamp-4" : "text-sm"}>
                          {captionState}
                        </p>
                        {shouldTruncate && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setIsTruncated(!isTruncated);
                            }}
                            className="text-primary text-xs mt-1 hover:underline"
                          >
                            {isTruncated ? "Show more" : "Show less"}
                          </button>
                        )}
                      </div>
                    )}

                    <div className="flex items-center gap-4 mt-6">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={handleLike}
                      >
                        <Heart className={`h-5 w-5 ${liked ? 'fill-red-500 text-red-500' : ''}`} />
                        <span>{likesCount || 0}</span>
                      </Button>
                      
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="flex items-center gap-2"
                        onClick={openCommentsModal}
                      >
                        <MessageCircle className="h-5 w-5" />
                        <span>{commentsCount || 0}</span>
                      </Button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </DialogContent>
        </Dialog>
      </div>
      
      <AuthRequiredModal 
        isOpen={showAuthModal}
        setIsOpen={setShowAuthModal}
        message="You need to sign in to interact with posts."
      />

      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this post? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button 
              variant="destructive" 
              onClick={handleDelete}
              disabled={loading}
            >
              {loading ? (
                <><LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> Deleting</>
              ) : (
                'Delete'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Promote Post Modal */}
      {showPromoteModal && (
        <PromotePostModal
          isOpen={showPromoteModal}
          onClose={() => setShowPromoteModal(false)}
          postId={id}
          userId={user_id}
        />
      )}
    </>
  );
}
