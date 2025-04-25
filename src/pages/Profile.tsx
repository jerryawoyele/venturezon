import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Post } from "@/components/home/Post";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Sidebar } from "@/components/home/Sidebar";
import { MobileHeader } from "@/components/home/MobileHeader";
import { supabase } from "@/integrations/supabase/client";
import { ServiceCard } from "@/components/services/ServiceCard";
import { AddServiceModal } from "@/components/services/AddServiceModal";
import { useToast } from "@/components/ui/use-toast";
import { 
  Star, 
  PenLine, 
  Users, 
  FileImage, 
  MessageSquare, 
  Bell, 
  User, 
  Briefcase, 
  Share2, 
  PlusCircle, 
  ShoppingCart, 
  Settings, 
  MoreVertical, 
  LogOut,
  Edit,
  ArrowLeft,
  CheckCircle
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { Profile as ProfileType, Post as PostType } from "@/types";
import ProfileImage from '@/components/ProfileImage';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { MainLayout } from "@/layouts/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { FollowersModal } from "@/components/profile/FollowersModal";
import { FollowingModal } from "@/components/profile/FollowingModal";
import { ReviewsModal } from "@/components/profile/ReviewsModal";
import { ServiceForm } from "@/components/forms/ServiceForm";
import { FileUpload } from "@/components/FileUpload";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CreatePost } from "@/components/home/CreatePost";
import { Badge } from "@/components/ui/badge";
import { createNotification } from '@/utils/notification-helper';
import { AvatarWithModal } from "@/components/profile/AvatarWithModal";
import { ServiceModal } from "@/components/services/ServiceModal";
import { DeleteServiceModal } from "@/components/services/DeleteServiceModal";
import { updateProfileReviews } from "@/utils/profile-helper";
import { ProfileCard } from "@/components/profile/ProfileCard";

// Define ServiceType locally since it's not exported from @/types
interface ServiceType {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number | string;
  image: string;
  user_id: string;
  created_at: string;
  location?: string;
  duration_minutes?: number;
  ratings_count?: number;
  ratings_sum?: number;
  owner_id?: string;
}

