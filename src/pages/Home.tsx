import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Post } from "@/components/home/Post";
import { MobileHeader } from "@/components/home/MobileHeader";
import { CreatePost } from "@/components/home/CreatePost";
import { TrendingServices } from "@/components/home/TrendingServices";
import { supabase } from "@/integrations/supabase/client";
import type { Profile as ProfileType, Post as PostType } from "@/types";
import { syncUserProfile } from '@/utils/auth';
import { MainLayout } from "@/layouts/MainLayout";
import { Loader2, RefreshCw } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { getRecommendedPosts, calculateBaseScore } from "@/utils/post-ranking";
import { fetchActivePromotedPosts, recordImpression } from "@/services/promotedPosts";

// Define PromotedPost interface locally since it's not yet exported from types
interface PromotedPostType {
  id: string;
  post_id: string;
  user_id: string;
  promotion_level: 'basic' | 'premium' | 'featured';
  starts_at: string;
  ends_at: string;
  target_audience?: string | null;
  budget?: number | null;
  impressions?: number;
  clicks?: number;
  created_at: string;
  post?: PostType;
}

// Define interface for post with score and promotion info
interface ScoredPost extends PostType {
  score?: number;
  isPromoted?: boolean;
  promotionLevel?: 'basic' | 'premium' | 'featured';
  promotedPostId?: string;
}

