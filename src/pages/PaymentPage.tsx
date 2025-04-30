import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { 
  Loader2, 
  Shield, 
  CheckCircle, 
  CreditCard, 
  Calendar, 
  Clock,
  Lock, 
  Info, 
  ArrowLeft,
  DollarSign,
  Globe,
  AlertTriangle,
  MessageSquare
} from "lucide-react";
import { MainLayout } from "@/layouts/MainLayout";
import { supabase } from "@/integrations/supabase/client";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/components/ui/use-toast";
import { EscrowService } from "@/utils/escrow-service";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCurrency } from "@/contexts/CurrencyContext";

// Add PaystackPop type definition
declare global {
  interface Window {
    PaystackPop: {
      setup: (config: {
        key: string;
        email: string;
        amount: number;
        currency: string;
        ref: string;
        callback: (response: any) => void;
        onClose: () => void;
      }) => {
        openIframe: () => void;
      };
    };
  }
}

// Payment gateway endpoints - replace with your actual endpoints in production
const STRIPE_CHECKOUT_URL = "/api/create-checkout-session";
const PAYSTACK_CHECKOUT_URL = "/api/create-paystack-session";

// Countries where Paystack is available
const PAYSTACK_SUPPORTED_COUNTRIES = [
  "nigeria", "ghana", "kenya", "south africa", "uganda", 
  "tanzania", "rwanda", "mauritius", "malawi", "ethiopia"
];

// Test countries for dropdown
const TEST_COUNTRIES = [
  { value: "nigeria", label: "Nigeria (Paystack)" },
  { value: "ghana", label: "Ghana (Paystack)" },
  { value: "usa", label: "USA (Stripe)" },
  { value: "uk", label: "UK (Stripe)" },
  { value: "canada", label: "Canada (Stripe)" }
];

// Local storage key for saving country preference
const COUNTRY_STORAGE_KEY = "ventureezon_test_country";