const AboutBusinessSection = ({ content, isOwner, onEdit }) => {
  const [isTruncated, setIsTruncated] = useState(true);
  const [shouldTruncate, setShouldTruncate] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const contentRef = useRef<HTMLParagraphElement>(null);
  
  useEffect(() => {
    const checkHeight = () => {
      if (contentRef.current) {
        // If text exceeds 100px, it should be truncated
        setShouldTruncate(contentRef.current.scrollHeight > 100);
      }
    };
    
    checkHeight();
    window.addEventListener('resize', checkHeight);
    
    return () => {
      window.removeEventListener('resize', checkHeight);
    };
  }, [content]);
  
  return (
    <>
      <div className="bg-black/20 rounded-md p-3">
        <p 
          ref={contentRef}
          className={isTruncated && shouldTruncate ? "text-white/80 line-clamp-4" : "text-white/80"}
        >
          {content}
        </p>
        
        {shouldTruncate && (
          <Button 
            variant="link" 
            onClick={() => setShowModal(true)}
            className="p-0 h-auto mt-1 text-primary"
          >
            Show more
          </Button>
        )}
      </div>
      
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>About the Business</DialogTitle>
          </DialogHeader>
          <div className="max-h-[60vh] overflow-y-auto mt-4">
            <p className="whitespace-pre-wrap text-white/80">
              {content}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export function Profile() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState("Profile");
  const [activeProfileTab, setActiveProfileTab] = useState<string>("posts");
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [isEditingAboutBusiness, setIsEditingAboutBusiness] = useState(false);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [userPosts, setUserPosts] = useState<PostType[]>([]);
  const [services, setServices] = useState<ServiceType[]>([]);
  const [showAddServiceModal, setShowAddServiceModal] = useState(false);
  
  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [aboutBusiness, setAboutBusiness] = useState("");
  const [avatar, setAvatar] = useState<File | null>(null);
  const [avatarUrl, setAvatarUrl] = useState("");
  const [userProfile, setUserProfile] = useState({
    displayName: '',
    email: '',
    avatarUrl: ''
  });
  const [userRole, setUserRole] = useState<"business" | "customer" | null>(null);
  const [notificationCount, setNotificationCount] = useState(0);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const postsTabRef = useRef<HTMLDivElement>(null);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [bookings, setBookings] = useState<any[]>([]);
  const [customerBookings, setCustomerBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(false);
  const [loadingCustomerBookings, setLoadingCustomerBookings] = useState(false);

  // Add these state variables for username validation
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);
  const [isUsernameAvailable, setIsUsernameAvailable] = useState<boolean | null>(null);
  const [usernameTimeout, setUsernameTimeout] = useState<NodeJS.Timeout | null>(null);

  // Add this state for the create post modal
  const [showCreatePostModal, setShowCreatePostModal] = useState(false);

  // Add these state variables in the Profile component
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);

  // State to track window width
  const [windowWidth, setWindowWidth] = useState<number>(window.innerWidth);

  // Add state for delete confirmation modal
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [showDeleteServiceModal, setShowDeleteServiceModal] = useState(false);
  const [serviceDeleteTitle, setServiceDeleteTitle] = useState("");

  useEffect(() => {
    const handleResize = () => {
      setWindowWidth(window.innerWidth);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    const initializeProfile = async () => {
      setLoading(true);
      try {
        await getProfile();
        // Main loading is handled by the specific loading states now
      } catch (error) {
        console.error("Error initializing profile:", error);
        setLoading(false);
      }
    };

    initializeProfile();
  }, []);

    const getProfile = async () => {
      try {
      setLoadingProfile(true);
      const { data: { session } } = await supabase.auth.getSession();
        
      if (!session) {
        navigate('/auth');
          return;
        }
        
      const { data, error } = await supabase
          .from('profiles')
          .select('*')
        .eq('id', session.user.id)
          .single();
          
        if (error) {
          throw error;
        }
        
      // Check if onboarding is completed, if not redirect to onboarding
      if (data && !data.onboarding_completed) {
        navigate('/onboarding');
        return;
      }
      
      // Update profile state with data
          setProfile(data);
          setUsername(data.username || "");
          setBio(data.bio || "");
          setAboutBusiness(data.about_business || "");
          setAvatarUrl(data.avatar_url || "");
      setUserRole(data.user_role || "customer");
      
      setLoadingProfile(false);
      
      fetchNotificationsCount();
      } catch (error) {
      console.error('Error fetching profile:', error);
      setLoadingProfile(false);
      }
    };
  
  useEffect(() => {
    const fetchUserProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        setUserProfile({
          displayName: user.user_metadata?.full_name || user.user_metadata?.name || 'User',
          email: user.email || '',
          avatarUrl: user.user_metadata?.avatar_url || null
        });
      }
    };
    
    fetchUserProfile();
  }, []);
  
  useEffect(() => {
    if (profile?.id) {
      fetchNotificationsCount();
    }
  }, [profile?.id]);
  
  const handleUpdateProfile = async () => {
    if (isUsernameAvailable === false) {
        toast({
        title: "Username not available",
        description: "Please choose a different username.",
          variant: "destructive",
        });
        return;
      }
      
    setLoadingProfile(true);

    try {
      const { error } = await supabase
        .from('profiles')
        .update({
          username,
          bio,
          avatar_url: avatarUrl,
          user_role: userRole as "customer" | "business"
        })
        .eq('id', profile?.id || '');
          
        if (error) throw error;
        
      setIsEditingProfile(false);
      toast({
        title: "Profile updated",
        description: "Your profile has been successfully updated.",
      });
      
      // Refresh profile data
      getProfile();
      window.location.reload();
      } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your profile. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingProfile(false);
    }
  };

  const handleUpdateAboutBusiness = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Error",
          description: "No user logged in",
          variant: "destructive",
        });
        return;
      }
      
      const updates = {
        about_business: aboutBusiness,
        updated_at: new Date().toISOString(),
      };
      
      const { error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', user.id);
        
      if (error) throw error;
      
      setIsEditingAboutBusiness(false);
      
      toast({
        title: "Success",
        description: "Business info updated successfully!",
      });
      
      if (profile) {
        setProfile({
          ...profile,
          about_business: aboutBusiness,
          updated_at: new Date().toISOString(),
        });
      }
    } catch (error) {
      console.error("Error updating business info:", error);
      toast({
        title: "Error",
        description: "Failed to update business info",
        variant: "destructive",
      });
    }
  };
  
  const handleAvatarChange = (url: string) => {
    setAvatarUrl(url);
  };
  
  const handleAddService = async (serviceData: any) => {
    try {
      // Check if we have profile data
      if (!profile) {
        toast({
          title: "Error",
          description: "Your profile data is not loaded. Please refresh and try again.",
          variant: "destructive",
        });
        return;
      }

      // Obtain any needed IDs
      const userId = profile.id;
      const serviceId = serviceData.id;

      // Check for required fields
      if (!serviceData.title || !serviceData.description) {
        toast({
          title: "Error",
          description: "Service title and description are required.",
          variant: "destructive",
        });
        return;
      }

      // Create full service object
      const newService = {
        id: serviceId,
        title: serviceData.title,
        description: serviceData.description,
        category: serviceData.category,
        price: serviceData.price,
        image: serviceData.image,
        location: serviceData.location,
        duration_minutes: serviceData.duration_minutes,
        owner_id: userId,
        user_id: userId,
        created_at: new Date().toISOString(),
      };

      // Update local state with complete service data
      setServices(prev => [...prev, newService]);
      
      // Notify followers about the new service
      if (serviceId && profile?.username) {
        // Create notification for followers
        createNotification({
          userId: userId,
          actorId: userId,
          actorName: profile.username,
          type: 'service',
          entityId: serviceId,
          message: `${profile.username} added a new service: ${serviceData.title}`
        });
      }

      toast({
        title: "Service Added",
        description: "Your service has been added successfully.",
      });
    } catch (error) {
      console.error("Error adding service:", error);
      toast({
        title: "Error",
        description: "Failed to add service. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const fetchUnreadMessagesCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      // Get all messages for this user where they're the receiver and the message is unread
      const { data, error } = await supabase
        .from('messages')
        .select('id')
        .eq('receiver_id', user.id)
        .eq('read', false);
        
      if (error) throw error;
      
      setUnreadMessages(data?.length || 0);
    } catch (error) {
      console.error("Error fetching unread messages count:", error);
    }
  };

  const fetchNotificationsCount = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) return;
      
      const { count, error } = await supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .eq('is_read', false);
        
      if (error) throw error;
      
      setNotificationCount(count || 0);
      setUnreadNotifications(count || 0);
      
      // Also fetch unread messages count
      fetchUnreadMessagesCount();
    } catch (error) {
      console.error("Error fetching notification count:", error);
    }
  };
  
  // Add a function to handle sharing the profile
  const handleShareProfile = () => {
    if (!profile?.id) return;
    
    const shareUrl = `${window.location.origin}/user/${profile.id}`;
    
    if (navigator.share) {
      navigator.share({
        title: `${profile?.username || 'User'}'s Profile`,
        url: shareUrl
      }).catch(error => console.log('Error sharing:', error));
    } else {
      // Fallback for browsers that don't support the Web Share API
      navigator.clipboard.writeText(shareUrl)
        .then(() => {
          toast({
            title: "Link Copied!",
            description: "Profile link copied to clipboard",
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
  };
  
  // Add this function to the component to ensure correct loading sequence
  useEffect(() => {
    // Separate these functions from the main effect to avoid unnecessary re-execution
    const fetchUserPosts = async () => {
      try {
        setLoadingPosts(true);
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) return;

        const { data, error } = await supabase
          .from('posts')
          .select(`
            *,
            profiles (
              id,
              username,
              avatar_url,
              bio,
              updated_at,
              about_business,
              followers_count,
              following_count,
              reviews_count,
              reviews_rating
            )
          `)
          .eq('user_id', session.user.id)
          .order('created_at', { ascending: false });

        if (error) throw error;

        setUserPosts(data || []);
        setLoadingPosts(false);
      } catch (error) {
        console.error('Error fetching posts:', error);
        setLoadingPosts(false);
      }
    };

    const fetchUserServices = async () => {
      try {
        setLoadingServices(true);
        
        if (!profile?.id) return;

        const { data, error } = await supabase
          .from('services')
          .select('*')
          .eq('owner_id', profile.id)
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        
        setServices(data || []);
      } catch (error) {
        console.error("Error fetching services:", error);
        setServices([]);
      } finally {
        setLoadingServices(false);
      }
    };

    // Only fetch posts and services after profile is loaded
    if (profile) {
      fetchUserPosts();
      if (profile.user_role === 'business') {
        fetchUserServices();
      }
    }
  }, [profile]);

  // Add this function to check username availability
  const checkUsernameAvailability = async (username: string) => {
    if (!username || username === profile?.username) {
      setIsUsernameAvailable(null);
        return;
      }
      
    setIsCheckingUsername(true);
    
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', username)
        .neq('id', profile?.id || '')
        .maybeSingle();
      
      if (error) throw error;
      
      // If no data returned, username is available
      setIsUsernameAvailable(!data);
    } catch (error) {
      console.error('Error checking username:', error);
      setIsUsernameAvailable(null);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  // Add debounce handling for username input
  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newUsername = e.target.value;
    setUsername(newUsername);
    
    // Clear any existing timeout
    if (usernameTimeout) {
      clearTimeout(usernameTimeout);
    }
    
    // Set a new timeout to check availability after typing stops
    const timeout = setTimeout(() => {
      checkUsernameAvailability(newUsername);
    }, 500);
    
    setUsernameTimeout(timeout as unknown as NodeJS.Timeout);
  };

  // Update the handleEditPost function to refresh the whole page
  const handleEditPost = async (postId: string, newCaption: string) => {
    try {
      // setLoadingPosts(true);
      
      const { error } = await supabase
      .from('posts')
      .update({ caption: newCaption })
      .eq('id', postId);
        
      if (error) throw error;
      
      
      toast({
        title: "Post updated",
        description: "Your post has been updated successfully."
      });
      
    } catch (error) {
      console.error('Error updating post:', error);
      toast({
        title: "Update failed",
        description: "There was an error updating your post. Please try again.",
        variant: "destructive"
      });
      setLoadingPosts(false);
    }
  };

  // Update handleDeletePost to refresh the whole page
  const handleDeletePost = async (postId: string) => {
    try {
      // setLoadingPosts(true);
      
      // First delete likes and comments
      await supabase.from('likes').delete().eq('post_id', postId);
      await supabase.from('comments').delete().eq('post_id', postId);
      
      // Then delete the post
      const { error } = await supabase
        .from('posts')
        .delete()
        .eq('id', postId);
      
      if (error) throw error;
      
      toast({
        title: "Post deleted",
        description: "Your post has been deleted successfully."
      });
      
      // Refresh the whole page
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error deleting post:', error);
      toast({
        title: "Delete failed",
        description: "There was an error deleting your post. Please try again.",
        variant: "destructive"
      });
      setLoadingPosts(false);
    }
  };

  // Update handleCreatePost to refresh the whole page
  const handleCreatePost = async (data: { text: string; image_url: string | string[]; isTextPost: boolean }) => {
    try {
      setLoadingPosts(true);
      const { text, image_url, isTextPost } = data;
      
      // Create the post
      const { error } = await supabase
        .from('posts')
        .insert({
          caption: text,
          image_url: Array.isArray(image_url) ? JSON.stringify(image_url) : image_url,
          user_id: profile?.id
        });
      
      if (error) throw error;
      
      toast({
        title: "Post created",
        description: "Your post has been created successfully."
      });
      
      // Close the modal
      setShowCreatePostModal(false);
      
      // Refresh the whole page
      setTimeout(() => window.location.reload(), 500);
    } catch (error) {
      console.error('Error creating post:', error);
      toast({
        title: "Post creation failed",
        description: "There was an error creating your post. Please try again.",
        variant: "destructive"
      });
      setLoadingPosts(false);
    }
  };

  useEffect(() => {
    if (profile?.id && profile?.user_role === "business" && activeProfileTab === "bookings") {
      fetchBookings();
    }
  }, [profile?.id, activeProfileTab]);
  
  const fetchBookings = async () => {
    if (!profile?.id) return;
    
    setLoadingBookings(true);
    try {
      // Fetch bookings where the current user is the service provider
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('provider_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (bookingsData && bookingsData.length > 0) {
        // Extract service IDs and customer IDs
        const serviceIds = bookingsData.map(booking => booking.service_id).filter(Boolean);
        const customerIds = bookingsData.map(booking => booking.customer_id).filter(Boolean);
        
        // Fetch services data
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, title, price, category, image')
          .in('id', serviceIds);
          
        if (servicesError) console.error("Error fetching services:", servicesError);
        
        // Fetch customers data
        const { data: customersData, error: customersError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', customerIds);
          
        if (customersError) console.error("Error fetching customers:", customersError);
        
        // Create lookup tables
        const servicesMap = (servicesData || []).reduce((acc, service) => {
          acc[service.id] = service;
          return acc;
        }, {});
        
        const customersMap = (customersData || []).reduce((acc, customer) => {
          acc[customer.id] = customer;
          return acc;
        }, {});
        
        // Join the data
        const bookingsWithRelations = bookingsData.map(booking => ({
          ...booking,
          services: servicesMap[booking.service_id] || { title: 'Unknown Service', price: 'N/A', category: 'Unknown' },
          customers: customersMap[booking.customer_id] || { username: 'Unknown Customer', avatar_url: null }
        }));
        
        setBookings(bookingsWithRelations);
      } else {
        setBookings([]);
      }
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast({
        variant: "destructive",
        title: "Failed to load bookings",
        description: "Please try again later.",
      });
    } finally {
      setLoadingBookings(false);
    }
  };
  
  const handleUpdateBookingStatus = async (bookingId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      // Update local state
      setBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId ? { ...booking, status: newStatus } : booking
        )
      );
      
      // Get booking details for notification
      const booking = bookings.find(b => b.id === bookingId);
      
      if (booking) {
        // Notify the customer about the status change
        const { data: profileData } = await supabase
          .from('profiles')
          .select('username')
          .eq('id', profile?.id)
          .single();
        
        if (profileData) {
          await createNotification({
            userId: booking.customer_id,
            actorId: profile?.id,
            actorName: profileData.username || 'Service Provider',
            type: 'booking',
            entityId: bookingId,
            message: `Your booking for "${booking.services?.title || 'service'}" has been ${newStatus}`
          });
        }
      }
      
      toast({
        title: "Booking updated",
        description: `Booking status has been updated to ${newStatus}.`,
      });
    } catch (error) {
      console.error("Error updating booking:", error);
      toast({
        variant: "destructive",
        title: "Update failed",
        description: "There was an error updating the booking status.",
      });
    }
  };

  // Add useEffect to fetch customer bookings when needed
  useEffect(() => {
    if (profile?.id && profile?.user_role !== "business" && activeProfileTab === "bookings") {
      fetchCustomerBookings();
    }
  }, [profile?.id, activeProfileTab]);

  // Add fetchCustomerBookings function
  const fetchCustomerBookings = async () => {
    if (!profile?.id) return;
    
    setLoadingCustomerBookings(true);
    try {
      // Fetch bookings where the current user is the customer
      const { data: bookingsData, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('customer_id', profile.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (bookingsData && bookingsData.length > 0) {
        // Extract service IDs and provider IDs
        const serviceIds = bookingsData.map(booking => booking.service_id).filter(Boolean);
        const providerIds = bookingsData.map(booking => booking.provider_id).filter(Boolean);
        
        // Fetch services data
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('id, title, price, category, image')
          .in('id', serviceIds);
          
        if (servicesError) console.error("Error fetching services:", servicesError);
        
        // Fetch providers data
        const { data: providersData, error: providersError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', providerIds);
          
        if (providersError) console.error("Error fetching providers:", providersError);
        
        // Create lookup tables
        const servicesMap = (servicesData || []).reduce((acc, service) => {
          acc[service.id] = service;
          return acc;
        }, {});
        
        const providersMap = (providersData || []).reduce((acc, provider) => {
          acc[provider.id] = provider;
          return acc;
        }, {});
        
        // Join the data
        const bookingsWithRelations = bookingsData.map(booking => ({
          ...booking,
          services: servicesMap[booking.service_id] || { title: 'Unknown Service', price: 'N/A', category: 'Unknown' },
          providers: providersMap[booking.provider_id] || { username: 'Unknown Provider', avatar_url: null }
        }));
        
        setCustomerBookings(bookingsWithRelations);
      } else {
        setCustomerBookings([]);
      }
    } catch (error) {
      console.error("Error fetching customer bookings:", error);
      toast({
        variant: "destructive",
        title: "Failed to load bookings",
        description: "Please try again later.",
      });
    } finally {
      setLoadingCustomerBookings(false);
    }
  };

  const handleCancelCustomerBooking = async (bookingId: string) => {
    try {
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      // Update local state
      setCustomerBookings(prev => 
        prev.map(booking => 
          booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking
        )
      );
      
      toast({
        title: "Booking cancelled",
        description: "Your booking has been cancelled.",
      });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast({
        variant: "destructive",
        title: "Cancellation failed",
        description: "There was an error cancelling your booking.",
      });
    }
  };
  
  // Add this function to handle service clicks
  const handleServiceClick = (service: ServiceType) => {
    navigate(`/services/${service.id}`);
  };

  // Add a function to update followers count
  const updateFollowersCount = (count: number) => {
    if (profile) {
      // Only update if the count is different to avoid unnecessary re-renders
      if (profile.followers_count !== count) {
        setProfile({
          ...profile,
          followers_count: count
        });
      }
    }
  };

  // Add a function to update following count
  const updateFollowingCount = (count: number) => {
    if (profile) {
      // Only update if the count is different to avoid unnecessary re-renders
      if (profile.following_count !== count) {
        setProfile({
          ...profile,
          following_count: count
        });
      }
    }
  };

  // Add a function to sync follower and following counts
  const syncFollowerCounts = async () => {
    if (!profile?.id) return;
    
    try {
      // Call the resync_follower_counts RPC function
      const { error } = await supabase.rpc('resync_follower_counts', {
        user_id: profile.id
      });
      
      if (error) {
        console.error("Error syncing follower counts:", error);
        return;
      }
      
      // Refresh the profile data to get the updated counts
      const { data, error: profileError } = await supabase
        .from('profiles')
        .select('followers_count, following_count')
        .eq('id', profile.id)
        .single();
      
      if (profileError || !data) {
        console.error("Error fetching updated profile:", profileError);
        return;
      }
      
      // Update the profile with new counts
      setProfile({
        ...profile,
        followers_count: data.followers_count,
        following_count: data.following_count
      });
    } catch (error) {
      console.error("Error in syncFollowerCounts:", error);
    }
  };

  // Call syncFollowerCounts after profile is loaded
  useEffect(() => {
    if (profile?.id) {
      syncFollowerCounts();
    }
  }, [profile?.id]);

  // Function to handle user logout
  const handleLogout = async () => {
    try {
      await supabase.auth.signOut();
      toast({
        title: "Logged out",
        description: "You have been successfully logged out",
      });
      navigate('/');
    } catch (error) {
      console.error('Error logging out:', error);
      toast({
        title: "Error",
        description: "Failed to log out. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Add this function to handle post count click
  const handlePostsClick = () => {
    setActiveProfileTab("posts");
    setTimeout(() => {
      if (postsTabRef.current) {
        postsTabRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 100);
  };

  // Update the handleDeleteService function
  const handleDeleteService = async (serviceId: string, serviceTitle?: string) => {
    // Set the service ID to delete and show the confirmation modal
    setServiceToDelete(serviceId);
    setServiceDeleteTitle(serviceTitle || "this service");
    setShowDeleteServiceModal(true);
  };

  // Handle the actual deletion after confirmation
  const confirmDeleteService = async () => {
    if (!serviceToDelete) return;
    
    try {
      const { error } = await supabase
        .from('services')
        .delete()
        .eq('id', serviceToDelete);
        
      if (error) throw error;
      
      toast({
        title: "Service deleted",
        description: "Your service has been successfully deleted",
      });
      
      // Refresh services
      fetchUserServices();
    } catch (error) {
      console.error("Error deleting service:", error);
      toast({
        title: "Error",
        description: "Failed to delete the service. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Also add the missing fetchUserServices function if it doesn't exist
  const fetchUserServices = async () => {
    try {
      setLoadingServices(true);

      if (!profile?.id) return;

      const { data, error } = await supabase
        .from('services')
        .select('*')
        .eq('owner_id', profile.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setServices(data || []);
    } catch (error) {
      console.error("Error fetching services:", error);
      setServices([]);
    } finally {
      setLoadingServices(false);
    }
  };

  // Add this function
  const ensureReviewsData = async () => {
    if (!profile?.id) return;

    try {
      console.log("Updating reviews data for profile");
      // Use our utility function
      const { reviews_count, reviews_rating } = await updateProfileReviews(profile.id);

      // Only update profile if values are different
      if (profile.reviews_count !== reviews_count || profile.reviews_rating !== reviews_rating) {
        setProfile({
          ...profile,
          reviews_count,
          reviews_rating
        });
      }
    } catch (err) {
      console.error("Error in ensureReviewsData:", err);
    }
  };

  // Add this useEffect to update reviews when profile is loaded
  useEffect(() => {
    if (profile?.id) {
      // Update reviews data when profile is loaded
      ensureReviewsData();
    }
  }, [profile?.id]);

  if (loading && loadingProfile) {
    return (
      <div className="flex min-h-screen">
        <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} userRole={profile?.user_role} />
        <div className="flex-1 flex justify-center items-center">
          Loading profile...
        </div>
      </div>
    );
  }

  return (
    <MainLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab} 
      userRole={profile?.user_role}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
    >
      <div className="w-full min-h-screen overflow-x-hidden pb-16 md:pb-0">
        <div>
          {/* Profile header with skeleton loader */}
          <Card className="rounded-lg overflow-hidden mb-8">
            {loadingProfile ? (
              <div className="p-6">
                <div className="flex flex-col md:flex-row gap-6">
                  <Skeleton className="h-24 w-24 rounded-full" />
                  <div className="flex-1 space-y-4">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-full" />
                    <div className="flex gap-4">
                      <Skeleton className="h-10 w-24" />
                      <Skeleton className="h-10 w-24" />
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-6 relative">
                {/* Options dropdown for mobile - fixed to top right of the user card */}
                {windowWidth < 1024 && !isEditingProfile && (
                  <div className="absolute top-4 right-4 z-10">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8">
                          <MoreVertical className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={handleShareProfile}>
                          <Share2 className="mr-2 h-4 w-4" />
                          <span>Share Profile</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => navigate('/settings')}>
                          <Settings className="mr-2 h-4 w-4" />
                          <span>Settings</span>
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={handleLogout}>
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Logout</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
                
                <div className="flex flex-col md:flex-row gap-6">
                  <div className="flex flex-col sm:flex-row items-start gap-4 w-full">
                    

                    <div className="flex-shrink-0 flex justify-center sm:justify-start">
                      <AvatarWithModal
                        size={80}
                        className="border-2 border-white/20"
                        avatarUrl={profile?.avatar_url}
                        username={profile?.username}
                      />
                    </div>

                    <div className="flex-1 space-y-4 text-center sm:text-left">
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
                      </div>

                      <div className="flex flex-wrap justify-center sm:justify-start gap-2 mt-4 sm:mt-0">
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => setIsEditingProfile(true)}
                        >
                          Edit Profile
                        </Button>

                        {/* Notification icon */}
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => navigate('/notifications')}
                          className="flex items-center gap-1 relative"
                        >
                          <Bell className="h-4 w-4" />
                          {notificationCount > 0 && (
                            <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                              {notificationCount > 99 ? '99+' : notificationCount}
                            </span>
                          )}
                        </Button>

                        {/* Only show these buttons on desktop */}
                        {windowWidth >= 1024 && (
                          <>
                            <Button 
                              onClick={handleShareProfile} 
                              size="sm" 
                              variant="ghost"
                              className="text-primary/70 hover:text-primary hover:bg-primary/10"
                            >
                              <Share2 className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => navigate('/settings')}
                              className="rounded-sm text-primary/70 hover:text-primary hover:bg-primary/10"
                              title="Settings"
                            >
                              <Settings className="h-4 w-4" />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Stats row */}
                <div className="flex flex-row flex-wrap justify-around mt-4 pt-4">
                  <div
                    className="text-center cursor-pointer mb-4 bg-background px-12 py-4 rounded-md transition-colors"
                    onClick={handlePostsClick}
                  >
                    <p className="font-semibold">{userPosts.length}</p>
                    <p className="dark:text-white text-dark text-sm">Posts</p>
                  </div>
                  
                  <div
                    className="text-center cursor-pointer mb-4 bg-background px-8 py-4 rounded-md transition-colors"
                    onClick={() => setShowFollowersModal(true)}
                  >
                    <p className="font-semibold">{profile?.followers_count || 0}</p>
                    <p className="dark:text-white text-dark text-sm">Followers</p>
                  </div>
                  
                  <div
                    className="text-center cursor-pointer mb-4 bg-background px-8 py-4 rounded-md transition-colors"
                    onClick={() => setShowFollowingModal(true)}
                  >
                    <p className="font-semibold">{profile?.following_count || 0}</p>
                    <p className="dark:text-white text-dark text-sm">Following</p>
                  </div>
                  
                  {profile?.user_role === "business" && (
                    <div 
                      onClick={() => setShowReviewsModal(true)}
                      className="text-center cursor-pointer mb-4 bg-background px-6 py-4 rounded-md transition-colors"
                    >
                      <div className="flex items-center justify-center gap-1">
                        <Star className="w-4 h-4 text-yellow-400" />
                        <p className="font-semibold">
                          {profile?.reviews_count && profile.reviews_count > 0
                            ? (profile?.reviews_rating?.toFixed(1) || '0.0')
                            : '-'}
                        </p>
                      </div>
                      <p className="dark:text-white text-dark text-sm">
                        {profile?.reviews_count && profile.reviews_count > 0
                          ? `Reviews (${profile?.reviews_count})`
                          : 'No reviews'}
                      </p>
                    </div>
                  )}
                </div>

                {/* About Business Section - Only for business accounts */}
                {profile?.user_role === "business" && (
                  <div className="mt-4 pt-4 ">
                    <div className="flex justify-between items-center mb-2">
                      <h3 className="text-lg font-semibold">About the Business</h3>
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={() => setIsEditingAboutBusiness(true)}
                        className="h-8 w-8 p-0"
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                    
                    {profile?.about_business ? (
                      <AboutBusinessSection 
                        content={profile.about_business} 
                        isOwner={true}
                        onEdit={() => setIsEditingAboutBusiness(true)}
                      />
                    ) : (
                      <div className="text-white/60 italic text-sm">
                        Add information about your business to help customers learn more about your services.
                      </div>
                    )}
                  </div>
                )}

                
              </div>
            )}
          </Card>
          
          {/* Tabs for Posts, Services, and Bookings based on user role */}
          <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab}>
            <TabsList className="mb-6">
              <TabsTrigger value="posts">Posts</TabsTrigger>
              {profile?.user_role === "business" ? (
                <TabsTrigger value="services">Services</TabsTrigger>
              ) : (
                <TabsTrigger value="bookings">Bookings</TabsTrigger>
              )}
            </TabsList>
            
            <TabsContent value="posts" className="pb-4">
              <div ref={postsTabRef} className="mb-4 flex justify-between items-center">
                <h2 className="text-xl font-semibold"></h2>
                {profile?.id && (
                  <Button 
                    onClick={() => setShowCreatePostModal(true)}
                    className="flex items-center gap-2"
                  >
                    <PlusCircle className="h-4 w-4" />
                    Create Post
                </Button>
                )}
              </div>
              
              <div className="grid grid-cols-1 gap-4">
                {loadingPosts ? (
                  // Post skeletons
                  Array(3).fill(0).map((_, i) => (
                    <div key={i} className="w-full rounded-lg overflow-hidden">
                      <div className="p-4 bg-black/20 flex items-center gap-3">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-32" />
                          <Skeleton className="h-3 w-24" />
            </div>
                      </div>
                      <Skeleton className="h-64 w-full" />
                      <div className="p-4 bg-black/20 space-y-2">
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                      </div>
                    </div>
                  ))
                ) : userPosts.length > 0 ? (
                  userPosts.map((post) => (
                    <Post 
                      key={post.id} 
                      {...post} 
                      profiles={post.profiles} 
                      currentUserId={async () => profile?.id}
                      onEdit={handleEditPost}
                      onDelete={handleDeletePost}
                    />
                  ))
                ) : (
                  <div className="text-center py-8">
                    <Card className="p-8 text-center">
                      <p className="mb-4">You haven't created any posts yet</p>
                      <Button onClick={() => setShowCreatePostModal(true)}>Create Post</Button>
          </Card>
                  </div>
                )}
              </div>
            </TabsContent>
            
            <TabsContent value="services" className="mt-0">
              <div className="flex justify-end mb-4">
                  <Button onClick={() => setShowAddServiceModal(true)}>Add Service</Button>
                </div>
                
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {loadingServices ? (
                  // Service skeletons
                  Array(6).fill(0).map((_, i) => (
                    <div key={i} className="rounded-lg overflow-hidden">
                      <Skeleton className="aspect-video w-full" />
                      <div className="p-4 bg-black/20 space-y-2">
                        <Skeleton className="h-5 w-3/4" />
                        <Skeleton className="h-4 w-1/2" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </div>
                  ))
                ) : services.length > 0 ? (
                  services.map((service) => (
                    <ServiceCard 
                      key={service.id} 
                      service={{
                        id: service.id,
                        title: service.title,
                        description: service.description,
                        category: service.category,
                        price: typeof service.price === 'string' ? parseFloat(service.price) : service.price,
                        location: service.location || "",
                        duration_minutes: service.duration_minutes || 60,
                        image: service.image,
                        owner_id: service.user_id || profile?.id || "",
                        ratings_count: service.ratings_count || 0,
                        ratings_sum: service.ratings_sum || 0
                      }}
                      showOptions={true}
                      onDelete={() => handleDeleteService(service.id, service.title)}
                      refreshServices={() => {
                        const fetchServices = async () => {
                          try {
                            setLoadingServices(true);
                            
                            if (!profile?.id) return;
                  
                            const { data, error } = await supabase
                              .from('services')
                              .select('*')
                              .eq('owner_id', profile.id)
                              .order('created_at', { ascending: false });
                              
                            if (error) throw error;
                            
                            setServices(data || []);
                          } catch (error) {
                            console.error("Error fetching services:", error);
                            setServices([]);
                          } finally {
                            setLoadingServices(false);
                          }
                        };
                        
                        fetchServices();
                      }}
                    />
                  ))
                ) : (
                  <div className="col-span-full text-center py-8">
                  <Card className="p-8 text-center">
                    <p className="mb-4">You haven't added any services yet</p>
                      <Button onClick={() => setShowAddServiceModal(true)}>Add Service</Button>
                  </Card>
                  </div>
                )}
              </div>
              </TabsContent>
            <TabsContent value="bookings" className="mt-0">
              <Card>
                <CardHeader>
                  <CardTitle>My Bookings</CardTitle>
                  <CardDescription>
                    Services you have booked
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingBookings ? (
                    // Loading skeleton
                    <div className="space-y-4">
                      {Array(3).fill(0).map((_, i) => (
                        <div key={i} className="p-4 border rounded-lg animate-pulse">
                          <div className="flex justify-between">
                            <div className="h-5 bg-gray-300 rounded w-1/3"></div>
                            <div className="h-5 bg-gray-300 rounded w-1/4"></div>
                          </div>
                          <div className="h-4 bg-gray-300 rounded w-1/2 mt-2"></div>
                          <div className="h-10 bg-gray-300 rounded w-full mt-4"></div>
                        </div>
                      ))}
                    </div>
                  ) : bookings.length > 0 ? (
                    <div className="space-y-4">
                      {bookings.map((booking) => (
                        <Card key={booking.id} className="overflow-hidden">
                          <CardHeader className="p-4">
                            <div className="flex justify-between items-center">
                              <div>
                                <div className="flex items-center gap-2">
                                  <ShoppingCart className="h-4 w-4" />
                                  <h3 className="font-medium">{booking.services.title}</h3>
                                </div>
                                <div className="text-sm text-muted-foreground mt-1">
                                  <p>Provider: {booking.customers.username}</p>
                                  <p>Price: ${booking.services.price}</p>
                                  <p>Booked on: {new Date(booking.created_at).toLocaleDateString()}</p>
                                </div>
                              </div>
                              <Badge variant={
                                booking.status === 'completed' ? 'default' :
                                booking.status === 'pending' ? 'secondary' :
                                booking.status === 'cancelled' ? 'destructive' :
                                booking.status === 'confirmed' ? 'outline' : 'default'
                              }>
                                {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                              </Badge>
                            </div>
                          </CardHeader>
                          <CardFooter className="p-4 bg-muted/20 flex justify-end gap-2">
                            {["pending", "confirmed"].includes(booking.status) && (
                              <Button 
                                variant="outline" 
                                size="sm"
                                onClick={() => handleUpdateBookingStatus(booking.id, 'cancelled')}
                              >
                                Cancel Booking
                              </Button>
                            )}
                            <Button
                              variant="default"
                              size="sm"
                              onClick={() => navigate(`/messages?user=${booking.customer_id}`)}
                            >
                              <MessageSquare className="h-4 w-4 mr-2" />
                              Message Provider
                            </Button>
                          </CardFooter>
                        </Card>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p>You don't have any service bookings yet.</p>
                      <Button 
                        onClick={() => navigate('/discover')} 
                        className="mt-4"
                      >
                        Discover Services
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
          
          {/* Edit About Business Modal */}
          <Dialog open={isEditingAboutBusiness} onOpenChange={setIsEditingAboutBusiness}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Edit Business Information</DialogTitle>
                <DialogDescription>
                  Provide details about your business to attract more customers.
                </DialogDescription>
              </DialogHeader>
              <div className="py-4">
                <Textarea
                  value={aboutBusiness}
                  onChange={(e) => setAboutBusiness(e.target.value)}
                  placeholder="Describe your business, services, years of experience, etc."
                  className="min-h-[150px]"
                />
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setAboutBusiness(profile?.about_business || "");
                    setIsEditingAboutBusiness(false);
                  }}
                >
                  Cancel
                </Button>
                <Button onClick={handleUpdateAboutBusiness}>Save</Button>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Add Service Modal */}
          <AddServiceModal
            isOpen={showAddServiceModal}
            onClose={() => setShowAddServiceModal(false)}
            onServiceAdded={handleAddService}
          />
          
          {/* Modals for followers, following, and reviews */}
          {profile?.id && (
            <>
              <FollowersModal
                isOpen={showFollowersModal}
                onClose={() => setShowFollowersModal(false)}
                userId={profile?.id || ''}
                currentUserId={profile?.id || null}
                onFollowersLoaded={updateFollowersCount}
              />
              
              <FollowingModal 
                isOpen={showFollowingModal} 
                onClose={() => setShowFollowingModal(false)} 
                userId={profile?.id || ''}
                currentUserId={profile?.id || null}
                onFollowingLoaded={updateFollowingCount}
              />
              
              <ReviewsModal 
                userId={profile.id}
                isOpen={showReviewsModal}
                onClose={() => setShowReviewsModal(false)}
                currentUserId={profile.id}
              />
            </>
          )}

          {/* Edit Profile Modal */}
          <Dialog open={isEditingProfile} onOpenChange={setIsEditingProfile}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Edit Profile</DialogTitle>
                <DialogDescription>
                  Update your profile information here. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-6 py-4">
                {/* Profile Picture Upload */}
                <div className="space-y-2">
                  <Label htmlFor="avatar">Profile Picture</Label>
                  <div className="flex items-center gap-4">
                    <Avatar
                      className="mx-auto h-24 w-24 cursor-pointer"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <AvatarImage src={avatarUrl || profile?.avatar_url} />
                      <AvatarFallback>{profile?.username?.[0] || 'U'}</AvatarFallback>
                    </Avatar>
                    <FileUpload
                      endpoint="profilePicture"
                      onChange={handleAvatarChange} 
                    />
                  </div>
                </div>
                
                {/* Username */}
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <div className="relative">
                    <Input
                      id="username"
                      value={username}
                      onChange={handleUsernameChange}
                      placeholder="Enter username"
                      className={isUsernameAvailable === false ? "border-red-500 pr-10" : "pr-10"}
                    />
                    {isCheckingUsername && (
                      <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                        <div className="animate-spin h-4 w-4 border-2 border-primary border-t-transparent rounded-full" />
                      </div>
                    )}
                    {!isCheckingUsername && username && isUsernameAvailable === true && (
                      <CheckCircle className="absolute right-3 top-1/2 transform -translate-y-1/2 text-green-500 h-4 w-4" />
                    )}
                  </div>
                  {isUsernameAvailable === false && (
                    <p className="text-sm text-red-500">This username is already taken.</p>
                  )}
                </div>
                
                {/* Bio */}
                <div className="space-y-2">
                  <Label htmlFor="bio">Bio</Label>
                  <Textarea
                    id="bio"
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    placeholder="Tell us about yourself..."
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => {
                  setUsername(profile?.username || "");
                  setBio(profile?.bio || "");
                  setUserRole(profile?.user_role || "customer");
                  setIsUsernameAvailable(null);
                  setIsEditingProfile(false);
                }}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleUpdateProfile} 
                  disabled={isUsernameAvailable === false || isCheckingUsername}
                >
                  Save Changes
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
          
          {/* Create Post Modal */}
          {profile?.id && (
            <Dialog open={showCreatePostModal} onOpenChange={setShowCreatePostModal}>
              <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-auto">
              <DialogHeader>
                  <DialogTitle>Create Post</DialogTitle>
                <DialogDescription>
                    Share what's on your mind or upload images.
                </DialogDescription>
              </DialogHeader>
                <CreatePost 
                  onSubmit={handleCreatePost}
                />
            </DialogContent>
          </Dialog>
          )}

          {/* Service Modal */}
          <ServiceModal
            service={selectedService}
            isOpen={showServiceModal}
            onClose={() => setShowServiceModal(false)}
          />

          {/* Delete Service Confirmation Modal */}
          <DeleteServiceModal
            isOpen={showDeleteServiceModal}
            onClose={() => setShowDeleteServiceModal(false)}
            onConfirm={confirmDeleteService}
            serviceTitle={serviceDeleteTitle}
          />
                </div>
        </div>
    </MainLayout>
  );
}