// Interface for storing user interactions with posts
interface UserInteraction {
  userId: string;
  postId: string;
  type: 'like' | 'comment' | 'view';
  timestamp: string;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("Home");
  const [posts, setPosts] = useState<ScoredPost[]>([]);
  const [randomPosts, setRandomPosts] = useState<ScoredPost[]>([]);
  const [profiles, setProfiles] = useState<ProfileType[]>([]);
  const [user, setUser] = useState<{ id: string } | null>(null);
  const [userRole, setUserRole] = useState<"business" | "customer" | null>(null);
  const navigate = useNavigate();
  const [initialLoading, setInitialLoading] = useState(true);
  const [loadingPosts, setLoadingPosts] = useState(true);
  const [loadingRandomPosts, setLoadingRandomPosts] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadingMoreRandom, setLoadingMoreRandom] = useState(false);
  const [hasMorePosts, setHasMorePosts] = useState(true);
  const [hasMoreRandomPosts, setHasMoreRandomPosts] = useState(true);
  const [allRecentPostsViewed, setAllRecentPostsViewed] = useState(false);
  const [page, setPage] = useState(1);
  const [randomPage, setRandomPage] = useState(1);
  const [followedUserIds, setFollowedUserIds] = useState<string[]>([]);
  const [hasFollowedPosts, setHasFollowedPosts] = useState(false);
  const postsPerPage = 5;
  const randomPostsPerPage = 7; // Separate constant for random posts loading
  
  // Store likes and comments per post for scoring
  const [likesCountMap, setLikesCountMap] = useState<Record<string, number>>({});
  const [commentsCountMap, setCommentsCountMap] = useState<Record<string, number>>({});
  
  // Store user interactions for personalization
  const [userInteractions, setUserInteractions] = useState<UserInteraction[]>([]);
  
  // Store active promotions
  const [promotedPosts, setPromotedPosts] = useState<PromotedPostType[]>([]);
  
  // Add this line:
  const postsAlreadyLoaded = useRef(false);

  // Check authentication first
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session) {
          navigate('/auth');
          return;
        }
        
        // Set user data
        const { data: userData } = await supabase.auth.getUser();
        setUser(userData.user);
        
        // Sync user profile data with auth metadata
        await syncUserProfile();
        
        // Get user role
        if (userData.user) {
          try {
            const { data, error } = await supabase
              .from('profiles')
              .select('*')  // Select all columns to avoid errors with specific column names
              .eq('id', userData.user.id)
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
          } catch (error) {
            console.error("Error fetching user role:", error);
            // Default to customer role
            setUserRole("customer");
          }
        }
        
        // Mark as initial loading complete
        setInitialLoading(false);
      } catch (error) {
        console.error('Error checking auth:', error);
        navigate('/auth');
      }
    };
    
    checkAuth();
  }, [navigate]);

  // Second phase: fetch followed users, promoted posts, and initial posts
  useEffect(() => {
    // Skip if still in initial loading or no user
    if (initialLoading || !user) return;
    
    const fetchInitialData = async () => {
      try {
        console.log("Fetching initial data for Home page...");
        
        // Fetch active promoted posts
        const promotions = await fetchActivePromotedPosts();
        setPromotedPosts(promotions);
        
        // Get users that the current user follows
        try {
          // Use the Supabase URL and key directly
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
          
          console.log("Fetching follows for user ID:", user.id);
          
          const response = await fetch(
            `${supabaseUrl}/rest/v1/follows?follower_id=eq.${user.id}&select=following_id`,
            { headers }
          );
          
          if (!response.ok) {
            console.error("Error fetching follows:", response.statusText);
            // Continue with empty follows - show default posts
            setFollowedUserIds([user.id]);
            return;
          }
          
          const followsData = await response.json();
          console.log("Follows data:", followsData);
          
          // Create a list of following IDs including the current user
          let followingIds: string[] = [];
          
          if (followsData && followsData.length > 0) {
            followingIds = followsData.map(f => f.following_id);
          }
          
          // Always include current user's posts in the feed
          if (user.id && !followingIds.includes(user.id)) {
            followingIds.push(user.id);
            console.log("Adding current user to followed list:", user.id);
          }
          
          setFollowedUserIds(followingIds);
        } catch (err) {
          console.error("Error in follows query:", err);
          setFollowedUserIds([user.id]);
        }
      } catch (error) {
        console.error("Error in fetchInitialData:", error);
        setLoadingPosts(false);
        setLoadingRandomPosts(false);
      }
    };
    
    fetchInitialData();
  }, [initialLoading, user]);

  // New effect to load posts when followedUserIds changes
  useEffect(() => {
    const loadPosts = async () => {
      if (!user || followedUserIds.length === 0) return;
      
      // Skip loading if posts are already loaded (prevents reload loops)
      if (postsAlreadyLoaded.current && !loadingPosts) return;
      
      try {
        // Fetch user interactions for personalization
        await fetchUserInteractions(user.id);
        
        // Fetch likes and comments counts for each post
        await fetchEngagementCounts();
        
        // Fetch posts from followed users with ranking
        const result = await fetchPostsWithRanking(followedUserIds);
        
        // Fetch random posts for discovery section after main posts are loaded
        // This ensures we can exclude the main feed posts - use the posts from the result
        // not the state since the state might not be updated yet
        const mainFeedPostIds = result.posts.map(post => post.id);
        await fetchRandomPostsWithExclusions(mainFeedPostIds);
        
        // Mark posts as loaded
        postsAlreadyLoaded.current = true;
      } catch (error) {
        console.error("Error loading posts:", error);
        setLoadingPosts(false);
      }
    };
    
    loadPosts();
  }, [followedUserIds, user]);

  // Fetch user interactions for personalization
  const fetchUserInteractions = async (userId: string) => {
    try {
      // Fetch recent likes
      const { data: likes, error: likesError } = await supabase
        .from('likes')
        .select('post_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (likesError) throw likesError;
      
      // Fetch recent comments
      const { data: comments, error: commentsError } = await supabase
        .from('comments')
        .select('post_id, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100);
        
      if (commentsError) throw commentsError;
      
      // Convert to UserInteraction format
      const interactions: UserInteraction[] = [
        ...likes.map(like => ({
          userId,
          postId: like.post_id,
          type: 'like' as const,
          timestamp: like.created_at
        })),
        ...comments.map(comment => ({
          userId,
          postId: comment.post_id,
          type: 'comment' as const,
          timestamp: comment.created_at
        }))
      ];
      
      setUserInteractions(interactions);
    } catch (error) {
      console.error("Error fetching user interactions:", error);
    }
  };
  
  // Fetch engagement counts for ranking
  const fetchEngagementCounts = async () => {
    try {
      // Use an alternative approach to fetch like counts
      const { data: posts, error: postsError } = await supabase
        .from('posts')
        .select('id');
      
      if (postsError) throw postsError;
      
      // If we have posts, create an empty likes map
      if (posts && posts.length > 0) {
        const likesMap: Record<string, number> = {};
        const commentsMap: Record<string, number> = {};
        
        // Initialize with zero counts
        posts.forEach(post => {
          likesMap[post.id] = 0;
          commentsMap[post.id] = 0;
        });
        
        // Fetch all likes
        const { data: allLikes, error: likesError } = await supabase
          .from('likes')
          .select('post_id');
          
        if (likesError) throw likesError;
        
        // Count likes per post
        if (allLikes) {
          allLikes.forEach(like => {
            if (likesMap[like.post_id] !== undefined) {
              likesMap[like.post_id]++;
            }
          });
        }
        
        setLikesCountMap(likesMap);
        
        // Fetch all comments
        const { data: allComments, error: commentsError } = await supabase
          .from('comments')
          .select('post_id');
          
        if (commentsError) throw commentsError;
        
        // Count comments per post
        if (allComments) {
          allComments.forEach(comment => {
            if (commentsMap[comment.post_id] !== undefined) {
              commentsMap[comment.post_id]++;
            }
          });
        }
        
        setCommentsCountMap(commentsMap);
      }
    } catch (error) {
      console.error("Error fetching engagement counts:", error);
    }
  };

  const fetchPostsWithRanking = async (userIds: string[], pageNum: number = 1, isLoadMore = false) => {
    // No need to add current user ID here anymore as we've already included it in the userIds list
    const idsToFetch = [...userIds];
    
    if (idsToFetch.length === 0) {
      setLoadingPosts(false);
      setHasFollowedPosts(false);
      return { hasAnyPosts: false, posts: [] };
    }
    
    console.log("Fetching posts for users:", idsToFetch);
    
    try {
      if (isLoadMore) {
        setLoadingMore(true);
      } else {
        setLoadingPosts(true);
      }
      
      // Calculate pagination limits
      const from = (pageNum - 1) * postsPerPage;
      const to = from + postsPerPage - 1;
      
      // Fetch posts from followed users and current user
      const { data: postsData, error: postsError } = await supabase
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
            reviews_rating,
            user_role,
            kyc_verified
          )
        `)
        .in('user_id', idsToFetch)
        .order('created_at', { ascending: false })
        .range(from, to);

      if (postsError) {
        console.error("Error fetching posts:", postsError);
        setLoadingPosts(false);
        setLoadingMore(false);
        setHasFollowedPosts(false);
        return { hasAnyPosts: false, posts: [] };
      }

      if (postsData) {
        // If we got fewer posts than the limit, there are no more posts
        if (postsData.length < postsPerPage) {
          setHasMorePosts(false);
          
          // Only set all posts viewed if we've loaded at least one page
          if (pageNum > 1 || postsData.length === 0) {
            setAllRecentPostsViewed(true);
          }
        } else {
          setHasMorePosts(true);
        }
        
        // Calculate scores for each post
        const scoredPosts: ScoredPost[] = postsData.map(post => {
          const score = calculateBaseScore(
            post, 
            likesCountMap[post.id] || 0, 
            commentsCountMap[post.id] || 0,
            userInteractions
          );
          
          return {
            ...post,
            score
          };
        });
        
        // Apply promotion boosts if available
        const postsWithPromotion = addPromotionInfo(scoredPosts, promotedPosts);
        
        // Sort by score (highest first)
        const sortedPosts = postsWithPromotion.sort((a, b) => {
          // First, prioritize promoted posts by level
          if (a.isPromoted && b.isPromoted) {
            const levelOrder = { featured: 3, premium: 2, basic: 1 };
            const aLevel = a.promotionLevel ? levelOrder[a.promotionLevel] : 0;
            const bLevel = b.promotionLevel ? levelOrder[b.promotionLevel] : 0;
            
            if (aLevel !== bLevel) {
              return bLevel - aLevel;
            }
          } else if (a.isPromoted) {
            return -1;
          } else if (b.isPromoted) {
            return 1;
          }
          
          // Then sort by score
          return (b.score || 0) - (a.score || 0);
        });
        
        if (isLoadMore) {
          // Append to existing posts
          setPosts(prevPosts => [...prevPosts, ...sortedPosts]);
          setLoadingMore(false);
        } else {
          // Replace existing posts
          setPosts(sortedPosts);
          setLoadingPosts(false);
        }
        
        setHasFollowedPosts(sortedPosts.length > 0);
        
        // Record impressions for promoted posts
        sortedPosts.forEach(post => {
          if (post.isPromoted && post.promotedPostId) {
            recordImpression(post.promotedPostId);
          }
        });
        
        return { hasAnyPosts: sortedPosts.length > 0, posts: sortedPosts };
      }
      
      setLoadingPosts(false);
      setLoadingMore(false);
      return { hasAnyPosts: false, posts: [] };
    } catch (error) {
      console.error("Error in fetchPostsWithRanking:", error);
      setLoadingPosts(false);
      setLoadingMore(false);
      return { hasAnyPosts: false, posts: [] };
    }
  };
  
  // Add promotion information to posts
  const addPromotionInfo = (posts: ScoredPost[], promotions: PromotedPostType[]): ScoredPost[] => {
    if (!promotions.length) return posts;
    
    const now = new Date();
    const promotionMap = new Map<string, PromotedPostType>();
    
    // Create a map of post IDs to promotion details
    promotions.forEach(promotion => {
      const startDate = new Date(promotion.starts_at);
      const endDate = new Date(promotion.ends_at);
      
      if (startDate <= now && endDate >= now) {
        promotionMap.set(promotion.post_id, promotion);
      }
    });
    
    // Add promotion info to posts
    return posts.map(post => {
      const promotion = promotionMap.get(post.id);
      
      if (promotion) {
        const promotionBoost = promotion.promotion_level === 'featured' 
          ? 100 
          : promotion.promotion_level === 'premium' 
            ? 75 
            : 50;
            
        return {
          ...post,
          score: (post.score || 0) + promotionBoost,
          isPromoted: true,
          promotionLevel: promotion.promotion_level,
          promotedPostId: promotion.id
        };
      }
      
      return post;
    });
  };

  const fetchRandomPostsWithExclusions = async (excludePostIds: string[] = []) => {
    try {
      setLoadingRandomPosts(true);
      
      console.log(`Fetching random posts, excluding ${excludePostIds.length} posts`);
      
      // Calculate pagination - use randomPostsPerPage instead of postsPerPage
      const from = (randomPage - 1) * randomPostsPerPage;
      const to = from + randomPostsPerPage - 1;
      
      // Create a base query without post filtering yet
      let query = supabase
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
            reviews_rating,
            user_role,
            kyc_verified
          )
        `)
        .order('created_at', { ascending: false });
      
      // Add NOT IN filter when we have posts to exclude
      if (excludePostIds.length > 0) {
        // Format the filter properly with parentheses
        const idsString = `(${excludePostIds.join(',')})`;
        query = query.not('id', 'in', idsString);
      }
      
      // Apply pagination after filters to ensure we get the correct number of posts
      query = query.range(from, to);
      
      const { data: randomPostsData, error } = await query;
      
      if (error) {
        console.error("Error fetching random posts:", error);
        setLoadingRandomPosts(false);
        return;
      }
      
      if (randomPostsData && randomPostsData.length > 0) {
        // Apply the same scoring and promotion logic
        const scoredPosts: ScoredPost[] = randomPostsData.map(post => {
          const score = calculateBaseScore(
            post, 
            likesCountMap[post.id] || 0, 
            commentsCountMap[post.id] || 0,
            userInteractions
          );
          
          return {
            ...post,
            score
          };
        });
        
        // Apply promotion boosts
        const postsWithPromotion = addPromotionInfo(scoredPosts, promotedPosts);
        
        // Sort by score
        const sortedPosts = postsWithPromotion.sort((a, b) => {
          // First, prioritize promoted posts by level
          if (a.isPromoted && b.isPromoted) {
            const levelOrder = { featured: 3, premium: 2, basic: 1 };
            const aLevel = a.promotionLevel ? levelOrder[a.promotionLevel] : 0;
            const bLevel = b.promotionLevel ? levelOrder[b.promotionLevel] : 0;
            
            if (aLevel !== bLevel) {
              return bLevel - aLevel;
            }
          } else if (a.isPromoted) {
            return -1;
          } else if (b.isPromoted) {
            return 1;
          }
          
          // Then sort by score
          return (b.score || 0) - (a.score || 0);
        });
        
        // Check for any posts that might still be duplicates despite the filter
        const mainFeedPostIds = new Set(posts.map(post => post.id));
        const trulyUniqueRandomPosts = sortedPosts.filter(post => !mainFeedPostIds.has(post.id));
        
        console.log(`Found ${randomPostsData.length} random posts, ${trulyUniqueRandomPosts.length} are truly unique`);
        
        // Set the random posts - always append when loading more
        if (randomPage > 1) {
          // Prevent duplicates by checking IDs of existing posts
          const existingIds = new Set(randomPosts.map(post => post.id));
          const uniqueNewPosts = trulyUniqueRandomPosts.filter(post => !existingIds.has(post.id));
          
          // Always add any new posts we found, but only update more status if we got new posts
          if (uniqueNewPosts.length > 0) {
            setRandomPosts(prevPosts => [...prevPosts, ...uniqueNewPosts]);
            // Only consider having more posts if we received a full page of data
            setHasMoreRandomPosts(uniqueNewPosts.length >= randomPostsPerPage);
          } else {
            // If no new unique posts were found, there are no more posts to load
            setHasMoreRandomPosts(false);
          }
        } else {
          // Initial load - set the posts
          setRandomPosts(trulyUniqueRandomPosts);
          // Only set hasMoreRandomPosts to true if we got a full page of posts (indicating there may be more)
          setHasMoreRandomPosts(trulyUniqueRandomPosts.length >= randomPostsPerPage);
        }
        
        // Record impressions for promoted posts
        trulyUniqueRandomPosts.forEach(post => {
          if (post.isPromoted && post.promotedPostId) {
            recordImpression(post.promotedPostId);
          }
        });
      } else {
        if (randomPage === 1) {
          setRandomPosts([]);
        }
        // Always set to false if we got zero results
        setHasMoreRandomPosts(false);
      }
      
      setLoadingRandomPosts(false);
    } catch (error) {
      console.error("Error fetching random posts:", error);
      setLoadingRandomPosts(false);
      setHasMoreRandomPosts(false);
    }
  };

  const loadMorePosts = () => {
    if (loadingMore || !hasMorePosts) return;
    
    const nextPage = page + 1;
    setPage(nextPage);
    fetchPostsWithRanking(followedUserIds, nextPage, true);
  };

  const loadMoreRandomPosts = () => {
    if (loadingMoreRandom || !hasMoreRandomPosts) return;
    
    const nextPage = randomPage + 1;
    setRandomPage(nextPage);
    setLoadingMoreRandom(true);
    
    // Get the IDs of main feed posts only
    const mainFeedPostIds = posts.map(post => post.id);
    
    // Fetch more random posts, excluding only main feed posts
    fetchRandomPostsWithExclusions(mainFeedPostIds).finally(() => {
      setLoadingMoreRandom(false);
    });
  };

  const handlePostSubmit = async (data: { text: string; image_url: string | string[]; isTextPost: boolean }) => {
    try {
      if (!user) return;
      
      // Extract text and image URL
      const { text, image_url } = data;
      
      // Prepare image URL format (could be string or string array)
      let imageUrlValue = image_url;
      if (Array.isArray(image_url)) {
        imageUrlValue = JSON.stringify(image_url);
      }
      
      // Create post
      const { data: newPost, error } = await supabase
        .from('posts')
        .insert([
          {
            caption: text,
            image_url: imageUrlValue,
            user_id: user.id
          }
        ])
        .select()
        .single();
        
      if (error) {
        console.error('Error creating post:', error);
        return;
      }
      
      // Fetch the profile data for the new post
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single();
        
      if (profileError) {
        console.error('Error fetching profile:', profileError);
      }
      
      // Add profile to new post
      const postWithProfile = {
        ...newPost,
        profiles: profileData || undefined
      };
      
      // Add the new post to the existing posts with highest score to show at top
      setPosts(prevPosts => [{
        ...postWithProfile,
        score: 100, // Give new posts a high initial score
        isPromoted: false
      }, ...prevPosts]);
    } catch (error) {
      console.error('Error in handlePostSubmit:', error);
    }
  };

  const refreshPosts = () => {
    postsAlreadyLoaded.current = false;
    setPage(1);
    setRandomPage(1);
    
    // First fetch the main feed posts
    fetchPostsWithRanking(followedUserIds).then(result => {
      // Then fetch discovery posts, ensuring we exclude the newly fetched main posts
      const mainPostIds = result.posts.map(post => post.id);
      fetchRandomPostsWithExclusions(mainPostIds);
    });
  };

  return (
    <MainLayout 
      activeTab={activeTab} 
      setActiveTab={setActiveTab}
    >
      <div className="max-lg:max-w-4xl min-h-screen max-lg:pt-16 py-4 mb-20">
        <MobileHeader />
        
        {/* Content area */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Main content - posts */}
          <div className="md:col-span-2">
            {/* Create post area */}
            <CreatePost onSubmit={handlePostSubmit} />
            
            {/* Posts feed */}
            <div className="mt-4">
              {/* Refresh button */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg ml-4 font-semibold">Latest Posts</h2>
                <Button 
                  variant="outline" 
                  size="sm"  
                  onClick={refreshPosts}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  Refresh
                </Button>
              </div>
              
              {/* Loading state */}
              {loadingPosts && (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <Card key={i} className="p-4">
                      <div className="flex items-center space-x-2 mb-4">
                        <Skeleton className="h-10 w-10 rounded-full" />
                        <div className="space-y-2">
                          <Skeleton className="h-4 w-24" />
                          <Skeleton className="h-3 w-16" />
                        </div>
                      </div>
                      <Skeleton className="h-4 w-full mb-2" />
                      <Skeleton className="h-4 w-3/4 mb-2" />
                      <Skeleton className="h-40 w-full mb-4 rounded-md" />
                      <div className="flex space-x-4">
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                        <Skeleton className="h-8 w-16" />
                      </div>
                    </Card>
                  ))}
                </div>
              )}
              
              {/* Posts from followed users */}
              {!loadingPosts && posts.length > 0 && (
                <div className="space-y-4">
                  {posts.map((post) => (
                    <Post
                      key={post.id}
                      id={post.id}
                      user_id={post.user_id || ''}
                      image_url={post.image_url}
                      caption={post.caption}
                      created_at={post.created_at || ''}
                      profiles={post.profiles || { id: '', username: '', avatar_url: '' }}
                      currentUserId={async () => user?.id}
                      isPromoted={post.isPromoted}
                      promotionLevel={post.promotionLevel}
                      userRole={userRole}
                    />
                  ))}
                  
                  {/* Load more button */}
                  {hasMorePosts && (
                    <div className="flex justify-center">
                      <Button 
                        variant="outline" 
                        onClick={loadMorePosts} 
                        disabled={loadingMore}
                        className="mt-2"
                      >
                        {loadingMore ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </>
                        ) : (
                          "Load More"
                        )}
                      </Button>
                    </div>
                  )}
                  
                  {/* "All caught up" message */}
                  {!hasMorePosts && posts.length > 0 && (
                    <Card className="p-4 text-center bg-background border-muted">
                      <p className="text-muted-foreground">You're all caught up! ✨</p>
                    </Card>
                  )}
                </div>
              )}
              
              {/* No posts state */}
              {!loadingPosts && posts.length === 0 && (
                <Card className="p-8 text-center">
                  <h3 className="text-lg font-semibold mb-2">No posts to show</h3>
                  <p className="text-muted-foreground mb-4">
                    Follow some users to see their posts here, or create your own post!
                  </p>
                </Card>
              )}
              
              {/* Discover more posts section - add this back */}
              {!loadingPosts && (
                <div className="mt-10">
                  <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg ml-4 font-semibold">Discover More Posts</h2>
                  </div>
                  
                  {/* Loading state for random posts */}
                  {loadingRandomPosts && randomPosts.length === 0 && (
                    <div className="space-y-4">
                      {[1, 2, 3].map((i) => (
                        <Card key={i} className="p-4">
                          <div className="flex items-center space-x-2 mb-4">
                            <Skeleton className="h-10 w-10 rounded-full" />
                            <div className="space-y-2">
                              <Skeleton className="h-4 w-24" />
                              <Skeleton className="h-3 w-16" />
                            </div>
                          </div>
                          <Skeleton className="h-4 w-full mb-2" />
                          <Skeleton className="h-4 w-3/4 mb-2" />
                          <Skeleton className="h-40 w-full mb-4 rounded-md" />
                        </Card>
                      ))}
                    </div>
                  )}
                  
                  {/* Random posts content */}
                  {!loadingRandomPosts && randomPosts.length > 0 ? (
                    <div className="space-y-4">
                      {randomPosts.map((post) => (
                        <Post
                          key={`random-${post.id}`}
                          id={post.id}
                          user_id={post.user_id || ''}
                          image_url={post.image_url}
                          caption={post.caption}
                          created_at={post.created_at || ''}
                          profiles={post.profiles || { id: '', username: '', avatar_url: '' }}
                          currentUserId={async () => user?.id}
                          isPromoted={post.isPromoted}
                          promotionLevel={post.promotionLevel}
                          userRole={userRole}
                        />
                      ))}
                      
                      {/* Load more button for discovery posts - only show if more posts are available */}
                      {hasMoreRandomPosts && !loadingMoreRandom && (
                        <div className="flex justify-center">
                          <Button 
                            variant="outline" 
                            onClick={loadMoreRandomPosts} 
                            className="mt-2"
                          >
                            Discover More
                          </Button>
                        </div>
                      )}
                      
                      {/* Loading state for "Discover More" */}
                      {loadingMoreRandom && (
                        <div className="flex justify-center">
                          <Button 
                            variant="outline" 
                            disabled
                            className="mt-2"
                          >
                            <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            Loading...
                          </Button>
                        </div>
                      )}
                    </div>
                  ) : !loadingRandomPosts ? (
                    <Card className="p-8 text-center">
                      <h3 className="text-lg font-semibold mb-2">No discover posts available</h3>
                      <p className="text-muted-foreground mb-4">
                        Try refreshing or create your own post!
                      </p>
                    </Card>
                  ) : null}
                </div>
              )}
            </div>
          </div>
          
          {/* Sidebar */}
          <div className="hidden lg:block">
            <TrendingServices />
          </div>
        </div>
      </div>
    </MainLayout>
  );
}
