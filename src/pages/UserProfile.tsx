import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardFooter, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Separator } from "@/components/ui/separator";
import { Post } from "@/components/home/Post";
import { Sidebar } from "@/components/home/Sidebar";
import { MobileHeader } from "@/components/home/MobileHeader";
import { ServiceModal } from "@/components/services/ServiceModal";
import { supabase } from "@/integrations/supabase/client";
import { ServiceCard } from "@/components/services/ServiceCard";
import { useToast } from "@/components/ui/use-toast";
import { Star, Users, FileImage, MessageSquare, Share2, ShoppingCart, CheckCircle, ArrowLeft, Bell, User } from "lucide-react";
import type { Profile as ProfileType, Post as PostType } from "@/types";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import { FollowersModal } from "@/components/profile/FollowersModal";
import { FollowingModal } from "@/components/profile/FollowingModal";
import { ReviewsModal } from "@/components/profile/ReviewsModal";
import { MainLayout } from "@/layouts/MainLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { createNotification } from '@/utils/notification-helper';
import { Badge } from "@/components/ui/badge";
import { AvatarWithModal } from "@/components/profile/AvatarWithModal";
import { updateProfileReviews } from "@/utils/profile-helper";
import { DeleteServiceModal } from "@/components/services/DeleteServiceModal";
import { ProfileCard } from "@/components/profile/ProfileCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

// Define ServiceType locally since it's not exported from @/types
interface ServiceType {
  id: string;
  title: string;
  description: string;
  price: number;
  image_url?: string;
  owner_id: string;
  created_at: string;
}

