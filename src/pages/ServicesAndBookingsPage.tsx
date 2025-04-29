import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { StarRating } from "@/components/StarRating";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  Star,
  Search,
  MessageSquare,
  ChevronRight,
  ThumbsUp,
  ThumbsDown,
  Info,
  User,
  Shield,
  Loader2,
  Plus,
  Filter,
  LayoutGrid,
  Sliders,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { EscrowService } from "@/utils/escrow-service";
import { LocationService } from "@/utils/location-service";
import { MainLayout } from "@/layouts/MainLayout";
import { ServiceDashboard } from "@/components/services/ServiceDashboard";
import { AddServiceModal } from "@/components/services/AddServiceModal";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function ServicesAndBookingsPage() {
  const location = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  
  // Add a try/catch block to safely handle context issues
  const currencyContext = (() => {
    try {
      return useCurrency();
    } catch (error) {
      // Return a fallback object with the same structure
      return { 
        formatPrice: (price: number) => `$${price}`, 
        symbol: '$',
        // Add any other properties that your code might use
      };
    }
  })();
  
  const { formatPrice, symbol } = currencyContext;
  
  // Determine the active page based on URL
  const [pageType, setPageType] = useState<"services" | "bookings">("services");
  
  // State for active tab
  const [activeTab, setActiveTab] = useState(() => {
    // Get the tab from URL or localStorage
    const params = new URLSearchParams(location.search);
    const tabParam = params.get("tab");
    const savedTab = localStorage.getItem("servicesBookingsTab");
    
    // First try URL parameter, then localStorage, then default to "Services"
    return tabParam || savedTab || "Services";
  });
  
  // Update localStorage and URL when tab changes
  useEffect(() => {
    localStorage.setItem("servicesBookingsTab", activeTab);
    
    // Update URL without full navigation
    const url = new URL(window.location.href);
    url.searchParams.set("tab", activeTab);
    window.history.replaceState({}, "", url.toString());
  }, [activeTab]);
  
  // Common state variables
  const [userRole, setUserRole] = useState<"business" | "customer" | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Services page state
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  
  // Bookings page state
  const [bookings, setBookings] = useState<any[]>([]);
  const [filteredBookings, setFilteredBookings] = useState<any[]>([]);
  const [loadingBookings, setLoadingBookings] = useState(true);
  const [statusTab, setStatusTab] = useState("pending");
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState<any>(null);
  const [reviewContent, setReviewContent] = useState("");
  const [reviewRating, setReviewRating] = useState(5);
  const [disputeReason, setDisputeReason] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [submittingDispute, setSubmittingDispute] = useState(false);

  // Add a loading state for authentication
  const [authLoading, setAuthLoading] = useState(true);

  // Add state for confirmation dialog
  const [bookingToCancel, setBookingToCancel] = useState<string | null>(null);
  const [cancellationLoading, setCancellationLoading] = useState(false);

  // Add new state for pending completion bookings
  const [pendingCompletionBookings, setPendingCompletionBookings] = useState<any[]>([]);

  // Initialize based on path
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('bookings')) {
      setPageType("bookings");
      setActiveTab("Bookings");
      fetchBookings();
    } else {
      setPageType("services");
      setActiveTab("Services");
      fetchServices();
    }
  }, [location.pathname]);

  useEffect(() => {
    checkAuthAndFetchUserRole();
  }, []);

  useEffect(() => {
    if (user && isAuthenticated) {
      if (pageType === "services") {
        fetchServices();
      } else {
        fetchBookings();
      }
    }
  }, [user, isAuthenticated, pageType]);

  useEffect(() => {
    if (bookings.length > 0) {
      setFilteredBookings(applyBookingsFilters());
    }
  }, [bookings, statusTab, searchQuery]);

  useEffect(() => {
    if (user && bookings && bookings.length > 0) {
      // Find bookings that need customer confirmation
      const pendingCompletions = bookings.filter(
        b => b.status === "pending_completion" && b.customer_id === user.id
      );
      setPendingCompletionBookings(pendingCompletions);
    } else {
      setPendingCompletionBookings([]);
    }
  }, [bookings, user]);

  const checkAuthAndFetchUserRole = async () => {
    try {
      setAuthLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        setIsAuthenticated(true);
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', session.user.id)
          .single();
          
        if (!error && data) {
          if ('user_role' in data) {
            setUserRole(data.user_role as "business" | "customer");
          } else {
            setUserRole("customer");
          }
        }
      } else {
        setIsAuthenticated(false);
      }
    } catch (error) {
      console.error("Error checking auth:", error);
    } finally {
      setAuthLoading(false);
    }
  };

  // Services-related functions
  const fetchServices = async () => {
    try {
      setLoadingServices(true);
      
      if (!user) {
        setLoadingServices(false);
        return;
      }
      
      const { data, error } = await supabase
        .from("services")
        .select("*, profiles!owner_id(username, avatar_url)")
        .eq("owner_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      setServices(data || []);
      setLoadingServices(false);
    } catch (error) {
      console.error("Error fetching services:", error);
      toast({
        title: "Error",
        description: "Failed to load your services. Please try again.",
        variant: "destructive",
      });
      setLoadingServices(false);
    }
  };

  const handleServiceAdded = (newService: any) => {
    setServices([newService, ...services]);
    setShowAddModal(false);
    toast({
      title: "Service Added",
      description: "Your service has been successfully added to your dashboard",
    });
  };

  // Bookings-related functions
  const fetchBookings = async () => {
    if (!user) return;
    
    try {
      setLoadingBookings(true);
      
      // First, fetch bookings with basic related data (no reviews yet)
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          services(*),
          provider:profiles!provider_id(username, avatar_url),
          escrow_payments(*)
        `)
        .eq("customer_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      if (!data || data.length === 0) {
        setBookings([]);
        setFilteredBookings([]);
        setLoadingBookings(false);
        return;
      }
      
      // Get all service IDs
      const serviceIds = data.map(booking => booking.service_id);
      
      // Fetch reviews separately
      const { data: reviewsData, error: reviewsError } = await supabase
        .from("reviews")
        .select("*")
        .in("service_id", serviceIds);
        
      if (reviewsError) {
        console.error("Error fetching reviews:", reviewsError);
        // If we can't fetch reviews, just set the bookings without reviews
        setBookings(data);
        setFilteredBookings(data);
        setLoadingBookings(false);
        return;
      }
      
      // Map reviews to bookings based on service_id
      const enrichedBookings = data.map(booking => ({
        ...booking,
        reviews: reviewsData?.filter(review => review.service_id === booking.service_id) || []
      }));
      
      setBookings(enrichedBookings);
      setFilteredBookings(enrichedBookings);
      setLoadingBookings(false);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast({
        title: "Error",
        description: "Failed to load your bookings",
        variant: "destructive",
      });
      setLoadingBookings(false);
    }
  };

  const applyBookingsFilters = () => {
    if (!bookings || !Array.isArray(bookings) || bookings.length === 0) return [];
    
    let filtered = [...bookings];
    
    // Filter by status with special handling for pending_completion
    filtered = filtered.filter(booking => {
      // Show pending_completion bookings in the confirmed tab
      if (statusTab === "confirmed") {
        return booking?.status === "confirmed" || booking?.status === "pending_completion";
      }
      // Otherwise, use exact status match
      return booking?.status === statusTab;
    });
    
    // Apply search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(booking => 
        (booking?.services?.title?.toLowerCase() || '').includes(query) ||
        (booking?.services?.description?.toLowerCase() || '').includes(query) ||
        (booking?.provider?.username?.toLowerCase() || '').includes(query)
      );
    }
    
    return filtered;
  };

  const handleOpenBooking = (booking: any) => {
    // Navigate to the service details page and show the bookings tab
    navigate(`/services/${booking.service_id}`);
  };

  const handleContactProvider = (providerId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/messages?user=${providerId}`);
  };

  const handleCancelBookingRequest = (bookingId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setBookingToCancel(bookingId);
  };

  const handleCancelBooking = async () => {
    if (!bookingToCancel) return;
    
    setCancellationLoading(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", bookingToCancel);

      if (error) throw error;

      // Refund the payment if applicable
      const booking = bookings.find(b => b.id === bookingToCancel);
      if (booking?.escrow_payments?.[0]?.id) {
        try {
          await EscrowService.refundPayment(booking.escrow_payments[0].id, null);
        } catch (paymentError) {
          console.error("Error refunding payment:", paymentError);
          // Continue with cancellation even if refund fails
        }
      }

      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully",
      });

      // Update local state
      setBookings(bookings.map(booking => 
        booking.id === bookingToCancel 
          ? { ...booking, status: "cancelled" } 
          : booking
      ));
      
      setFilteredBookings(prev => 
        prev.map(booking => 
          booking.id === bookingToCancel 
            ? { ...booking, status: "cancelled" } 
            : booking
        )
      );
      
    } catch (error) {
      console.error("Error canceling booking:", error);
      toast({
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancellationLoading(false);
      setBookingToCancel(null);
    }
  };

  const handleOpenReviewModal = (booking: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBooking(booking);
    setShowReviewModal(true);
  };

  const handleOpenDisputeModal = (booking: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedBooking(booking);
    setShowDisputeModal(true);
  };

  const hasUserLeftReview = (booking: any) => {
    if (!user || !booking.reviews) return false;
    return booking.reviews.some((review: any) => 
      review.reviewer_id === user.id && 
      review.service_id === booking.service_id
    );
  };

  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  };

  const handleSubmitReview = async () => {
    if (!selectedBooking || !user) return;
    
    setSubmittingReview(true);
    
    try {
      // Ensure we have a valid user ID
      if (!user.id) {
        throw new Error("User ID is missing. Please log in again.");
      }
      
      // Add debugging to check the IDs
      console.log("Debug review IDs:", {
        user_id: user.id,
        service_owner_id: selectedBooking.services?.owner_id,
        provider_id: selectedBooking.provider_id,
        is_user_owner: selectedBooking.services?.owner_id === user.id,
        is_user_provider: selectedBooking.provider_id === user.id
      });
      
      // Check if user is trying to review their own service
      if (selectedBooking.services?.owner_id === user.id) {
        throw new Error("You cannot review your own service");
      }
      
      // Check if a review already exists
      let existingReview = selectedBooking.reviews?.find(
        (r: any) => r.reviewer_id === user.id
      );
      
      // If we didn't find it in the booking data, check the database directly
      if (!existingReview) {
        const { data: existingReviewData, error: lookupError } = await supabase
          .from("reviews")
          .select("*")
          .eq("service_id", selectedBooking.service_id)
          .eq("reviewer_id", user.id)
          .maybeSingle();
        
        if (lookupError) {
          console.error("Error checking for existing review:", lookupError);
        } else if (existingReviewData) {
          existingReview = existingReviewData;
        }
      }
      
      if (existingReview) {
        // Update existing review
        const { error } = await supabase
          .from("reviews")
          .update({
            content: reviewContent,
            rating: reviewRating,
            updated_at: new Date().toISOString()
          })
          .eq("id", existingReview.id);
          
        if (error) throw error;
      } else {
        // Try to create new review
        try {
          const { data, error } = await supabase
            .from("reviews")
            .insert({
              service_id: selectedBooking.service_id,
              reviewer_id: user.id,
              user_id: selectedBooking.services?.owner_id, // The ID of the user being reviewed
              content: reviewContent,
              rating: reviewRating
            })
            .select()
            .single();
            
          if (error) {
            // If we got a duplicate key error, we need to update instead
            if (error.code === '23505') {
              console.log("Duplicate review detected, attempting to update instead");
              
              // Get the existing review ID first
              const { data: existingData } = await supabase
                .from("reviews")
                .select("id")
                .eq("service_id", selectedBooking.service_id)
                .eq("reviewer_id", user.id)
                .single();
                
              if (existingData) {
                // Update using the ID we found
                const { error: updateError } = await supabase
                  .from("reviews")
                  .update({
                    content: reviewContent,
                    rating: reviewRating,
                    updated_at: new Date().toISOString()
                  })
                  .eq("id", existingData.id);
                  
                if (updateError) throw updateError;
              } else {
                throw error; // Original error if we couldn't find the record to update
              }
            } else {
              throw error; // Rethrow if it's not a duplicate key error
            }
          }
          
          // Update service ratings
          const { data: serviceData } = await supabase
            .from("services")
            .select("ratings_count, ratings_sum")
            .eq("id", selectedBooking.service_id)
            .single();
            
          if (serviceData) {
            const newCount = (serviceData.ratings_count || 0) + 1;
            const newSum = (serviceData.ratings_sum || 0) + reviewRating;
            
            await supabase
              .from("services")
              .update({
                ratings_count: newCount,
                ratings_sum: newSum
              })
              .eq("id", selectedBooking.service_id);
          }
          
          // Successfully submitted/updated the review
          toast({
            title: "Review Submitted",
            description: "Thank you for your feedback!"
          });
          
          setShowReviewModal(false);
          setReviewContent("");
          setReviewRating(5);
          fetchBookings(); // Refresh bookings to include the new review
        } catch (error) {
          console.error("Error submitting review:", error);
          
          // Check for specific error types
          let errorMessage = "Failed to submit review";
          
          if (error instanceof Error) {
            if (error.message === "You cannot review your own service") {
              errorMessage = "You cannot review your own service";
            }
          } else if (typeof error === 'object' && error !== null) {
            // Check for Supabase constraint error
            const supabaseError = error as any;
            if (supabaseError.code === '23514' && 
                supabaseError.message?.includes('prevent_self_review')) {
              errorMessage = "You cannot review your own service";
            }
          }
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
        }
      }
    } catch (error) {
      console.error("Error submitting review:", error);
      
      // Check for specific error types
      let errorMessage = "Failed to submit review";
      
      if (error instanceof Error) {
        if (error.message === "You cannot review your own service") {
          errorMessage = "You cannot review your own service";
        }
      } else if (typeof error === 'object' && error !== null) {
        // Check for Supabase constraint error
        const supabaseError = error as any;
        if (supabaseError.code === '23514' && 
            supabaseError.message?.includes('prevent_self_review')) {
          errorMessage = "You cannot review your own service";
        }
      }
      
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleSubmitDispute = async () => {
    if (!selectedBooking || !user || !disputeReason) return;
    
    setSubmittingDispute(true);
    
    try {
      const escrowPayment = selectedBooking.escrow_payments?.[0];
      if (!escrowPayment) throw new Error("No payment found for this booking");
      
      const result = await EscrowService.createDispute(
        escrowPayment.id,
        disputeReason,
        user.id,
        selectedBooking.provider_id
      );
      
      if (!result) {
        throw new Error("Failed to create dispute");
      }
      
      toast({
        title: "Dispute Submitted",
        description: "Your dispute has been submitted and will be reviewed by our team."
      });
      
      setShowDisputeModal(false);
      setDisputeReason("");
      
      // Update escrow payment status in local state
      const updatedBookings = bookings.map(booking => {
        if (booking.id === selectedBooking.id && booking.escrow_payments) {
          const updatedPayments = booking.escrow_payments.map((payment: any) => 
            payment.id === escrowPayment.id 
              ? { ...payment, status: 'disputed' } 
              : payment
          );
          return { ...booking, escrow_payments: updatedPayments };
        }
        return booking;
      });
      
      setBookings(updatedBookings);
    } catch (error) {
      console.error("Error submitting dispute:", error);
      toast({
        title: "Error",
        description: "Failed to submit dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Add this after the existing functions
  const countPendingConfirmations = () => {
    if (!bookings) return 0;
    return bookings.filter(booking => booking.status === "pending_completion").length;
  };

  // Add this function to extract booking details from notes
  const extractBookingDetails = (notes: string) => {
    if (!notes) return { date: null, time: null, location: null };

    const dateMatch = notes.match(/Date: (.+?)\n/);
    const timeMatch = notes.match(/Time: (.+?)\n/);
    const locationMatch = notes.match(/Location: (.+?)(?:\n|$)/);

    return {
      date: dateMatch ? dateMatch[1] : null,
      time: timeMatch ? timeMatch[1] : null,
      location: locationMatch ? locationMatch[1] : null
    };
  };

  // Function to handle confirming service completion
  const handleConfirmCompletion = async (bookingId: string) => {
    try {
      // Update booking status to completed
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: "completed",
        })
        .eq('id', bookingId);
        
      if (error) throw error;
      
      // Release payment if there is one
      const { data: paymentData } = await supabase
        .from('escrow_payments')
        .select('id')
        .eq('booking_id', bookingId)
        .single();
        
      if (paymentData?.id) {
        // In a real app, properly handle payment release here
        console.log(`Payment ${paymentData.id} released for booking ${bookingId}`);
      }
      
      // Send notification to provider
      const booking = bookings.find(b => b.id === bookingId);
      if (booking?.provider_id) {
        await createNotification({
          userId: booking.provider_id,
          actorId: user?.id,
          type: 'booking_completion',
          message: `Customer has confirmed the completion of service "${booking.services?.title || 'your service'}"`,
          linkType: 'booking',
          linkId: bookingId
        });
      }
      
      // Update UI by refetching bookings
      fetchBookings();
      
      toast({
        title: "Service Completed",
        description: "You have successfully confirmed the service completion",
      });
    } catch (error) {
      console.error("Error confirming completion:", error);
      toast({
        title: "Error",
        description: "Failed to confirm service completion. Please try again.",
        variant: "destructive",
      });
    }
  };

  // UI rendering
  const renderServicesContent = () => (
    <>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-8 gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1">Services Dashboard</h1>
          <p className="text-muted-foreground">
            {userRole === "business" 
              ? "Manage your services and view booking requests" 
              : "View and manage your bookings"}
          </p>
        </div>
        {userRole === "business" && (
          <Button onClick={() => setShowAddModal(true)}>
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">Add Service</span>
            <span className="sm:hidden">Add</span>
          </Button>
        )}
      </div>

      {authLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Loading your services...</p>
          </div>
        </Card>
      ) : !isAuthenticated ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Sign in to access your Services Dashboard</h2>
          <p className="mb-6 text-muted-foreground">
            You need to be signed in to view your services and manage bookings.
          </p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </Card>
      ) : (
        <ServiceDashboard 
          services={services} 
          loading={loadingServices} 
          userRole={userRole || "customer"} 
          onRefresh={fetchServices} 
        />
      )}

      <AddServiceModal 
        isOpen={showAddModal} 
        onClose={() => setShowAddModal(false)} 
        onServiceAdded={handleServiceAdded} 
      />
    </>
  );

  const renderBookingsContent = () => (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-3xl font-bold">Your Bookings</h1>
      </div>

      {authLoading ? (
        <Card className="p-8">
          <div className="flex items-center justify-center space-x-2">
            <Loader2 className="h-5 w-5 animate-spin" />
            <p>Loading your bookings...</p>
          </div>
        </Card>
      ) : !isAuthenticated ? (
        <Card className="p-8 text-center">
          <h2 className="text-xl font-semibold mb-4">Sign in to view your bookings</h2>
          <p className="mb-6 text-muted-foreground">
            You need to be signed in to view and manage your bookings.
          </p>
          <Button onClick={() => navigate("/auth")}>Sign In</Button>
        </Card>
      ) : userRole === "business" ? (
        <Card className="p-8 text-center">
          <Shield className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
          <h2 className="text-xl font-semibold mb-4">Business Account</h2>
          <p className="mb-6 text-muted-foreground">
            Only customer accounts can book services. As a business account, you can provide 
            services but cannot make bookings. To make bookings, please create a customer account.
          </p>
          <Button onClick={() => navigate(pageType === "bookings" ? "/services" : "/bookings")}>
            {pageType === "bookings" ? "Go to Services" : "Go to Bookings"}
          </Button>
        </Card>
      ) : (
        <>
          <div className="space-y-4 mb-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
              <h3 className="text-2xl font-bold">My Bookings</h3>
              <Input
                placeholder="Search bookings..."
                className="max-w-xs"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {pendingCompletionBookings.length > 0 && (
              <Card className="bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800">
                <CardContent className="p-4">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between">
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-500 mt-0.5" />
                      <div>
                        <h4 className="font-medium text-yellow-800 dark:text-yellow-400">Service Completion Confirmation</h4>
                        <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-1">
                          You have {pendingCompletionBookings.length} {pendingCompletionBookings.length === 1 ? 'service' : 'services'} that need your confirmation to complete.
                        </p>
                      </div>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-yellow-600 text-yellow-700 hover:text-yellow-800 hover:bg-yellow-100 dark:text-yellow-400 dark:hover:text-yellow-300 dark:hover:bg-yellow-900/40"
                      onClick={() => navigate(`/bookings/${pendingCompletionBookings[0].id}`)}
                    >
                      <CheckCircle className="h-4 w-4 mr-2" />
                      View & Confirm
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}
            
            <Tabs defaultValue={statusTab} onValueChange={setStatusTab} className="w-full">
              <TabsList className="grid grid-cols-4 mb-4">
                <TabsTrigger value="pending">Pending</TabsTrigger>
                <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
                <TabsTrigger value="completed">Completed</TabsTrigger>
                <TabsTrigger value="canceled">Canceled</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          {loadingBookings ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {Array(3).fill(0).map((_, index) => (
                <Card key={index} className="overflow-hidden animate-pulse">
                  <div className="h-48 bg-black/20"></div>
                  <CardContent className="p-4">
                    <div className="h-6 bg-black/20 rounded w-3/4 mb-2"></div>
                    <div className="h-4 bg-black/20 rounded w-1/2 mb-4"></div>
                    <div className="h-4 bg-black/20 rounded w-full mb-2"></div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : filteredBookings.length === 0 ? (
            <div className="text-center py-16 border rounded-lg border-dashed">
              <h3 className="text-lg font-semibold mb-2">No bookings found</h3>
              <p className="text-muted-foreground mb-4">
                {searchQuery
                  ? "Try adjusting your search query"
                  : `You don't have any ${statusTab} bookings`}
              </p>
              <Button onClick={() => navigate("/discover?tab=services")}>
                Discover Services
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredBookings.map((booking) => (
                <Card 
                  key={booking.id}
                  className="overflow-hidden hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => handleOpenBooking(booking)}
                >
                  <div className="relative h-48 overflow-hidden">
                    {booking.services?.image ? (
                      <img 
                        src={booking.services.image}
                        alt={booking.services.title}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center">
                        <span className="text-2xl font-bold text-muted-foreground">
                          {booking.services?.title?.charAt(0).toUpperCase() || "?"}
                        </span>
                      </div>
                    )}
                    <Badge 
                      className={`absolute top-2 right-2 ${booking.status === "pending_completion" ? "bg-amber-100 text-amber-800 border-amber-200 hover:bg-amber-100" : ""}`}
                      variant={
                        booking.status === "completed" ? "default" :
                        booking.status === "confirmed" ? "outline" :
                        booking.status === "pending" ? "secondary" : 
                        booking.status === "pending_completion" ? "outline" : "destructive"
                      }
                    >
                      {booking.status === "pending_completion" 
                        ? "Awaiting Confirmation" 
                        : booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                    </Badge>
                  </div>
                  
                  <CardContent className="p-4">
                    <h3 className="font-semibold text-lg mb-2">{booking.services?.title}</h3>
                    
                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {booking.notes ? 
                              extractBookingDetails(booking.notes).date : 
                              new Date(booking.scheduled_time).toLocaleDateString()}
                          </span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>
                            {booking.notes ? 
                              extractBookingDetails(booking.notes).time : 
                              new Date(booking.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                          </span>
                        </div>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm">
                        <MapPin className="h-3 w-3 text-muted-foreground" />
                        <span>
                          {booking.notes ? 
                            extractBookingDetails(booking.notes).location : 
                            (booking.location || booking.services?.location)}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1 text-sm">
                        <span className="text-muted-foreground">{symbol}</span>
                        <span>{formatPrice(booking.services?.price, 'USD')}</span>
                      </div>
                    </div>
                    
                    <div className="flex items-center justify-between">
                      <div 
                        className="flex items-center gap-2 cursor-pointer hover:text-primary transition-colors"
                        onClick={(e) => {
                          e.stopPropagation(); // Prevent triggering the card click
                          navigate(`/user/${booking.provider_id}`);
                        }}
                      >
                        <Avatar className="h-6 w-6">
                          <AvatarImage src={booking.provider?.avatar_url} />
                          <AvatarFallback>
                            {booking.provider?.username?.charAt(0).toUpperCase() || "P"}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm">{booking.provider?.username}</span>
                      </div>
                      
                      <ChevronRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                  </CardContent>
                  
                  <CardFooter className="p-4 pt-0 flex gap-2">
                    {booking.status === "pending" && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex-1"
                        onClick={(e) => handleOpenBooking(booking)}
                      >
                        View Booking
                      </Button>
                    )}
                    
                    {booking.status === "pending_completion" && (
                      <Button 
                        variant="default" 
                        size="sm" 
                        className="flex-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/bookings/${booking.id}`);
                        }}
                      >
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Confirm Completion
                      </Button>
                    )}
                    
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="flex-1"
                      onClick={(e) => handleContactProvider(booking.provider_id, e)}
                    >
                      <MessageSquare className="h-3 w-3 mr-1" />
                      Contact
                    </Button>
                    
                    {booking.status === "completed" && 
                     !hasUserLeftReview(booking) && 
                     booking.provider_id !== user?.id && 
                     booking.services?.owner_id !== user?.id && (
                      <Button 
                        variant="secondary" 
                        size="sm" 
                        className="flex-1"
                        onClick={(e) => handleOpenReviewModal(booking, e)}
                        title={`Review ${booking.provider?.username}`}
                      >
                        <Star className="h-3 w-3 mr-1" />
                        Review Provider
                      </Button>
                    )}
                    
                    {booking.status === "completed" && 
                     booking.escrow_payments?.length > 0 && 
                     booking.escrow_payments[0].status !== "disputed" && (
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="flex-1"
                        onClick={(e) => handleOpenDisputeModal(booking, e)}
                      >
                        <ThumbsDown className="h-3 w-3 mr-1" />
                        Dispute
                      </Button>
                    )}
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}

          {/* Review Modal */}
          <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Leave a Review</DialogTitle>
                {selectedBooking && (
                  <DialogDescription>
                    You're reviewing "{selectedBooking.services?.title}" provided by {selectedBooking.provider?.username}
                  </DialogDescription>
                )}
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                {selectedBooking && (
                  <div className="flex items-center space-x-3 mb-2">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={selectedBooking.provider?.avatar_url} />
                      <AvatarFallback>
                        {selectedBooking.provider?.username?.charAt(0).toUpperCase() || "P"}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <p className="font-semibold">{selectedBooking.provider?.username}</p>
                      <p className="text-sm text-muted-foreground">Service Provider</p>
                    </div>
                  </div>
                )}
              
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Rating</label>
                  <StarRating 
                    value={reviewRating} 
                    onChange={setReviewRating} 
                    size={window.innerWidth}
                  />
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Your Review</label>
                  <Textarea 
                    placeholder="Share your experience with this service..." 
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    rows={5}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowReviewModal(false)}>
                  Cancel
                </Button>
                <Button 
                  onClick={handleSubmitReview}
                  disabled={submittingReview || !reviewContent.trim()}
                >
                  {submittingReview && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Review
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Dispute Modal */}
          <Dialog open={showDisputeModal} onOpenChange={setShowDisputeModal}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report an Issue</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 text-amber-500 rounded-md">
                  <Info className="h-5 w-5 flex-shrink-0" />
                  <p className="text-sm">
                    Disputes are reviewed by our team and may take 3-5 business days to process.
                  </p>
                </div>
                
                <div className="flex flex-col gap-2">
                  <label className="text-sm font-medium">Reason for Dispute</label>
                  <Textarea 
                    placeholder="Please describe the issue in detail..." 
                    value={disputeReason}
                    onChange={(e) => setDisputeReason(e.target.value)}
                    rows={5}
                  />
                </div>
              </div>
              
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowDisputeModal(false)}>
                  Cancel
                </Button>
                <Button 
                  variant="destructive"
                  onClick={handleSubmitDispute}
                  disabled={submittingDispute || !disputeReason.trim()}
                >
                  {submittingDispute && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Submit Dispute
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Confirmation modal for cancellation */}
          <Dialog open={!!bookingToCancel} onOpenChange={(open) => !open && setBookingToCancel(null)}>
            <DialogContent className="sm:max-w-[425px]">
              <DialogHeader>
                <DialogTitle>Cancel Booking</DialogTitle>
                <DialogDescription>
                  Are you sure you want to cancel this booking? This action cannot be undone.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-amber-500" />
                  <p className="text-sm text-muted-foreground">
                    Cancellation may be subject to the service provider's cancellation policy.
                  </p>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setBookingToCancel(null)}>
                  No, Keep Booking
                </Button>
                <Button 
                  variant="destructive" 
                  onClick={handleCancelBooking}
                  disabled={cancellationLoading}
                >
                  {cancellationLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Cancelling...
                    </>
                  ) : (
                    "Yes, Cancel Booking"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </>
      )}
    </div>
  );

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab} userRole={userRole} isAuthenticated={isAuthenticated}>
      <div className="w-full min-h-screen overflow-x-hidden pb-16 md:pb-0">
        {pageType === "services" ? renderServicesContent() : renderBookingsContent()}
      </div>
    </MainLayout>
  );
} 