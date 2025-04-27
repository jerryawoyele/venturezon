import React, { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Search, X, ArrowRight } from "lucide-react";
import { SearchUsers } from "./SearchUsers";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Link } from "react-router-dom";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { User } from "lucide-react";
import { Package2 } from "lucide-react";
import { formatPrice } from "@/lib/utils";
import { useCurrency } from "@/contexts/CurrencyContext";

interface TrendingService {
  id: string;
  title: string;
  category: string;
  description: string;
  engagement_score: number;
  user_id?: string;
  profiles?: string | {
    id: string;
    username: string;
    avatar_url: string;
    display_name?: string;
    business_name?: string;
  };
  profile?: {
    username: string;
    avatar_url: string;
    display_name?: string;
  };
  user_profile?: {
    username: string;
    avatar_url: string;
    display_name?: string;
  };
  image?: string;
  price?: number;
  is_price_range?: boolean;
  bookingCount?: number;
  periodBookingCount?: number;
  trendingScore?: number;
}

export function TrendingServices() {
  const [searchQuery, setSearchQuery] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [trendingServices, setTrendingServices] = useState<TrendingService[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();

  useEffect(() => {
    fetchTrendingServices();
  }, []);

  // Handle clicks outside to close search results
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      // If click was not on search bar or results, close results
      if (!target.closest('.search-container') && showResults) {
        setShowResults(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showResults]);

  const fetchTrendingServices = async () => {
    setLoading(true);
    try {
      // First fetch just the services without any joins
      const { data: servicesData, error: servicesError } = await supabase
        .from('services')
        .select('*, profiles(*)')
        .order('created_at', { ascending: false });
      
      if (servicesError) throw servicesError;
      
      // Debug services data to see owner structure
      console.log("Services data with owner:", servicesData);

      if (!servicesData || servicesData.length === 0) {
        setTrendingServices([]);
        setLoading(false);
        return;
      }
      
      // Then fetch booking data in a separate query
      const { data: bookingsData, error: bookingsError } = await supabase
        .from('bookings')
        .select('id, service_id, created_at');
      
      if (bookingsError) throw bookingsError;
      
      // Group bookings by service ID
      const bookingsByService = (bookingsData || []).reduce((acc, booking) => {
        if (!booking.service_id) return acc;
        if (!acc[booking.service_id]) {
          acc[booking.service_id] = [];
        }
        acc[booking.service_id].push(booking);
        return acc;
      }, {} as Record<string, any[]>);
      
      // Map services with their bookings
      const servicesWithBookings = servicesData.map(service => {
        const serviceBookings = bookingsByService[service.id] || [];
        return {
          ...service,
          bookings: serviceBookings.map(booking => ({
            id: booking.id,
            created_at: booking.created_at
          }))
        };
      });

      // Continue with the existing logic, using servicesWithBookings
      const now = new Date();
      
      // Time periods to check, in days
      const timePeriods = [7, 30, 90, 365, Infinity]; // 1 week, 1 month, 3 months, 1 year, all time
      
      let selectedServices = [];
      
      // Prepare a fallback of services sorted by total booking count
      const servicesWithTotalBookings = servicesWithBookings.map(service => {
        const totalBookingCount = service.bookings ? service.bookings.length : 0;
        return {
          ...service,
          bookingCount: totalBookingCount
        };
      }).sort((a, b) => b.bookingCount - a.bookingCount);
      
      const topServicesByBookingCount = servicesWithTotalBookings.slice(0, 10);
      
      // If there are any services with bookings, use those first
      if (topServicesByBookingCount.some(service => service.bookingCount > 0)) {
        console.log("Found services with bookings, using them directly");
        selectedServices = topServicesByBookingCount;
      } else {
        // Try each time period until we find services with bookings
        for (const periodDays of timePeriods) {
          const servicesWithScores = servicesWithBookings.map(service => {
            // Count bookings within the current time period
            const periodStart = new Date();
            periodStart.setDate(periodStart.getDate() - periodDays);
            
            const periodBookings = service.bookings ? 
              service.bookings.filter(booking => new Date(booking.created_at) >= periodStart) : 
              [];
            
            const bookingCount = periodBookings.length;
            
            // Calculate recency factor (higher for more recent bookings)
            let recencyFactor = 1;
            if (bookingCount > 0) {
              // Find most recent booking date
              const mostRecentBooking = periodBookings.reduce((latest, booking) => {
                const bookingDate = new Date(booking.created_at);
                return bookingDate > latest ? bookingDate : latest;
              }, new Date(0));
              
              // Calculate days since most recent booking
              const daysSinceRecentBooking = Math.max(1, Math.floor((now.getTime() - mostRecentBooking.getTime()) / (1000 * 60 * 60 * 24)));
              
              // Recency factor gives higher weight to recent bookings
              recencyFactor = periodDays === Infinity ? 1 : (periodDays / daysSinceRecentBooking);
            }
            
            // For all-time, just use the total booking count
            const totalBookingCount = service.bookings ? service.bookings.length : 0;
            
            // Calculate trending score: booking count weighted by recency
            const trendingScore = periodDays === Infinity 
              ? totalBookingCount 
              : bookingCount * recencyFactor;
            
            return {
              ...service,
              bookingCount: totalBookingCount, // Always show total booking count
              periodBookingCount: bookingCount, // Bookings within the period
              trendingScore
            };
          });
          
          // Sort by trending score (descending)
          const sortedServices = servicesWithScores
            .sort((a, b) => b.trendingScore - a.trendingScore);
          
          // Check if we have any services with bookings in this period
          const servicesWithPeriodBookings = sortedServices.filter(s => s.periodBookingCount > 0);
          
          if (servicesWithPeriodBookings.length > 0) {
            selectedServices = servicesWithPeriodBookings.slice(0, 10);
            break; // Found services with bookings in this period, exit the loop
          }
          
          // If this is the last period (all time) and still no services with bookings
          if (periodDays === Infinity) {
            // Use the top services by booking count as fallback
            selectedServices = topServicesByBookingCount;
          }
        }
      }
      
      // If we still don't have any services, use the most recent ones as a last resort
      if (selectedServices.length === 0) {
        console.log("No services with bookings found in any time period, using most recent services");
        selectedServices = servicesWithBookings.slice(0, 10);
      }
      
      console.log("Selected services after fallback logic:", selectedServices.length, 
        selectedServices.map(s => ({ 
          id: s.id, 
          title: s.title, 
          bookingCount: s.bookingCount 
        }))
      );
      
      // Get unique user IDs of service owners
      const userIds = [...new Set(selectedServices.map(service => service.user_id))].filter(Boolean);
      
      // Fetch profile information for service owners if we have any user IDs
      let profileData = [];
      if (userIds.length > 0) {
        const { data: profiles, error: profileError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url, display_name, business_name')
          .in('id', userIds);
        
        if (profileError) throw profileError;
        profileData = profiles || [];
      }
      
      // Map profile data to services
      const servicesWithProfiles = selectedServices.map(service => {
        const profileMatch = service.profiles ? 
          profileData.find(profile => profile.id === service.profiles) : null;
        
        return {
          ...service,
          profiles: profileMatch || null
        };
      });
      
      setTrendingServices(servicesWithProfiles as TrendingService[]);
    } catch (error) {
      console.error('Error fetching trending services:', error);
      setTrendingServices([]); // Set empty array in case of error
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setSearchQuery(value);
    setShowResults(!!value);
  };

  const handleServiceClick = (serviceId: string, userId: string, username?: string, categoryOrTitle?: string) => {
    // Option 1: Navigate to the service detail page
    navigate(`/services/${serviceId}`);
    
    // Option 2: Navigate to the user profile with services tab
    // if (username) {
    //   navigate(`/@${username}?tab=services`);
    // } else {
    //   navigate(`/user/${userId}?tab=services`);
    // }
  };

  const handleCategoryClick = (category: string) => {
    // Navigate to discover page with search param for this category
    navigate(`/discover?search=${encodeURIComponent(category)}`);
  };

  // Function to handle "Explore More" button click
  const handleExploreMore = () => {
    navigate('/discover?tab=services');
  };

  return (
    <div className="space-y-6">
      {/* Search bar */}
      <div className="relative search-container">
        <div className="rounded-lg p-1 border border-border bg-card">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for services..."
              className="w-full bg-background border-0 rounded-lg py-2 pl-10 pr-10 text-foreground placeholder:text-muted-foreground focus:ring-0 focus:outline-none focus:bg-secondary transition-colors"
              value={searchQuery}
              onChange={handleChange}
              onFocus={() => setShowResults(true)}
            />
            {searchQuery && (
              <button 
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={() => {
                  setSearchQuery("");
                  setShowResults(false);
                }}
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
        <div className="absolute w-full z-50">
          <SearchUsers 
            searchQuery={searchQuery} 
            show={showResults} 
            onClose={() => setShowResults(false)} 
          />
        </div>
      </div>

      <Card className="p-6 bg-card border-border">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Trending Services</h2>
          <Button 
            variant="ghost" 
            size="sm" 
            className="text-primary hover:text-foreground"
            onClick={handleExploreMore}
          >
            Explore More <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        
        {/* Category chips */}
        <div className="flex flex-wrap gap-2 mb-4">
          {['Design', 'Development', 'Marketing', 'Writing', 'Digital Art'].map(category => (
            <Badge 
              key={category}
              variant="outline" 
              className="cursor-pointer hover:bg-secondary transition-colors"
              onClick={() => handleCategoryClick(category)}
            >
              {category}
            </Badge>
          ))}
        </div>
        
        <div className="space-y-4">
          {loading ? (
            // Loading skeleton
            Array(3).fill(0).map((_, i) => (
              <div key={i} className="flex items-center justify-between p-3 rounded-lg bg-background animate-pulse">
                <div className="flex gap-3">
                  <div className="w-4 h-4 bg-muted rounded" />
                  <div>
                    <div className="h-4 w-32 bg-muted rounded mb-2" />
                    <div className="h-3 w-40 bg-muted rounded" />
                  </div>
                </div>
                <div className="h-3 w-16 bg-muted rounded" />
              </div>
            ))
          ) : trendingServices && trendingServices.length > 0 ? (
            <div className="space-y-4">
              {trendingServices.map((service, index) => (
                <Card key={service.id} className="rounded-lg overflow-hidden border-border hover:border-primary/20 bg-white dark:bg-black/20 hover:bg-secondary/50 dark:hover:bg-black/30 transition-all duration-200">
                  <Link to={`/services/${service.id}`}>
                    <div className="cursor-pointer flex flex-col md:flex-row">
                      <div className="aspect-video w-full md:w-1/3 relative overflow-hidden">
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent z-10" />
                        
                        {service.image ? (
                          <img 
                            src={service.image}
                            alt={service.title}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src = "/service-placeholder.jpg";
                            }}
                          />
                        ) : (
                          <div className="w-full h-full bg-gradient-to-br from-gray-900 to-black flex items-center justify-center">
                            <Package2 className="h-1/3 w-1/3 text-muted-foreground" />
                          </div>
                        )}
                        
                        <div className="absolute bottom-2 right-2 z-20">
                          <Badge variant="secondary" className="bg-background/80 dark:bg-black/60 hover:bg-background dark:hover:bg-black/80">
                            {(service.bookingCount || 0) > 0 ? `${service.bookingCount} ${service.bookingCount === 1 ? 'booking' : 'bookings'}` : 'New'}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="p-4 flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Avatar className="h-6 w-6">
                            <AvatarImage 
                              src={
                                typeof service.profiles === 'object' 
                                  ? service.profiles?.avatar_url 
                                  : service.user_profile?.avatar_url || service.profile?.avatar_url
                              }
                              alt={
                                typeof service.profiles === 'object'
                                  ? service.profiles?.display_name || service.profiles?.business_name || service.profiles?.username
                                  : service.user_profile?.display_name || service.user_profile?.username || service.profile?.display_name || service.profile?.username || "Business"
                              } 
                            />
                            <AvatarFallback>
                              <User className="h-4 w-4" />
                            </AvatarFallback>
                          </Avatar>
                          <span className="text-xs text-muted-foreground">
                            {
                              typeof service.profiles === 'object'
                                ? service.profiles?.display_name || service.profiles?.business_name || service.profiles?.username || "Business"
                                : service.user_profile?.display_name || service.user_profile?.username || service.profile?.display_name || service.profile?.username || "Business"
                            }
                          </span>
                        </div>
                        
                        <h3 className="font-semibold text-base line-clamp-1">{service.title}</h3>
                        
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{service.description}</p>
                      
                        <div className="mt-3 flex items-center justify-between">
                          <div className="text-primary font-medium">
                            {service.price 
                              ? service.is_price_range 
                                ? `From ${formatPrice(service.price, 'USD')}`
                                : formatPrice(service.price, 'USD')
                              : 'Free'}
                          </div>
                          
                          {service.category && (
                            <Badge 
                              variant="outline" 
                              className="cursor-pointer hover:bg-secondary"
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                handleCategoryClick(service.category);
                              }}
                            >
                              {service.category}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  </Link>
                </Card>
              ))}
            </div>
          ) : (
            <div className="text-center text-muted-foreground py-4">
              No services available at this time
            </div>
          )}
        </div>
      </Card>

      <div className="text-center text-sm text-muted-foreground p-4 mt-0">
        <p>&copy; {new Date().getFullYear()} Venturezon</p>
        <p className="mt-1">All rights reserved.</p>
      </div>
    </div>
  );
}