const AboutBusinessSection = ({ content }) => {
  const [showModal, setShowModal] = useState(false);
  const [shouldTruncate, setShouldTruncate] = useState(false);
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
      <div className="bg-black/20 rounded-md p-4">
        <p 
          ref={contentRef}
          className={cn(
            "dark:text-white/60 text-black/60 whitespace-pre-wrap",
            shouldTruncate && "line-clamp-4"
          )}
        >
          {content}
        </p>
        
        {shouldTruncate && (
          <Button 
            variant="link" 
            onClick={() => setShowModal(true)}
            className="p-0 h-auto mt-1 text-primary hover:text-primary/80"
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
            <p className="whitespace-pre-wrap dark:text-white/60 text-black/60">
              {content}
            </p>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export function UserProfile() {
  const params = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Extract username or userId from params
  const [activeTab, setActiveTab] = useState("Discover");
  const [activeProfileTab, setActiveProfileTab] = useState("posts");
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<ProfileType | null>(null);
  const [userPosts, setUserPosts] = useState<PostType[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [bookings, setBookings] = useState<any[]>([]);
  const [currentUser, setCurrentUser] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [selectedService, setSelectedService] = useState<ServiceType | null>(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showFollowersModal, setShowFollowersModal] = useState(false);
  const [showFollowingModal, setShowFollowingModal] = useState(false);
  const [showReviewsModal, setShowReviewsModal] = useState(false);
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingFollowStatus, setLoadingFollowStatus] = useState(false);
  const postRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const postsTabRef = useRef<HTMLDivElement>(null);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [unreadMessages, setUnreadMessages] = useState(0);
  const [serviceToDelete, setServiceToDelete] = useState<string | null>(null);
  const [showDeleteServiceModal, setShowDeleteServiceModal] = useState(false);
  const [serviceDeleteTitle, setServiceDeleteTitle] = useState("");

  // Debug log for params
  useEffect(() => {
    console.log("UserProfile params:", params);
    console.log("Current URL path:", location.pathname);
    console.log("Current URL search:", location.search);
  }, [params, location]);

  // Use effect to check for tab parameter in URL and set the active tab
  useEffect(() => {
    // Get the 'tab' query parameter from the URL
    const searchParams = new URLSearchParams(location.search);
    const tabParam = searchParams.get('tab');

    // If tab parameter exists and is valid, set it as the active tab
    if (tabParam === 'services' || tabParam === 'posts') {
      setActiveProfileTab(tabParam);
    }
  }, [location.search]);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session) {
          setIsAuthenticated(true);
          setCurrentUser(session.user.id);

          // Fetch current user role from profiles table
          const { data: currentUserData, error: roleError } = await supabase
            .from('profiles')
            .select('*')  // Select all columns to avoid specific column errors
            .eq('id', session.user.id)
            .single();

          if (!roleError && currentUserData) {
            try {
              // Check if user_role exists in the data
              if ('user_role' in currentUserData) {
                // Safely cast the type
                const role = currentUserData.user_role as string;
                setCurrentUserRole(role);

              } else {
                // Default to customer if no role specified
                setCurrentUserRole("customer");
                console.warn("user_role field not found in profiles table");
              }
            } catch (err) {
              console.error("Error parsing user role:", err);
              setCurrentUserRole("customer"); // Default fallback
            }
          }
        } else {
          setIsAuthenticated(false);
          setCurrentUser(null);
        }
      } catch (error) {
        console.error("Error checking auth:", error);
      }
    };

    checkAuth();
  }, []);

  // Check if the current user is following this profile
  const checkFollowStatus = async () => {
    if (!profile || !currentUser) return;

    try {
      setLoadingFollowStatus(true);

      try {
        // Use the Supabase URL and key directly from the client file
        const supabaseUrl = "https://zrjgcanxtojemyknzfgl.supabase.co";
        const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyamdjYW54dG9qZW15a256ZmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTY1NjMsImV4cCI6MjA1NTkzMjU2M30.fUzRKtbcoYU6SXhB3FM2gXtn2NhI9427-U6eAF5yDdE";

        // Get auth session for authorization header
        const { data: { session } } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        };

        // Add authorization header if we have a session
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }

        console.log(`Checking follow status: ${currentUser} following ${profile.id}`);

        // Make sure we're using the correct IDs for the check
        const response = await fetch(
          `${supabaseUrl}/rest/v1/follows?follower_id=eq.${currentUser}&following_id=eq.${profile.id}`,
          { headers }
        );

        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }

        const followData = await response.json();
        console.log("Follow status check result:", followData);
        
        // Make sure we properly set the state based on the response
        const following = followData && followData.length > 0;
        console.log("Setting isFollowing to:", following);
        setIsFollowing(following);
      } catch (error) {
        console.error("Error checking follow status:", error);
        setIsFollowing(false);
      }

      setLoadingFollowStatus(false);
    } catch (error) {
      console.error("Error in checkFollowStatus:", error);
      setLoadingFollowStatus(false);
    }
  };

  // Load user's posts and services
  const loadContent = async () => {
    try {
      // Set loading state for posts
      setLoadingPosts(true);

      // Fetch the posts for this profile
      const { data, error } = await supabase
        .from('posts')
        .select(`
            *,
          profiles (*)
          `)
        .eq('user_id', profile?.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error("Error fetching posts:", error);
      } else {
        setUserPosts(data as unknown as PostType[]);
      }

      // Fetch services if business user
      if (profile?.user_role === "business") {
        setLoadingServices(true);
        const { data: servicesData, error: servicesError } = await supabase
          .from('services')
          .select('*')
          .eq('owner_id', profile?.id)
          .order('created_at', { ascending: false });

        if (servicesError) {
          console.error("Error fetching services:", servicesError);
        } else {
          setServices(servicesData as any[]);
        }
        setLoadingServices(false);
      }

      // If we need to scroll to a specific post
      if (params.postId) {
        setTimeout(() => {
          const postElement = postRefs.current[params.postId];
          if (postElement) {
            postElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
            postElement.classList.add('highlight-post');

            // Remove highlight after animation
            setTimeout(() => {
              postElement.classList.remove('highlight-post');
            }, 2000);
          }
        }, 500);
      }

      // Loading complete
      setLoadingPosts(false);
      setLoading(false);
    } catch (err) {
      console.error("Error loading content:", err);
      setLoadingPosts(false);
      setLoading(false);
    }
  };

  // Helper function to fetch profile by a specific field and operator
  const fetchProfileByField = async (field: string, operator: string, value: string) => {
    console.log(`Fetching profile by ${field} with operator ${operator} and value ${value}`);
    try {
      // Check if supabase is available
      if (!supabase) {
        console.error("Supabase client not available");
        return null;
      }

      // Use the REST API directly
      const supabaseUrl = "https://zrjgcanxtojemyknzfgl.supabase.co";
      const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyamdjYW54dG9qZW15a256ZmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTY1NjMsImV4cCI6MjA1NTkzMjU2M30.fUzRKtbcoYU6SXhB3FM2gXtn2NhI9427-U6eAF5yDdE";

      // For case-insensitive username matching, we should ensure we're using ilike
      let queryParam = `${field}=${operator}.`;
      if (field === 'username' && operator === 'eq') {
        // Always use ilike for usernames to ensure case-insensitive matching
        queryParam = `${field}=ilike.`;
      }

      const response = await fetch(`${supabaseUrl}/rest/v1/profiles?${queryParam}${encodeURIComponent(value)}&select=*`, {
        headers: {
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      });

      if (!response.ok) {
        console.error(`HTTP error! status: ${response.status}`);
        return null;
      }

      const profiles = await response.json();
      console.log(`Fetch result for ${field}=${value}:`, profiles);

      if (profiles && profiles.length > 0) {
        return profiles[0];
      } else {
        console.log(`No profile found with ${field}=${value}`);
        return null;
      }
    } catch (error) {
      console.error(`Error fetching profile by ${field}:`, error);
      return null;
    }
  };

  // Fetch user profile by user ID or username
  useEffect(() => {
    const fetchProfileData = async () => {
      try {
        setLoadingProfile(true);

        // Get the userId or username from params
        const { userId, username } = params;
        console.log("Fetching profile with params:", { userId, username });

        if (!userId && !username) {
          console.error("No userId or username found in params");
          setLoadingProfile(false);
          return;
        }

        let profileData = null;

        if (username) {
          console.log("Fetching profile by username:", username);
          // If username starts with @, remove it
          const cleanUsername = username.startsWith('@') ? username.substring(1) : username;
          console.log("Cleaned username:", cleanUsername);

          // Special logging for Spyrojerry
          if (cleanUsername.toLowerCase() === 'spyrojerry') {
            console.warn("DEBUG: Attempting to fetch Spyrojerry profile");
          }

          // Attempt to fetch profile by username using ilike for case-insensitive matching
          try {
            // First try using ilike directly with Supabase client
            console.log(`Trying first method: supabase.from('profiles').select('*').ilike('username', ${cleanUsername})`);
            const { data, error } = await supabase
              .from('profiles')
              .select('*')
              .ilike('username', cleanUsername)
              .single();

            if (error) {
              console.error("Error fetching profile by username using ilike:", error);

              // Try second method - fetchProfileByField with eq (which will use ilike internally)
              console.log(`Trying second method: fetchProfileByField with username eq ${cleanUsername}`);
              profileData = await fetchProfileByField('username', 'eq', cleanUsername);

              if (!profileData) {
                // Third attempt - using direct ilike operator
                console.log(`Trying third method: fetchProfileByField with username ilike ${cleanUsername}`);
                profileData = await fetchProfileByField('username', 'ilike', cleanUsername);

                if (!profileData) {
                  // Final attempt - try a direct query for all profiles and match in memory
                  console.log("Trying final method: fetch all profiles and match in memory");
                  const { data: allProfiles, error: allProfilesError } = await supabase
                    .from('profiles')
                    .select('*');

                  if (!allProfilesError && allProfiles) {
                    console.log(`Found ${allProfiles.length} profiles in total`);
                    // Find profile with case-insensitive username match
                    const matchingProfile = allProfiles.find(
                      p => p.username && p.username.toLowerCase() === cleanUsername.toLowerCase()
                    );

                    if (matchingProfile) {
                      console.log("Found matching profile in memory:", matchingProfile);
                      profileData = matchingProfile;
                    } else {
                      // Log all usernames to help debug
                      console.log("All usernames in database:", allProfiles.map(p => p.username));
                    }
                  }
                }
              }
            } else {
              console.log("Profile fetched by username successfully:", data);
              profileData = data;
            }
          } catch (err) {
            console.error("Exception in username profile fetch:", err);
          }
        } else if (userId) {
          console.log("Fetching profile by userId:", userId);
          // Regular user ID lookup
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .single();

          if (error) {
            console.error("Error fetching profile by ID:", error);
          } else {
            console.log("Profile fetched by ID successfully:", data);
            profileData = data;
          }
        }

        if (profileData) {
          setProfile(profileData as ProfileType);

          // Check if this is the current user's profile
          const isOwn = currentUser && profileData.id === currentUser;
          console.log("Is own profile check:", { profileId: profileData.id, currentUser, isOwn });
          setIsOwnProfile(isOwn);

          // Load this user's content once we have their profile
          loadContent();

          // Only check follow status if this is not the user's own profile
          if (currentUser && !isOwn) {
            console.log("Checking follow status since this is not the user's own profile");
            checkFollowStatus();
          } else {
            console.log("Skipping follow status check:", { isOwn, currentUser });
          }
        } else {
          console.error("Profile not found");
          setProfile(null);
        }

        setLoadingProfile(false);
      } catch (error) {
        console.error("Error in fetchProfileData:", error);
        setLoadingProfile(false);
      }
    };

    // Always fetch profile data even if currentUser is null
    fetchProfileData();
  }, [params, currentUser]);

  // Effect to load posts and services after profile is loaded
  useEffect(() => {
    if (profile) {
      loadContent();

      // Check if this is the current user's profile
      if (currentUser && profile.id === currentUser) {
        setIsOwnProfile(true);
      } else {
        setIsOwnProfile(false);
      }
      
      // Load reviews data immediately when profile is loaded
      ensureReviewsData();
    }
  }, [profile, params, currentUser]);

  // Effect to check follow status when currentUser or profile changes
  useEffect(() => {
    // Only check follow status if both profile and currentUser exist
    // and it's not the user's own profile
    if (profile && currentUser && profile.id !== currentUser) {
      console.log("Checking follow status due to profile/currentUser change");
      checkFollowStatus();
    }
  }, [profile?.id, currentUser]);

  // Add this function to fetch bookings for the customer
  const fetchBookings = async () => {
    if (!profile?.id || profile?.user_role !== "customer") return;

    try {
      setLoadingBookings(true);

      // Get current user's session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        navigate('/auth');
        return;
      }

      // Only fetch bookings if viewing our own profile and we're a customer
      if (session.user.id !== profile.id) {
        setLoadingBookings(false);
        return;
      }

      try {
        // Use the supabase client instead of direct fetch
        const { data: bookingsData, error } = await supabase
          .from('bookings')
          .select('*')
          .eq('customer_id', profile.id)
          .order('created_at', { ascending: false });

        if (error) {
          throw error;
        }

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

          setBookings(bookingsWithRelations);
        } else {
          setBookings([]);
        }
      } catch (fetchError) {
        console.error("API fetch error:", fetchError);
        toast({
          variant: "destructive",
          title: "Error loading bookings",
          description: "Could not load your bookings. Please try again later.",
        });
        setBookings([]);
      }

      setLoadingBookings(false);
    } catch (error) {
      console.error("Error in fetchBookings:", error);
      setLoadingBookings(false);
    }
  };

  // Update the existing useEffect to call fetchBookings when appropriate
  useEffect(() => {
    if (profile) {
      loadContent();

      // If viewing own profile and user is a customer, fetch bookings
      if (currentUser === profile.id && profile.user_role === "customer") {
        fetchBookings();
      }
    }
  }, [profile, params, currentUser]);

  const requireAuth = (callback: Function) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    callback();
  };

  const handleServiceClick = (service: ServiceType) => {
    requireAuth(() => {
      // Navigate to service detail page instead of showing modal
      navigate(`/services/${service.id}`);
    });
  };

  const handleShareProfile = () => {
    const currentUrl = window.location.href;

    // Generate the profile URL using the @username format
    const shareUrl = profile?.username
      ? `${window.location.origin}/@${profile.username}`
      : currentUrl;

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

  const handleMessage = () => {
    requireAuth(() => {
      navigate(`/messages?user=${profile?.id}`);
    });
  };

  // Add function to handle booking cancellation
  const handleCancelBooking = async (bookingId: string) => {
    try {
      // Get current user's session
      const { data: { session } } = await supabase.auth.getSession();

      if (!session) {
        toast({
          variant: "destructive",
          title: "Not logged in",
          description: "You need to be logged in to cancel bookings.",
        });
        return;
      }

      // Use Supabase client instead of direct fetch
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'cancelled' })
        .eq('id', bookingId);

      if (error) {
        throw error;
      }

      // Update local state
      setBookings(prev =>
        prev.map(booking =>
          booking.id === bookingId ? { ...booking, status: 'cancelled' } : booking
        )
      );

      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully.",
      });
    } catch (error) {
      console.error("Error cancelling booking:", error);
      toast({
        variant: "destructive",
        title: "Cancellation failed",
        description: "There was an error cancelling your booking. Please try again.",
      });
    }
  };

  // Handle follow/unfollow button click
  const handleFollow = () => {
    requireAuth(async () => {
      try {
        // Set loading state first
        setLoadingFollowStatus(true);

        // Use the Supabase URL and key directly from the client file
        const supabaseUrl = "https://zrjgcanxtojemyknzfgl.supabase.co";
        const supabaseKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpyamdjYW54dG9qZW15a256ZmdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDAzNTY1NjMsImV4cCI6MjA1NTkzMjU2M30.fUzRKtbcoYU6SXhB3FM2gXtn2NhI9427-U6eAF5yDdE";

        // Get auth session for authorization header
        const { data: { session } } = await supabase.auth.getSession();

        const headers: Record<string, string> = {
          'apikey': supabaseKey,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Prefer': 'return=minimal'
        };

        // Add authorization header if we have a session
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        } else {
          toast({
            title: "Error",
            description: "You must be logged in to follow users",
            variant: "destructive"
          });
          setLoadingFollowStatus(false);
          return;
        }

        console.log("Current follow status before action:", isFollowing);

        if (isFollowing) {
          // Unfollow logic - use REST API directly
          console.log(`Unfollowing: ${currentUser} unfollows ${profile?.id}`);
          const response = await fetch(
            `${supabaseUrl}/rest/v1/follows?follower_id=eq.${currentUser}&following_id=eq.${profile?.id}`,
            {
              method: 'DELETE',
              headers
            }
          );

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }
          
          console.log("Successfully unfollowed user");
        } else {
          // Before following, check if the relationship already exists to avoid 409 conflict
          console.log(`Checking if ${currentUser} already follows ${profile?.id}`);
          const checkResponse = await fetch(
            `${supabaseUrl}/rest/v1/follows?follower_id=eq.${currentUser}&following_id=eq.${profile?.id}&select=id`,
            {
              headers: {
                'apikey': supabaseKey,
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            }
          );

          if (!checkResponse.ok) {
            throw new Error(`HTTP error checking follow status! status: ${checkResponse.status}`);
          }

          const existingFollow = await checkResponse.json();
          if (existingFollow && existingFollow.length > 0) {
            console.log("Follow relationship already exists, skipping follow creation");
            // If follow relationship already exists, just update UI state
            setIsFollowing(true);
          } else {
            // Follow logic - use REST API directly
            console.log(`Following: ${currentUser} follows ${profile?.id}`);
            const response = await fetch(
              `${supabaseUrl}/rest/v1/follows`,
              {
                method: 'POST',
                headers,
                body: JSON.stringify({
                  follower_id: currentUser,
                  following_id: profile?.id
                })
              }
            );

            if (!response.ok) {
              console.error(`Follow error: ${response.status}`, await response.text());
              throw new Error(`HTTP error! status: ${response.status}`);
            }
            
            console.log("Successfully followed user");

            // Create a notification for the user being followed
            if (profile?.id && currentUser) {
              // Get current user's profile info to use in notification
              const { data: currentUserProfile } = await supabase
                .from('profiles')
                .select('username')
                .eq('id', currentUser)
                .single();

              const username = currentUserProfile?.username || 'Someone';

              // Create the follow notification
              await createNotification({
                userId: profile.id,
                actorId: currentUser,
                actorName: username,
                type: 'follow',
                message: `${username} started following you`
              });
            }
          }
        }

        // Toggle follow status immediately for better UX
        const newFollowStatus = !isFollowing;
        console.log("Setting new follow status to:", newFollowStatus);
        setIsFollowing(newFollowStatus);

        // Update followers count in the UI
        if (profile) {
          const updatedProfile = {
            ...profile,
            followers_count: newFollowStatus
              ? (profile.followers_count || 0) + 1
              : Math.max((profile.followers_count || 0) - 1, 0) // Prevent negative counts
          };
          setProfile(updatedProfile as ProfileType);
        }

        // Finish loading
        setLoadingFollowStatus(false);

        // Show success message
        toast({
          title: newFollowStatus ? "Followed" : "Unfollowed",
          description: newFollowStatus
            ? `You are now following ${profile?.username}`
            : `You have unfollowed ${profile?.username}`,
        });
      } catch (error) {
        console.error("Error updating follow status:", error);
        setLoadingFollowStatus(false);
        toast({
          title: "Error",
          description: "Failed to update follow status",
          variant: "destructive"
        });
      }
    });
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

  // Add a function to ensure reviews data is available
  const ensureReviewsData = async () => {
    if (!profile?.id) return;

    try {
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

  // Call this when opening the reviews modal
  const handleOpenReviewsModal = () => {
    ensureReviewsData();
    setShowReviewsModal(true);
  };

  // Add a function to create a test review
  const createTestReview = async () => {
    if (!profile?.id || !currentUser) {
      toast({
        title: "Error",
        description: "Can't create test review - missing user data",
        variant: "destructive"
      });
      return;
    }

    try {
      const rating = Math.floor(Math.random() * 5) + 1; // Random rating 1-5

      // Create a test review
      const { data, error } = await supabase
        .from('reviews')
        .insert({
          user_id: profile.id,
          reviewer_id: currentUser,
          rating,
          content: `This is a test review with ${rating} stars.`,
          created_at: new Date().toISOString()
        })
        .select();

      if (error) {
        console.error("Error creating test review:", error);
        toast({
          title: "Error",
          description: `Failed to create test review: ${error.message}`,
          variant: "destructive"
        });
        return;
      }

      toast({
        title: "Test Review Created",
        description: `Added a test review with ${rating} stars`
      });

      // Refresh reviews data
      ensureReviewsData();

    } catch (err) {
      console.error("Error in createTestReview:", err);
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive"
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

  // Add this function to fetch unread messages count
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

  // Add a function to fetch notification count
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

      setUnreadNotifications(count || 0);

      // Also fetch unread messages count
      fetchUnreadMessagesCount();
    } catch (error) {
      console.error("Error fetching notification count:", error);
    }
  };

  // Add a useEffect to fetch notification and message counts
  useEffect(() => {
    if (isAuthenticated && currentUser) {
      fetchNotificationsCount();
    }
  }, [isAuthenticated, currentUser]);

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

  // Around line 500-550 (after handleServiceClick function)
  // Rename fetchServices function to fetchUserServices for consistency
  const fetchUserServices = async () => {
    try {
      setLoadingServices(true);

      // Fetch user services
      if (!profile) return;

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

  if (loading && !profile) {
    return (
      <MainLayout
        activeTab="Discover"
        setActiveTab={() => { }}
        userRole={currentUserRole as any}
        isAuthenticated={isAuthenticated}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
      >
        <div className="flex-1 min-h-screen flex flex-col justify-center items-center">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading profile...</p>
        </div>
      </MainLayout>
    );
  }

  if (!profile && !loadingProfile) {
    return (
      <MainLayout
        activeTab="Discover"
        setActiveTab={() => { }}
        userRole={currentUserRole as any}
        isAuthenticated={isAuthenticated}
        unreadNotifications={unreadNotifications}
        unreadMessages={unreadMessages}
      >
        <div className="flex-1 min-h-screen flex justify-center items-center">
          <div className="text-center max-w-md mx-auto p-8 bg-black/20 rounded-lg border border-white/10">
            <h2 className="text-xl font-semibold mb-4">User not found</h2>
            <p className="text-white/60 mb-6">The user you're looking for doesn't exist or has been removed.</p>
            <Button onClick={() => navigate('/discover')}>
              Discover Users
            </Button>
          </div>
        </div>
      </MainLayout>
    );
  }

  console.log("Rendering profile with isOwnProfile:", isOwnProfile, "Current user:", currentUser);

  return (
    <MainLayout
      activeTab={activeTab}
      setActiveTab={setActiveTab}
      userRole={currentUserRole as any}
      isAuthenticated={isAuthenticated}
      unreadNotifications={unreadNotifications}
      unreadMessages={unreadMessages}
    >
      {!loadingProfile && !profile ? (
        // Profile Not Found State
        <div className="container min-h-screen mx-auto py-16 px-4 text-center">
          <div className="max-w-md mx-auto">
            <div className="mb-8">
              <User className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <h1 className="text-2xl font-bold mb-2">User Not Found</h1>
              <p className="text-muted-foreground">
                The user profile you're looking for doesn't exist or hasn't been created yet.
              </p>
            </div>
            <Button onClick={() => navigate('/')}>
              Back to Home
            </Button>
          </div>
        </div>
      ) : (
        <div className="w-full overflow-x-hidden pb-16 md:pb-0">
          <div>
            {/* Profile header with skeleton loader */}
            <Card className="rounded-lg overflow-hidden mb-8">
              <div className="p-6 flex flex-col gap-4">
                {loadingProfile ? (
                  <div className="flex flex-col md:flex-row gap-6">
                    <Skeleton className="h-24 w-24 rounded-full" />
                    <div className="flex-1 space-y-4">
                      <Skeleton className="h-8 w-1/3" />
                      <Skeleton className="h-4 w-2/3" />
                      <div className="flex gap-4">
                        <Skeleton className="h-10 w-24" />
                        <Skeleton className="h-10 w-24" />
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        // Check if we can go back in history
                        if (window.history.length > 1) {
                          // Get the previous URL
                          const previousUrl = document.referrer;
                          // Only go back if the previous URL is from our app
                          if (previousUrl && previousUrl.includes(window.location.origin)) {
                            window.history.back();
                          } else {
                            navigate('/discover');
                          }
                        } else {
                          navigate('/discover');
                        }
                      }}
                      className="w-fit mb-4"
                    >
                      <ArrowLeft className="h-4 w-4 mr-2" />
                      Back
                    </Button>

                    <div className="flex flex-col sm:flex-row gap-6">
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
                          {!isOwnProfile && (
                            <>
                              <Button
                                variant={isFollowing ? "secondary" : "default"}
                                size="sm"
                                className="flex w-fit items-center gap-2"
                                onClick={handleFollow}
                                disabled={loadingFollowStatus}
                              >
                                <Users className="h-4 w-4" />
                                {isFollowing ? 'Following' : 'Follow'}
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                className="flex w-fit items-center gap-2"
                                onClick={handleMessage}
                              >
                                <MessageSquare className="h-4 w-4" />
                                Message
                              </Button>
                              
                            </>
                            
                          )}
                          <Button
                                variant="outline"
                                size="sm"
                                className="flex w-fit items-center gap-2"
                                onClick={handleShareProfile}
                              >
                                <Share2 className="h-4 w-4" />
                                Share
                              </Button>
                        </div>
                      </div>
                    </div>

                    {/* Stats row */}
                    <div className="flex flex-row flex-wrap justify-around mt-4 pt-4 ">
                      <div
                        className="text-center cursor-pointer bg-background px-12 py-4 rounded-md transition-colors"
                        onClick={handlePostsClick}
                      >
                        <p className="font-semibold">{userPosts.length}</p>
                        <p className="dark:text-white text-dark text-sm">Posts</p>
                      </div>

                      <div
                        className="text-center cursor-pointer bg-background px-8 py-4 rounded-md transition-colors"
                        onClick={() => setShowFollowersModal(true)}
                      >
                        <p className="font-semibold">{profile?.followers_count || 0}</p>
                        <p className="dark:text-white text-dark text-sm">Followers</p>
                      </div>

                      <div
                        className="text-center cursor-pointer bg-background px-8 py-4 rounded-md transition-colors"
                        onClick={() => setShowFollowingModal(true)}
                      >
                        <p className="font-semibold">{profile?.following_count || 0}</p>
                        <p className="dark:text-white text-dark text-sm">Following</p>
                      </div>

                      {profile?.user_role === "business" && (
                        <div
                          className="text-center cursor-pointer bg-background px-6 py-4 rounded-md transition-colors"
                          onClick={handleOpenReviewsModal}
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
                              ? `Rating (${profile?.reviews_count || 0})`
                              : 'No reviews yet'}
                          </p>
                        </div>
                      )}
                    </div>

                    {/* About Business Section - Only for business accounts */}
                    {profile?.user_role === "business" && profile?.about_business && (
                      <div className="mt-4 pt-4">
                        <h3 className="text-lg font-semibold mb-2">About the Business</h3>
                        <AboutBusinessSection content={profile.about_business} />
                      </div>
                    )}
                  </>
                )}
              </div>
            </Card>

            {/* Tabs for Posts and Services */}
            <Tabs value={activeProfileTab} onValueChange={setActiveProfileTab}>
              <TabsList className="mb-6">
                <TabsTrigger value="posts">Posts</TabsTrigger>
                {profile?.user_role === "business" ? (
                  <TabsTrigger value="services">Services</TabsTrigger>
                ) : (
                  profile?.id === currentUser && (
                    <TabsTrigger value="bookings">Bookings</TabsTrigger>
                  )
                )}
              </TabsList>

              <TabsContent value="posts" className="pb-4">
                <div ref={postsTabRef} className="mb-4 flex justify-between items-center">
                  <h2 className="text-xl font-semibold"></h2>
                </div>
                <div className="grid gap-4 md:gap-6 max-w-4xl mx-auto">
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
                      <div
                        key={post.id}
                        ref={el => postRefs.current[post.id] = el}
                        className={`transition-all duration-300 ${params.postId === post.id ? '' : ''
                          }`}
                      >
                        <Post
                          {...post}
                          profiles={post.profiles}
                          currentUserId={async () => currentUser}
                          isAuthenticated={isAuthenticated}
                        />
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8">
                      <Card className="p-8 text-center">
                        <p className="mb-4">No posts yet</p>
                      </Card>
                    </div>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="services" className="mt-0">
                <div className="mb-4">
                  {/* No Add Service button for other users' profiles */}
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
                          image: service.image || null,
                          owner_id: service.owner_id,
                          ratings_count: service.ratings_count || 0,
                          ratings_sum: service.ratings_sum || 0
                        }}
                        showOptions={service.owner_id === currentUser}
                        onDelete={() => handleDeleteService(service.id, service.title)}
                        refreshServices={fetchUserServices}
                      />
                    ))
                  ) : (
                    <div className="col-span-full text-center py-8">
                      <Card className="p-8 text-center">
                        <p className="mb-4">No services listed yet</p>
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
                      // Bookings skeleton
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
                                    <p>Provider: {booking.providers.username}</p>
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
                                  onClick={() => handleCancelBooking(booking.id)}
                                >
                                  Cancel Booking
                                </Button>
                              )}
                              <Button
                                variant="default"
                                size="sm"
                                onClick={() => navigate(`/messages?user=${booking.provider_id}`)}
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

            {/* Modals */}
            <AuthRequiredModal
              isOpen={showAuthModal}
              setIsOpen={setShowAuthModal}
              message="You need to sign in to interact with this profile."
            />

            {profile && (
              <>
                <FollowersModal
                  userId={profile.id}
                  isOpen={showFollowersModal}
                  onClose={() => setShowFollowersModal(false)}
                  currentUserId={currentUser}
                  onFollowersLoaded={updateFollowersCount}
                />

                <FollowingModal
                  userId={profile.id}
                  isOpen={showFollowingModal}
                  onClose={() => setShowFollowingModal(false)}
                  currentUserId={currentUser}
                  onFollowingLoaded={updateFollowingCount}
                />
              </>
            )}
          </div>
        </div>
      )}

      {selectedService && (
        <ServiceModal
          service={selectedService}
          isOpen={showServiceModal}
          onClose={() => setShowServiceModal(false)}
        />
      )}

      {profile && (
        <>
          <ReviewsModal
            isOpen={showReviewsModal}
            onClose={() => setShowReviewsModal(false)}
            userId={profile.id}
            currentUserId={currentUser}
          />
        </>
      )}

      {/* Delete Service Confirmation Modal */}
      <DeleteServiceModal
        isOpen={showDeleteServiceModal}
        onClose={() => setShowDeleteServiceModal(false)}
        onConfirm={confirmDeleteService}
        serviceTitle={serviceDeleteTitle}
      />
    </MainLayout>
  );
}