export default function PaymentPage() {
  const { bookingId } = useParams<{ bookingId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useUser();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [processingPayment, setProcessingPayment] = useState(false);
  const [booking, setBooking] = useState<any>(null);
  const [service, setService] = useState<any>(null);
  const [provider, setProvider] = useState<any>(null);
  const [paymentComplete, setPaymentComplete] = useState(false);
  const [escrowPayment, setEscrowPayment] = useState<any>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("Payments");
  const [userCountry, setUserCountry] = useState<string | null>(null);
  const [preferredGateway, setPreferredGateway] = useState<'stripe' | 'paystack'>('stripe');
  const [detectingLocation, setDetectingLocation] = useState(true);
  const { formatPrice, symbol, currency } = useCurrency();

  // Add a useEffect to track when the user data is loaded
  useEffect(() => {
    if (user) {
      setAuthLoading(false);
      fetchUserCountry();
    }
  }, [user]);

  // Detect user's country
  const fetchUserCountry = async () => {
    setDetectingLocation(true);
    try {
      // Try to get country from user profile
      const { data: profileData, error } = await supabase
        .from('profiles')
        .select('country')
        .eq('id', user!.id)
        .single();
      
      if (!error && profileData?.country) {
        handleCountryDetected(profileData.country.toLowerCase());
      } else {
        // Default to Stripe if country detection fails
        setPreferredGateway('stripe');
      }
    } catch (error) {
      console.error("Error detecting country:", error);
      // Default to Stripe if detection fails
      setPreferredGateway('stripe');
    } finally {
      setDetectingLocation(false);
    }
  };

  // Handle detected country
  const handleCountryDetected = (country: string) => {
    setUserCountry(country);
    
    // Set preferred gateway based on country
    if (PAYSTACK_SUPPORTED_COUNTRIES.includes(country)) {
      setPreferredGateway('paystack');
    } else {
      setPreferredGateway('stripe');
    }
  };

  // Check for payment success from redirect
  useEffect(() => {
    const query = new URLSearchParams(location.search);
    const paymentStatus = query.get('payment_status');
    const reference = query.get('reference'); // For Paystack
    const source = query.get('source'); // Added to identify payment source
    
    if ((paymentStatus === 'success' || reference) && booking) {
      // Set the preferred gateway based on the payment source
      if (source === 'paystack') {
        setPreferredGateway('paystack');
      } else if (source === 'stripe') {
        setPreferredGateway('stripe');
      }
      
      handlePaymentSuccess();
    }
  }, [location.search, booking]);

  // Handle successful payment
  const handlePaymentSuccess = async () => {
    if (!user || !booking || !service) {
      return;
    }
    
    setProcessingPayment(true);
    console.log("Processing payment for booking:", booking.id, "Current status:", booking.status);
    
    try {
      let paymentId;
      
      // Check if payment record already exists
      if (escrowPayment) {
        paymentId = escrowPayment.id;
        
        // Process the existing payment record
        const success = await EscrowService.processPayment(
          paymentId, 
          preferredGateway // Pass the payment gateway
        );
        
        if (!success) {
          throw new Error("Failed to process payment");
        }
      } else {
        // Create a new escrow payment
        const payment = await EscrowService.createPayment(
          booking.id,
          service.price,
          user.id,
          booking.provider_id,
          service.id,
          false, // Not external
          undefined, // No payment ID yet
          preferredGateway // Pass the payment gateway
        );
        
        if (!payment) {
          throw new Error("Failed to create payment");
        }
        
        paymentId = payment.id;
        setEscrowPayment(payment);
      }
      
      // Update booking status from draft to pending (awaiting provider confirmation)
      // Only update the status if it's currently in draft state
      const { error: updateError } = await supabase
        .from("bookings")
        .update({
          status: booking.status === "draft" ? "pending" : booking.status, // Only update if draft
          payment_status: "completed",
        })
        .eq("id", booking.id);
      
      if (updateError) {
        console.error("Error updating booking status:", updateError);
        toast({
          title: "Warning",
          description: "Payment processed but booking status update failed. Please contact support.",
          variant: "destructive",
        });
      } else {
        console.log("Successfully updated booking status from draft to pending");
      }
      
      // Create a notification for the service provider
      try {
        await supabase.from("notifications").insert({
          user_id: booking.provider_id, // Send to service provider
          type: "booking",
          title: "New Booking Payment",
          message: `A customer has paid for their booking for ${service.title}`,
          is_read: false,
          data: JSON.stringify({
            booking_id: booking.id,
            service_id: service.id,
            service_title: service.title,
            payment_gateway: preferredGateway
          }),
        });
      } catch (notificationError) {
        console.error("Error creating notification:", notificationError);
        // Continue even if notification fails
      }
      
      // Show success state
      setPaymentComplete(true);
      
      toast({
        title: "Payment successful",
        description: "Your payment has been processed and your booking is now confirmed",
      });
    } catch (error) {
      console.error("Error processing payment:", error);
      toast({
        title: "Payment failed",
        description: "There was an error processing your payment. Please try again.",
        variant: "destructive",
      });
    } finally {
      setProcessingPayment(false);
    }
  };

  // Redirect to Stripe checkout
  const redirectToStripeCheckout = async () => {
    if (!user || !booking || !service) {
      toast({
        title: "Missing information",
        description: "Required information is missing. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);

    try {
      const amounts = calculateAmounts();
      
      // Call the real API endpoint
      const response = await fetch(STRIPE_CHECKOUT_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          booking_id: booking.id,
          service_id: service.id,
          customer_id: user.id,
          provider_id: service.user_id,
          amount: amounts.total.toString(),
          success_url: `${window.location.origin}/payment/${booking.id}?payment_status=success&source=stripe`,
          cancel_url: `${window.location.origin}/payment/${booking.id}?payment_status=canceled&source=stripe`
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to create checkout session');
      }

      const sessionData = await response.json();
      
      // Redirect to the Stripe hosted checkout page
      window.location.href = sessionData.url;
    } catch (error) {
      console.error('Stripe checkout error:', error);
      setProcessingPayment(false);
      toast({
        title: "Payment failed",
        description: error instanceof Error ? error.message : "An error occurred during payment processing. Please try again.",
        variant: "destructive",
      });
    }
  };

  // Redirect to Paystack checkout
  const redirectToPaystackCheckout = () => {
    if (!user || !booking || !service) {
      toast({
        title: "Missing information",
        description: "Required information is missing. Please try again.",
        variant: "destructive",
      });
      return;
    }

    setProcessingPayment(true);

    try {
      // Check if Paystack JS is loaded
      if (typeof window.PaystackPop === 'undefined') {
        // Load Paystack script if not already loaded
        const script = document.createElement('script');
        script.src = 'https://js.paystack.co/v1/inline.js';
        script.async = true;
        script.onload = () => {
          // Once script is loaded, initialize payment
          initializePaystackPayment();
        };
        script.onerror = () => {
          throw new Error('Failed to load Paystack script');
        };
        document.body.appendChild(script);
      } else {
        // If already loaded, initialize payment directly
        initializePaystackPayment();
      }
    } catch (error) {
      console.error('Paystack initialization error:', error);
      toast({
        title: "Payment Failed",
        description: "Unable to initialize Paystack payment. Please try again.",
        variant: "destructive",
      });
      setProcessingPayment(false);
    }
  };

  // Initialize Paystack payment with inline JS
  const initializePaystackPayment = () => {
    // Calculate final amount
    const { total } = calculateAmounts();
    const amountInKobo = Math.round(total * 100); // Convert to kobo (smallest currency unit)
    
    console.log(`Initializing Paystack with: ${user!.email}, amount: ${amountInKobo}, ref: booking_${booking!.id}_${Date.now()}`);
    
    try {
      const handler = window.PaystackPop.setup({
        key: 'pk_test_your_public_key', // Replace with your Paystack public key in production
        email: user!.email!,
        amount: amountInKobo,
        currency: currency === 'NGN' ? 'NGN' : 'USD', // Use NGN for Nigeria, USD for others
        ref: `booking_${booking!.id}_${Date.now()}`,
        callback: async function(response: any) {
          console.log('Paystack payment successful:', response);
          
          try {
            // Create escrow payment record
            const payment = await EscrowService.createPayment(
              booking!.id,
              service!.price,
              user!.id,
              booking!.provider_id,
              service!.id,
              false, // Not external
              undefined, // No payment ID
              'paystack', // Gateway
              response.reference // Transaction reference
            );
            
            if (!payment) {
              throw new Error('Failed to create payment record');
            }
            
            setEscrowPayment(payment);
            
            // Update URL with success parameters without reloading
            const newUrl = `${window.location.pathname}?payment_status=success&reference=${response.reference}&source=paystack`;
            window.history.pushState({ path: newUrl }, '', newUrl);
            
            // Handle payment success
            handlePaymentSuccess();
          } catch (error) {
            console.error('Error processing successful payment:', error);
            toast({
              title: "Payment Processing Error",
              description: "Your payment was successful, but we couldn't process your booking. Please contact support.",
              variant: "destructive",
            });
            setProcessingPayment(false);
          }
        },
        onClose: function() {
          console.log('Paystack payment window closed');
          toast({
            title: "Payment Cancelled",
            description: "You've cancelled the payment process. Your booking is not confirmed.",
            variant: "default",
          });
          setProcessingPayment(false);
        }
      });
      
      handler.openIframe();
    } catch (error) {
      console.error('Error in Paystack setup:', error);
      toast({
        title: "Payment Error",
        description: "There was a problem setting up the payment. Please try again.",
        variant: "destructive",
      });
      setProcessingPayment(false);
    }
  };

  // Load booking details
  useEffect(() => {
    // Don't do anything until we know if the user is authenticated
    if (authLoading) {
      return;
    }
    
    if (!bookingId || !user) {
      toast({
        title: "Authentication required",
        description: "Please log in to complete your payment",
        variant: "destructive",
      });
      navigate("/auth");
      return;
    }

    async function fetchBookingData() {
      try {
        setLoading(true);
        
        // Check if user is a business account
        const { data: userData, error: userError } = await supabase
          .from('profiles')
          .select('user_role')
          .eq('id', user.id)
          .single();
          
        if (!userError && userData?.user_role === "business") {
          toast({
            title: "Access Denied",
            description: "Business accounts cannot make bookings or payments for services. Please use a customer account.",
            variant: "destructive",
          });
          navigate("/profile");
          return;
        }
        
        // First check if the booking exists and belongs to the user
        const { data: bookingData, error: bookingError } = await supabase
          .from("bookings")
          .select(`
            *,
            provider:profiles!provider_id(
              id,
              username,
              avatar_url,
              business_name
            ),
            escrow_payments(*)
          `)
          .eq("id", bookingId);
        
        if (bookingError) {
          console.error("Error fetching booking:", bookingError);
          toast({
            title: "Error",
            description: "Could not load booking details. Please try again.",
            variant: "destructive",
          });
          navigate("/bookings");
          return;
        }
        
        if (!bookingData || bookingData.length === 0) {
          toast({
            title: "Booking not found",
            description: "The booking you're trying to pay for could not be found",
            variant: "destructive",
          });
          navigate("/bookings");
          return;
        }
        
        const bookingEntry = bookingData[0];
        
        // Check if the booking belongs to the current user
        if (bookingEntry.customer_id !== user.id) {
          toast({
            title: "Access Denied",
            description: "You do not have permission to access this booking",
            variant: "destructive",
          });
          navigate("/bookings");
          return;
        }
        
        setBooking(bookingEntry);
        
        // Check if payment already exists
        if (bookingEntry.escrow_payments && bookingEntry.escrow_payments.length > 0) {
          setEscrowPayment(bookingEntry.escrow_payments[0]);
          
          // If payment is already completed or processed, show completed state
          if (
            bookingEntry.escrow_payments[0].status === "completed" ||
            bookingEntry.escrow_payments[0].status === "released" ||
            bookingEntry.payment_status === "completed"
          ) {
            setPaymentComplete(true);
          }
        }
        
        // Fetch service details
        const { data: serviceData, error: serviceError } = await supabase
          .from("services")
          .select("*")
          .eq("id", bookingEntry.service_id)
          .single();
        
        if (serviceError) {
          console.error("Error fetching service:", serviceError);
          toast({
            title: "Error",
            description: "Could not load service details. Please try again.",
            variant: "destructive",
          });
          // Don't redirect - still show payment page with the booking details we have
        } else {
          setService(serviceData);
        }
        
        setProvider(bookingEntry.provider);
      } catch (error) {
        console.error("Error fetching booking data:", error);
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive",
        });
        // Don't immediately redirect - let the user decide
      } finally {
        setLoading(false);
      }
    }
    
    fetchBookingData();
  }, [bookingId, user, navigate, toast, authLoading]);

  // Extract booking details from notes
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

  // Calculate amounts
  const calculateAmounts = () => {
    if (!service) return { subtotal: 0, fee: 0, total: 0 };
    
    const subtotal = service.price;
    
    // Use fixed fee calculation instead of percentage
    const fee = calculateFixedPlatformFee(subtotal);
    const total = subtotal + fee;
    
    return { subtotal, fee, total };
  };

  // Format the platform fee based on the currency
  const formatPlatformFee = (fee: number): string => {
    console.log("Formatting platform fee:", fee, "Currency:", currency);
    
    if (currency === 'NGN') {
      // For NGN, directly use the symbol and the fee without conversion
      return `${symbol}${fee}`;
    } else {
      // For other currencies, use the normal formatPrice function
      return formatPrice(fee);
    }
  };

  // Fixed fee calculation (matching the MultiStepBookingModal.tsx implementation)
  const calculateFixedPlatformFee = (amount: number): number => {
    console.log(`Payment page calculating fee for amount: ${amount} in currency: ${currency}`);
    
    // For Naira (NGN) currency
    if (currency === 'NGN') {
      // Fixed fee structure for Naira
      let fee = 0;
      if (amount <= 3000) fee = 100;
      else if (amount <= 6000) fee = 200;
      else if (amount <= 10000) fee = 300;
      else if (amount <= 20000) fee = 400;
      else if (amount <= 50000) fee = 500;
      else if (amount <= 100000) fee = 600;
      else if (amount <= 500000) fee = 800;
      else if (amount <= 1000000) fee = 1000;
      else if (amount <= 2000000) fee = 1500;
      else fee = 2000; // for 2 million and above
      
      console.log(`NGN fee calculated: ${fee} for amount ${amount}`);
      return fee;
    }
    
    // For other currencies (USD, etc.)
    if (currency === 'USD') {
      let fee = 0;
      if (amount <= 2) fee = 0.07;
      else if (amount <= 4) fee = 0.13;
      else if (amount <= 7) fee = 0.20;
      else if (amount <= 15) fee = 0.27;
      else if (amount <= 35) fee = 0.33;
      else if (amount <= 70) fee = 0.40;
      else if (amount <= 350) fee = 0.53;
      else if (amount <= 700) fee = 0.67;
      else if (amount <= 1400) fee = 1.00;
      else fee = 1.33;
      
      console.log(`USD fee calculated: ${fee} for amount ${amount}`);
      return fee;
    }
    
    // Default fallback - use NGN structure if currency not specifically handled
    const exchangeRates = { NGN: 1, USD: 1500 }; // Simplified rate table
    const rate = exchangeRates[currency as keyof typeof exchangeRates] || 1;
    const amountInNgn = amount * rate;
    
    let fee = 0;
    if (amountInNgn <= 3000) fee = 100 / rate;
    else if (amountInNgn <= 6000) fee = 200 / rate;
    else if (amountInNgn <= 10000) fee = 300 / rate;
    else if (amountInNgn <= 20000) fee = 400 / rate;
    else if (amountInNgn <= 50000) fee = 500 / rate;
    else if (amountInNgn <= 100000) fee = 600 / rate;
    else if (amountInNgn <= 500000) fee = 800 / rate;
    else if (amountInNgn <= 1000000) fee = 1000 / rate;
    else if (amountInNgn <= 2000000) fee = 1500 / rate;
    else fee = 2000 / rate;
    
    console.log(`Converted fee calculated: ${fee} for amount ${amount} in ${currency} (converted from NGN)`);
    return fee;
  };

  // Render payment options form
  const renderPaymentForm = () => (
    <Card>
      <CardHeader>
        <CardTitle>Complete Payment</CardTitle>
        <CardDescription>
          Secure payment processing with escrow protection
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Alert className="bg-blue-900 border-blue-200">
          <Shield className="h-4 w-4 text-blue-600" />
          <AlertTitle>Protected by Escrow</AlertTitle>
          <AlertDescription>
            Your payment will be held securely until the service is completed. If the service provider cancels or there are disputes, 
            your money will be refunded immediately.
          </AlertDescription>
        </Alert>
        
        <div className="space-y-4">
          {detectingLocation ? (
            <div className="text-center py-2">
              <Loader2 className="h-4 w-4 animate-spin mx-auto mb-2" />
              <span className="text-sm text-muted-foreground">Preparing payment options...</span>
            </div>
          ) : (
            <>
              {PAYSTACK_SUPPORTED_COUNTRIES.includes(userCountry || '') ? (
                // Show Paystack for supported countries
                <div className="space-y-4">
                  <Button 
                    className="w-full bg-green-600 hover:bg-green-700" 
                    disabled={processingPayment}
                    onClick={redirectToPaystackCheckout}
                  >
                    {processingPayment ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Processing Payment...
                      </>
                    ) : (
                      <>
                        <span className="mr-2">{symbol}</span>
                        Pay {currency === 'NGN' ? `${calculateAmounts().total}` : formatPrice(calculateAmounts().total)} with Paystack
                      </>
                    )}
                  </Button>
                  <div className="flex items-center justify-center text-xs text-muted-foreground gap-1">
                    <Lock className="h-3 w-3" />
                    Secure Payment Processing with Paystack
                  </div>
                </div>
              ) : (
                // For countries where Paystack is not supported
                <div className="space-y-4">
                  <Alert className="bg-amber-900 border-amber-200">
                    <AlertTriangle className="h-4 w-4 text-amber-600" />
                    <AlertTitle>Online Payment Not Available</AlertTitle>
                    <AlertDescription>
                      Online payments are currently only available in Nigeria, Ghana, South Africa, and Kenya through Paystack.
                      Stripe payments will be available soon. For now, please coordinate with the service provider for direct payment.
                    </AlertDescription>
                  </Alert>
                  
                  <Button 
                    variant="outline"
                    className="w-full" 
                    onClick={() => navigate(`/messages?user=${booking.provider_id}`)}
                  >
                    <MessageSquare className="mr-2 h-4 w-4" />
                    Contact Service Provider
                  </Button>
                  
                  <div className="text-center text-sm text-muted-foreground">
                    <Globe className="inline h-3 w-3 mr-1" />
                    We're working to expand our payment options to more countries soon.
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );

  if (authLoading || loading) {
    return (
      <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="container min-h-screen py-10">
          <div className="flex flex-col items-center justify-center py-12 space-y-4">
            <Loader2 className="h-12 w-12 animate-spin" />
            <div className="text-center">
              <h2 className="text-xl font-semibold mb-1">Loading Payment Details</h2>
              <p className="text-muted-foreground">Please wait while we prepare your payment...</p>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  // If payment is complete, show success screen
  if (paymentComplete) {
    return (
      <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
        <div className="container min-h-screen max-w-4xl py-10">
          <div className="flex flex-col items-center text-center px-4 py-10">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <CheckCircle className="h-8 w-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold mb-2">Payment Successful!</h1>
            <p className="text-muted-foreground mb-6 max-w-md">
              Your payment of {formatPrice(calculateAmounts().total)} has been processed and is securely held in escrow until the service is completed.
            </p>
            
            <Card className="w-full max-w-md mb-6">
              <CardHeader>
                <CardTitle>Payment Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex justify-between">
                  <span>Service Fee</span>
                  <span>{formatPrice(calculateAmounts().subtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Platform Fee</span>
                  <span>{formatPlatformFee(calculateAmounts().fee)}</span>
                </div>
                <Separator />
                <div className="flex justify-between font-bold">
                  <span>Total</span>
                  <span>{formatPrice(calculateAmounts().total)}</span>
                </div>
              </CardContent>
              <CardFooter className="bg-muted/20 flex flex-col items-start p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Protected by Escrow</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your payment is held securely until the service is completed. If there are any issues, 
                  our team will help resolve them.
                </p>
              </CardFooter>
            </Card>
            
            <div className="flex flex-wrap gap-4">
              <Button variant="outline" onClick={() => navigate("/bookings")}>
                View My Bookings
              </Button>
              <Button onClick={() => navigate(`/messages?user=${booking.provider_id}`)}>
                Message Service Provider
              </Button>
            </div>
          </div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout activeTab={activeTab} setActiveTab={setActiveTab}>
      <div className="container min-h-screen max-w-4xl py-10">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(-1)}
          className="mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back
        </Button>
        
        <h1 className="text-2xl font-bold mb-2">Complete Your Booking</h1>
        <p className="text-muted-foreground mb-8">
          Your payment will be securely held in escrow until the service is completed
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Payment Form Column */}
          <div className="md:col-span-2 space-y-6">
            {renderPaymentForm()}
            
            <Card>
              <CardHeader>
                <CardTitle>Important Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">About Escrow Payments</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    When you pay for a service, your money is held in escrow until the service is completed. 
                    This ensures that service providers only get paid for completed work, and you're protected if anything goes wrong.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Info className="h-4 w-4 text-blue-500" />
                    <span className="font-medium">What Happens Next?</span>
                  </div>
                  <ol className="text-sm text-muted-foreground space-y-1 list-decimal pl-4">
                    <li>Service provider reviews and confirms your booking</li>
                    <li>You'll receive confirmation and can coordinate details via messaging</li>
                    <li>Once the service is completed, confirm completion to release payment</li>
                    <li>If there are any issues, our team can help resolve disputes</li>
                  </ol>
                </div>
              </CardContent>
            </Card>
          </div>
          
          {/* Order Summary Column */}
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Order Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 border rounded-lg bg-muted/20">
                  <h3 className="font-medium mb-2">{service?.title}</h3>
                  
                  {booking?.notes && (
                    <div className="space-y-2 mb-4">
                      {extractBookingDetails(booking.notes).date && (
                        <div className="text-sm flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span>{extractBookingDetails(booking.notes).date}</span>
                        </div>
                      )}
                      
                      {extractBookingDetails(booking.notes).time && (
                        <div className="text-sm flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span>{extractBookingDetails(booking.notes).time}</span>
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="space-y-2 border-t pt-2 mt-2">
                    <div className="flex items-center justify-between text-sm">
                      <span>Service provider:</span>
                      <span>{provider?.business_name || provider?.username}</span>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3">
                  <div className="flex justify-between">
                    <span>Service Fee</span>
                    <span>{formatPrice(calculateAmounts().subtotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Platform Fee</span>
                    <span>{formatPlatformFee(calculateAmounts().fee)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold">
                    <span>Total</span>
                    <span>{formatPrice(calculateAmounts().total)}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Shield className="h-4 w-4 text-green-600" />
                  <span className="font-medium">Escrow Protection</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your payment is held securely until you confirm the service has been completed successfully.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </MainLayout>
  );
} 