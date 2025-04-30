import { useState, useEffect, useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { Sidebar } from "@/components/home/Sidebar";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { Post } from "@/components/home/Post";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { MainLayout } from "@/layouts/MainLayout";
import { LoadingScreen } from "@/components/ui/loading-screen";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { SearchUsers } from "@/components/home/SearchUsers";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { MapPin, DollarSign, Clock, Star, HeartIcon } from "lucide-react";
import { useCurrency } from "@/contexts/CurrencyContext";

interface Post {
  id: string;
  image_url: string;
  caption: string | null;
  created_at: string;
  user_id: string;
  profiles: {
    id: string;
    username: string | null;
    avatar_url: string | null;
  };
}

interface Service {
  id: string;
  title: string;
  description: string;
  category: string;
  price: number;
  image?: string;
  location: string;
  duration_minutes: number;
  owner_id: string;
  created_at: string;
  ratings_count?: number;
  ratings_sum?: number;
  profiles?: {
    username: string | null;
    avatar_url: string | null;
  };
}

export default function Discover() {
  const [activeTab, setActiveTab] = useState("Discover");
  const [discoverTab, setDiscoverTab] = useState("posts"); // "posts" or "services"
  const [posts, setPosts] = useState<Post[]>([]);
  const [services, setServices] = useState<Service[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingServices, setLoadingServices] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [userRole, setUserRole] = useState<"business" | "customer" | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showPostModal, setShowPostModal] = useState(false);
  const [selectedPostIndex, setSelectedPostIndex] = useState(0);
  const { toast } = useToast();
  const navigate = useNavigate();
  const [filteredPosts, setFilteredPosts] = useState<Post[]>([]);
  const [filteredServices, setFilteredServices] = useState<Service[]>([]);
  const location = useLocation();
  const { formatPrice } = useCurrency();

  // Add a ref for the scroll area
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    checkAuthAndFetchUserRole();
  }, []);
  
  // Handle URL search parameters
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    
    // Check for tab parameter
    const tabParam = params.get('tab');
    if (tabParam === 'services' || tabParam === 'posts') {
      setDiscoverTab(tabParam);
    }
    
    // Check for search parameter
    const searchParam = params.get('search');
    if (searchParam) {
      setSearchQuery(searchParam);
    }
  }, [location.search]);

  // Extract and apply search query from URL parameters
  useEffect(() => {
    if (searchQuery && services.length > 0) {
      // If there's a search query and it matches services better than posts,
      // automatically switch to services tab
      const query = searchQuery.toLowerCase();
      const matchingServices = services.filter(s => 
        (s.title && s.title.toLowerCase().includes(query)) ||
        (s.category && s.category.toLowerCase().includes(query))
      );
      
      if (matchingServices.length > 0 && discoverTab !== 'services') {
        setDiscoverTab('services');
      }
    }
  }, [searchQuery, services, discoverTab]);

  const checkAuthAndFetchUserRole = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsAuthenticated(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')  // Select all columns to avoid specific column errors
          .eq('id', session.user.id)
          .single();
          
        if (!error && data) {
          // Check if user_role exists in the data
          if ('user_role' in data) {
            setUserRole(data.user_role as "business" | "customer");
          } else {
            // Default to customer if no role specified
            setUserRole("customer");
            console.warn("user_role field not found in profiles table");
          }
        }
      } else {
        setIsAuthenticated(false);
      }
      
      setInitialLoading(false);
      fetchPosts();
      fetchServices();
    } catch (error) {
      console.error("Error checking auth:", error);
      setInitialLoading(false);
      fetchPosts();
      fetchServices();
    }
  };

  const fetchPosts = async () => {
    try {
      setLoadingPosts(true);
      
      const { data, error } = await supabase
        .from('posts')
        .select(`
          *,
          profiles (
            id,
            username,
            avatar_url
          )
        `)
        .order('created_at', { ascending: false })
        .limit(24);
        
      if (error) throw error;
      
      if (data) {
        // Add a small delay to make loading more obvious for better UX
        setTimeout(() => {
          setPosts(data);
          setFilteredPosts(data);
          setLoadingPosts(false);
        }, 300);
      }
    } catch (error) {
      console.error("Error fetching posts:", error);
      setLoadingPosts(false);
    }
  };

  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      const { data, error } = await supabase
        .from("services")
        .select("*, profiles!owner_id(username, avatar_url)")
        .order("created_at", { ascending: false })
        .limit(24);

      if (error) throw error;
      
      setTimeout(() => {
        setServices(data || []);
        setFilteredServices(data || []);
        setLoadingServices(false);
      }, 300);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to load services. Please try again.",
        variant: "destructive",
      });
      setLoadingServices(false);
    }
  };

  useEffect(() => {
    if (posts.length > 0 || services.length > 0) {
      filterContent();
    }
  }, [searchQuery, posts, services, discoverTab]);

  const filterContent = () => {
    // Apply filtering based on active tab
    if (discoverTab === "posts") {
      if (!searchQuery.trim()) {
        setFilteredPosts(posts);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = posts.filter(
          post => 
            (post.caption && post.caption.toLowerCase().includes(query)) ||
            (post.profiles?.username && post.profiles.username.toLowerCase().includes(query))
        );
        setFilteredPosts(filtered);
      }
    } else {
      if (!searchQuery.trim()) {
        setFilteredServices(services);
      } else {
        const query = searchQuery.toLowerCase();
        const filtered = services.filter(
          service => 
            (service.title && service.title.toLowerCase().includes(query)) ||
            (service.description && service.description.toLowerCase().includes(query)) ||
            (service.category && service.category.toLowerCase().includes(query)) ||
            (service.profiles?.username && service.profiles.username.toLowerCase().includes(query))
        );
        setFilteredServices(filtered);
      }
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleCardClick = (post: Post, index: number) => {
    setSelectedPostIndex(index);
    setShowPostModal(true);
  };

  const handleUserClick = (userId: string, username: string | null) => {
    if (username) {
      navigate(`/@${username}`);
    } else {
      // Fallback to user ID if username is not available
      navigate(`/user/${userId}`);
    }
  };

  const getPostPreviewContent = (post: Post) => {
    try {
      const { image_url, caption } = post;
      
      // If there's no image_url, it's definitely a text post
      if (!image_url) {
        return { type: 'text', content: caption || 'No caption' };
      }
      
      // Check if the image_url is a stringified array
      if (image_url.startsWith('[') && image_url.endsWith(']')) {
        try {
          const images = JSON.parse(image_url);
          if (Array.isArray(images) && images.length > 0 && typeof images[0] === 'string' && images[0].trim() !== '') {
            // Filter out empty strings and use the first valid URL
            const validImages = images.filter(url => url && url.trim() !== '');
            if (validImages.length > 0) {
              return { type: 'image', url: validImages[0] };
            }
          }
        } catch (e) {
          console.log('Error parsing JSON image array:', e);
        }
      }
      
      // Check if it's a direct image URL (starts with http and common image extensions)
      if (image_url.startsWith('http') || image_url.startsWith('https')) {
        // Check for common image extensions
        if (
          image_url.toLowerCase().endsWith('.jpg') ||
          image_url.toLowerCase().endsWith('.jpeg') ||
          image_url.toLowerCase().endsWith('.png') ||
          image_url.toLowerCase().endsWith('.gif') ||
          image_url.toLowerCase().endsWith('.webp') ||
          image_url.toLowerCase().endsWith('.avif') ||
          // Or check for storage URLs which likely contain images
          image_url.includes('supabase.co/storage') ||
          image_url.includes('amazonaws.com') ||
          image_url.includes('cloudinary.com') ||
          image_url.includes('googleusercontent.com')
        ) {
          return { type: 'image', url: image_url };
        }
      }
      
      // Check if it's a data URL (encoded image)
      if (image_url.startsWith('data:image/')) {
        return { type: 'image', url: image_url };
      }
      
      // If image_url equals caption exactly, it's more likely a text post
      if (image_url === caption) {
        return { type: 'text', content: caption || 'No caption' };
      }
      
      // If image_url contains a URL-like structure
      if (image_url.includes('://') || image_url.includes('.com/') || image_url.includes('.net/')) {
        return { type: 'image', url: image_url };
      }
      
      // If we can't determine for sure, default to text post
      return { type: 'text', content: caption || 'No caption' };
    } catch (e) {
      // If any error occurs, default to text post
      console.error('Error processing post preview:', e);
      return { type: 'text', content: post.caption || 'No caption' };
    }
  };

  const handleLike = async (postId: string) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Actual like logic would go here
  };

  const handleComment = async (postId: string, comment: string) => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Actual comment logic would go here
  };

  const handleShare = () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }
    
    // Actual share logic would go here
  };

  const isTextPost = (post: Post) => {
    const preview = getPostPreviewContent(post);
    return preview.type === 'text';
  };

  const handleOpenService = (serviceId: string) => {
    navigate(`/services/${serviceId}`);
  };

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} isAuthenticated={isAuthenticated}>
      {initialLoading ? (
        // Page-specific loading screen
        <div className="flex-1 min-h-screen flex flex-col">
          <div className="max-w-7xl mx-auto w-full flex-1 pt-4 pb-20">
            <div className="flex flex-col gap-6">
              <div className="flex-1 flex flex-col gap-6">
                {/* Search skeleton */}
                <div className="w-full h-16 bg-black/20 rounded-lg animate-pulse" />
                
                {/* Grid skeletons */}
                <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-4">
                  {Array(12).fill(0).map((_, i) => (
                    <div key={i} className="aspect-square bg-black/20 rounded-lg animate-pulse" />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div>
          <div className="flex flex-col gap-4">
            <div className="flex-1">
              <div className="relative mb-4">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40 w-5 h-5" />
                  <Input
                    placeholder={discoverTab === "posts" ? "Search posts and users..." : "Search services..."}
                    value={searchQuery}
                    onChange={handleSearch}
                    className="pl-10 bg-black/20 w-full"
                  />
                </div>
                {discoverTab === "posts" && (
                  <SearchUsers 
                    searchQuery={searchQuery} 
                    show={searchQuery.length > 0} 
                    onClose={() => setSearchQuery('')} 
                  />
                )}
              </div>

              <Tabs 
                value={discoverTab} 
                onValueChange={(value) => {
                  setDiscoverTab(value);
                  // Update URL without reloading page
                  const newUrl = new URL(window.location.href);
                  newUrl.searchParams.set('tab', value);
                  window.history.pushState({}, '', newUrl);
                }} 
                className="mb-6"
              >
                <TabsList className="w-fit grid grid-cols-2">
                  <TabsTrigger value="posts" className="px-8">Discover Posts</TabsTrigger>
                  <TabsTrigger value="services" className="px-8">Discover Services</TabsTrigger>
                </TabsList>

                <TabsContent value="posts" className="pt-4">
                  <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-1 xs:gap-3 md:gap-4 lg:gap-6 xs:px-0">
                    {loadingPosts ? (
                      // Post loading skeletons
                      Array(9).fill(0).map((_, i) => (
                        <Skeleton key={i} className="aspect-square bg-black/20 rounded-lg" />
                      ))
                    ) : filteredPosts.length === 0 ? (
                      <div className="col-span-full text-center py-12">
                        <p className="text-muted-foreground">No posts found matching your search.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => setSearchQuery('')}
                        >
                          Clear search
                        </Button>
                      </div>
                    ) : (
                      filteredPosts.map((post, index) => {
                        const preview = getPostPreviewContent(post);
                        return (
                          <Card
                            key={post.id}
                            className={`group overflow-hidden bg-white dark:bg-black/20 border border-border hover:border-primary/20 dark:hover:border-white/20 transition-all cursor-pointer ${
                              isTextPost(post) ? 'text-card aspect-auto min-h-[200px]' : 'aspect-square'
                            }`}
                            onClick={() => handleCardClick(post, index)}
                          >
                            <CardContent className="p-0 h-full flex flex-col">
                              {/* Media content or text preview */}
                              {preview.type === 'image' ? (
                                <div className="relative flex-1 bg-background dark:bg-black/40 group-hover:brightness-110 transition-all">
                                  <img
                                    src={preview.url}
                                    alt="Post"
                                    className="w-full h-full object-cover"
                                    loading="lazy"
                                  />
                                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                                </div>
                              ) : (
                                <div className="relative flex-1 p-4 flex items-center justify-center bg-background dark:bg-gradient-to-br dark:from-gray-900 dark:to-black">
                                  <p className="text-lg font-medium line-clamp-4 text-black dark:text-white text-center">
                                    {preview.content}
                                  </p>
                                </div>
                              )}
                              
                              {/* User info - only show on larger screens */}
                              <div className="hidden xs:flex p-3 items-center text-white gap-2 bg-black/40 group-hover:bg-black/60 transition-colors">
                                <Avatar className="h-6 w-6">
                                  <AvatarImage src={post.profiles.avatar_url || ""} />
                                  <AvatarFallback className="text-xs">
                                    {post.profiles.username?.[0]?.toUpperCase() || "U"}
                                  </AvatarFallback>
                                </Avatar>
                                <span className="text-sm font-medium truncate">
                                  {post.profiles.username || "User"}
                                </span>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })
                    )}
                  </div>
                </TabsContent>

                <TabsContent value="services" className="pt-4">
                  <div className="grid grid-cols-2 xs:grid-cols-2 sm:grid-cols-3 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-1 xs:gap-3 md:gap-4 lg:gap-6">
                    {loadingServices ? (
                      Array(6).fill(0).map((_, index) => (
                        <Card key={index} className="overflow-hidden animate-pulse">
                          <div className="h-48 bg-black/50"></div>
                          <CardContent className="p-4">
                            <div className="h-6 bg-black/80 rounded w-3/4 mb-2"></div>
                            <div className="h-4 bg-black/20 rounded w-1/2 mb-4"></div>
                            <div className="h-4 bg-black/20 rounded w-full mb-2"></div>
                            <div className="h-4 bg-black/20 rounded w-full"></div>
                          </CardContent>
                        </Card>
                      ))
                    ) : filteredServices.length === 0 ? (
                      <div className="col-span-full text-center py-12">
                        <p className="text-muted-foreground">No services found matching your search.</p>
                        <Button 
                          variant="outline" 
                          className="mt-4"
                          onClick={() => setSearchQuery('')}
                        >
                          Clear search
                        </Button>
                      </div>
                    ) : (
                      filteredServices.map(service => (
                        <Card key={service.id} className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer" onClick={() => handleOpenService(service.id)}>
                          <div className="relative h-48 overflow-hidden">
                            {service.image ? (
                              <img 
                                src={service.image} 
                                alt={service.title} 
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <div className="w-full h-full bg-muted flex items-center justify-center">
                                <span className="text-2xl font-bold text-muted-foreground">
                                  {service.title.charAt(0).toUpperCase()}
                                </span>
                              </div>
                            )}
                            <Badge className="absolute top-2 right-2">{service.category}</Badge>
                          </div>
                          <CardContent className="p-4">
                            <div className="flex flex-col xs:flex-row xs:items-start xs:justify-between mb-2">
                              <h3 className="font-semibold text-lg mb-1 xs:mb-0">{service.title}</h3>
                              <span className="font-medium text-primary whitespace-nowrap">{formatPrice(service.price, 'USD')}</span>
                            </div>
                            <p className="text-sm text-muted-foreground line-clamp-2 mb-4">
                              {service.description}
                            </p>
                            <div className="flex items-center justify-between text-sm">
                              <div className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                <span className="truncate max-w-[80px] xs:max-w-[120px]">{service.location? service.location: `No location`}</span>
                              </div>
                              <div className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                
                                {service.duration_minutes?<span>
                                  {service.duration_minutes < 60
                                    ? `${service.duration_minutes||''}m`
                                    : `${Math.floor(service.duration_minutes / 60)}h${
                                        service.duration_minutes % 60 ? ` ${service.duration_minutes % 60}m` : ""
                                      }`}
                                </span>:<span>No time was set</span>}
                              </div>
                            </div>
                          </CardContent>
                          <div className="py-3 px-4 bg-muted/20 flex items-center justify-between">
                            <div 
                              className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                              onClick={(e) => {
                                e.stopPropagation(); // Prevent triggering service card click
                                handleUserClick(service.owner_id, service.profiles?.username)
                              }}
                            >
                              <div className="h-6 w-6 rounded-full bg-muted overflow-hidden">
                                {service.profiles?.avatar_url ? (
                                  <img 
                                    src={service.profiles.avatar_url} 
                                    alt={service.profiles.username} 
                                    className="h-full w-full object-cover"
                                  />
                                ) : (
                                  <div className="h-full w-full flex items-center justify-center bg-primary/10 text-primary font-medium text-xs">
                                    {service.profiles?.username?.charAt(0).toUpperCase() || "?"}
                                  </div>
                                )}
                              </div>
                              <span className="text-xs">{service.profiles?.username || "Anonymous"}</span>
                            </div>
                            {service.ratings_count > 0 && (
                              <div className="flex items-center gap-1">
                                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                                <span className="text-xs">
                                  {(service.ratings_sum / service.ratings_count).toFixed(1)}
                                </span>
                              </div>
                            )}
                          </div>
                        </Card>
                      ))
                    )}
                  </div>
                </TabsContent>
              </Tabs>
            </div>
          </div>
        </div>
      )}

      {/* Post Modal */}
      <Dialog open={showPostModal} onOpenChange={setShowPostModal}>
        <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden p-0">
          <ScrollArea className="max-h-[90vh]" ref={scrollAreaRef}>
            {posts.length > 0 && selectedPostIndex < posts.length && (
              <div className="p-4">
                <Post
                  id={posts[selectedPostIndex].id}
                  user_id={posts[selectedPostIndex].user_id}
                  image_url={posts[selectedPostIndex].image_url}
                  caption={posts[selectedPostIndex].caption}
                  created_at={posts[selectedPostIndex].created_at}
                  profiles={posts[selectedPostIndex].profiles}
                  onLike={handleLike ? () => handleLike(posts[selectedPostIndex].id) : undefined}
                  onComment={handleComment}
                  onShare={handleShare}
                  isAuthenticated={isAuthenticated}
                  showDetailOnClick={false}
                />
                
                <div className="mt-8 border-t border-white/10 pt-6">
                  <h3 className="text-lg font-medium mb-4">More Posts</h3>
                  <div className="grid grid-cols-2 gap-1 px-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 xs:gap-3 md:gap-4 lg:gap-6 xs:px-0">
                    {posts.filter((_, i) => i !== selectedPostIndex).slice(0, 9).map((post, i) => {
                      const preview = getPostPreviewContent(post);
                      return (
                        <Card
                          key={post.id}
                          className={`group overflow-hidden bg-white dark:bg-black/20 border border-border hover:border-primary/20 dark:hover:border-white/20 transition-all cursor-pointer ${
                            isTextPost(post) ? 'text-card aspect-auto min-h-[120px]' : 'aspect-square'
                          }`}
                          onClick={() => {
                            setSelectedPostIndex(posts.findIndex(p => p.id === post.id));
                            // Scroll to top when clicking another post
                            if (scrollAreaRef.current) {
                              const viewportElement = scrollAreaRef.current.querySelector('[data-radix-scroll-area-viewport]');
                              if (viewportElement) {
                                // Force a scroll to top with a slight delay to ensure state updates
                                setTimeout(() => {
                                  viewportElement.scrollTop = 0;
                                }, 50);
                              }
                            }
                          }}
                        >
                          <CardContent className="p-0 h-full flex flex-col">
                            {/* Media content or text preview */}
                            {preview.type === 'image' ? (
                              <div className="relative flex-1 bg-background dark:bg-black/40 group-hover:brightness-110 transition-all">
                                <img
                                  src={preview.url}
                                  alt="Post"
                                  className="w-full h-full object-cover"
                                  loading="lazy"
                                />
                              </div>
                            ) : (
                              <div className="flex-1 p-4 flex items-center justify-center bg-background dark:bg-gradient-to-br dark:from-gray-900 dark:to-black">
                                  <p className="text-sm font-small truncate text-black dark:text-white line-clamp-4 text-center">
                                    {preview.content}
                                  </p>
                                </div>
                            )}
                          </CardContent>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Auth Required Modal */}
      <AuthRequiredModal 
        isOpen={showAuthModal} 
        setIsOpen={setShowAuthModal} 
        message="You need to sign in to interact with posts"
      />
    </MainLayout>
  );
}
