import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { MainLayout } from "@/layouts/MainLayout";
import { EscrowService } from "@/utils/escrow-service";
import {
  Calendar,
  Clock,
  MapPin,
  DollarSign,
  User,
  MessageSquare,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  CreditCard,
  Shield
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { CustomerConfirmationModal } from "@/components/services/CustomerConfirmationModal";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { BookingPaymentCard } from "@/components/services/BookingPaymentCard";
import { useCurrency } from "@/contexts/CurrencyContext";

export default function BookingDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useUser();
  const { toast } = useToast();
  const [booking, setBooking] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [makingPayment, setMakingPayment] = useState(false);
  const { formatPrice } = useCurrency();
  const [confirming, setConfirming] = useState(false);
  const [disputing, setDisputing] = useState(false);

  useEffect(() => {
    fetchBookingDetails();
  }, [id]);

  const fetchBookingDetails = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from("bookings")
        .select(`
          *,
          services(*),
          provider:profiles!provider_id(
            id,
            username,
            avatar_url,
            kyc_verified
          ),
          customer:profiles!customer_id(
            id,
            username,
            avatar_url,
            kyc_verified
          ),
          escrow_payments(*)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      
      if (!data) {
        toast({
          title: "Error",
          description: "Booking not found",
          variant: "destructive",
        });
        navigate("/bookings");
        return;
      }

      setBooking(data);
    } catch (error) {
      console.error("Error fetching booking details:", error);
      toast({
        title: "Error",
        description: "Failed to load booking details",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCancelBooking = async () => {
    if (!booking) return;
    
    setCancelling(true);
    try {
      const { error } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", booking.id);

      if (error) throw error;

      // Refund the payment if applicable
      if (booking.escrow_payments?.[0]?.id) {
        try {
          await EscrowService.refundPayment(booking.escrow_payments[0].id);
          
          // Update payment status in the database
          await supabase
            .from("escrow_payments")
            .update({ status: "refunded" })
            .eq("id", booking.escrow_payments[0].id);
        } catch (paymentError) {
          console.error("Error refunding payment:", paymentError);
          // Continue with cancellation even if refund fails
        }
      }
      
      // Send cancellation notification to the provider if cancelled by customer
      if (isCustomer() && booking.provider_id) {
        await supabase.from("notifications").insert({
          user_id: booking.provider_id,
          type: "booking_cancelled",
          title: "Booking Cancelled",
          message: `${booking.customer?.username || 'A customer'} has cancelled their booking for "${booking.services?.title || 'your service'}"`,
          is_read: false,
          data: JSON.stringify({
            booking_id: booking.id,
            service_id: booking.service_id
          }),
        });
      }
      
      // Send cancellation notification to the customer if cancelled by provider
      if (isProvider() && booking.customer_id) {
        await supabase.from("notifications").insert({
          user_id: booking.customer_id,
          type: "booking_cancelled",
          title: "Booking Cancelled by Provider",
          message: `${booking.provider?.username || 'The service provider'} has cancelled your booking for "${booking.services?.title || 'the service'}"`,
          is_read: false,
          data: JSON.stringify({
            booking_id: booking.id,
            service_id: booking.service_id
          }),
        });
      }

      toast({
        title: "Booking Cancelled",
        description: "Your booking has been cancelled successfully",
      });

      navigate("/bookings");
    } catch (error) {
      console.error("Error canceling booking:", error);
      toast({
        title: "Error",
        description: "Failed to cancel booking. Please try again.",
        variant: "destructive",
      });
    } finally {
      setCancelling(false);
      setShowCancelDialog(false);
    }
  };

  const handleConfirmCompletion = async () => {
    if (!booking) return;
    
    try {
      setConfirming(true);
      
      // Update booking status to completed
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: "completed",
          confirmation_date: new Date().toISOString()
        })
        .eq('id', booking.id);
        
      if (error) throw error;
      
      // Release payment if there is one
      if (booking.escrow_payments?.[0]?.id) {
        try {
          await EscrowService.releasePayment(booking.escrow_payments[0].id);
        } catch (paymentError) {
          console.error("Error releasing payment:", paymentError);
          // Continue with completion even if payment release fails
        }
      }
      
      // Send notification to provider
      if (booking.provider_id) {
        await supabase.from("notifications").insert({
          user_id: booking.provider_id,
          type: "booking_completed",
          title: "Service Completed",
          message: `Customer has confirmed completion of "${booking.services?.title || 'your service'}"`,
          is_read: false,
          data: JSON.stringify({
            booking_id: booking.id,
            service_id: booking.service_id
          }),
        });
      }
      
      // Update UI
      toast({
        title: "Service Confirmed",
        description: "You have confirmed the service completion. Payment has been released to the provider.",
      });
      
      // Refetch booking data
      fetchBookingDetails();
      
      // Close modal
      setShowConfirmationModal(false);
    } catch (error) {
      console.error("Error confirming completion:", error);
      toast({
        title: "Error",
        description: "Failed to confirm service completion. Please try again.",
        variant: "destructive",
      });
    } finally {
      setConfirming(false);
    }
  };

  const handleDisputeCompletion = async (reason = "Customer disputed service completion", details = "") => {
    if (!booking || !user) return;
    
    try {
      setDisputing(true);
      
      // Update booking status to disputed
      const { error } = await supabase
        .from('bookings')
        .update({ 
          status: "disputed",
          customer_feedback: details || "Service was not completed satisfactorily" 
        })
        .eq('id', booking.id);
        
      if (error) throw error;
      
      // Create dispute for the payment if exists
      if (booking.escrow_payments?.[0]?.id) {
        try {
          await EscrowService.createDispute(
            booking.escrow_payments[0].id,
            reason,
            details || "Service was not completed satisfactorily",
            user.id
          );
        } catch (disputeError) {
          console.error("Error creating payment dispute:", disputeError);
          // Continue even if dispute creation fails
        }
      }
      
      // Send notification to provider
      if (booking.provider_id) {
        await supabase.from("notifications").insert({
          user_id: booking.provider_id,
          type: "booking_dispute",
          title: "Service Disputed",
          message: `The customer has disputed the completion of "${booking.services?.title || 'your service'}"`,
          is_read: false,
          data: JSON.stringify({
            booking_id: booking.id,
            service_id: booking.service_id
          }),
        });
      }
      
      // Send notification to admin (in a real app, identify admins properly)
      const { data: adminData } = await supabase
        .from('profiles')
        .select('id')
        .eq('user_role', 'admin')
        .limit(1);
        
      if (adminData && adminData.length > 0) {
        await supabase.from("notifications").insert({
          user_id: adminData[0].id,
          type: "admin_dispute",
          title: "New Service Dispute",
          message: `A customer has disputed service completion. Review required.`,
          is_read: false,
          data: JSON.stringify({
            booking_id: booking.id,
            service_id: booking.service_id,
            customer_id: user.id,
            provider_id: booking.provider_id
          }),
        });
      }
      
      // Update UI
      toast({
        title: "Dispute Filed",
        description: "Your dispute has been filed. Our team will review it shortly.",
      });
      
      // Refetch booking data
      fetchBookingDetails();
      
      // Close modal
      setShowConfirmationModal(false);
    } catch (error) {
      console.error("Error filing dispute:", error);
      toast({
        title: "Error",
        description: "Failed to file dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setDisputing(false);
    }
  };

  const handleMakePayment = async () => {
    if (!booking) return;

    // Redirect to the payment page
    setShowPaymentModal(false);
    navigate(`/payment/${booking.id}`);
  };

  const handlePaymentAction = async (status: string, bookingId: string) => {
    toast({
      title: `Payment ${status}`,
      description: `The payment has been ${status}. The booking details will refresh.`,
    });
    
    // Refresh booking details
    fetchBookingDetails();
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'completed': return "default";
      case 'confirmed': return "outline";
      case 'pending': return "secondary";
      case 'pending_completion': return "secondary";
      case 'disputed': return "destructive";
      case 'cancelled': return "destructive";
      default: return "secondary";
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'pending_completion': return "Awaiting Confirmation";
      case 'cancelled': return "Cancelled";
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  const getPaymentStatusBadge = () => {
    if (!booking?.escrow_payments || booking.escrow_payments.length === 0) {
      return <Badge variant="outline" className="bg-amber-900 text-amber-70 hover:bg-amber-50">Payment Discussion Needed</Badge>;
    }
    
    const payment = booking.escrow_payments[0];
    switch (payment.status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700 hover:bg-yellow-50">Payment Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 hover:bg-blue-50">Payment Arranged</Badge>;
      case 'released':
        return <Badge variant="outline" className="bg-green-50 text-green-700 hover:bg-green-50">Payment Released</Badge>;
      case 'refunded':
        return <Badge variant="outline" className="bg-gray-50 text-gray-700 hover:bg-gray-50">Payment Refunded</Badge>;
      case 'disputed':
        return <Badge variant="outline" className="bg-red-50 text-red-700 hover:bg-red-50">Payment Disputed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };

  const isPaymentNeeded = () => {
    // Check if a payment is needed for this booking
    if (!booking) return false;
    
    // If booking is in draft or pending status and no payment has been completed
    if (booking.status === 'draft' || booking.status === 'pending') {
      // No payment records or payment status is not completed
      if (!booking.escrow_payments || booking.escrow_payments.length === 0) {
        return true;
      }
      
      const payment = booking.escrow_payments[0];
      return payment.status === 'pending';
    }
    
    return false;
  };

  const isCustomer = () => {
    return user?.id === booking?.customer_id;
  };

  const isProvider = () => {
    return user?.id === booking?.provider_id;
  };

  if (loading) {
    return (
      <MainLayout activeTab="Bookings" setActiveTab={() => {}} userRole="customer" isAuthenticated={true}>
        <div>
          <Card className="p-8">
            <div className="flex items-center justify-center space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <p>Loading booking details...</p>
            </div>
          </Card>
        </div>
      </MainLayout>
    );
  }

  if (!booking) {
    return null;
  }

  const canCancel = booking.status === "pending" && !booking.service_started;
  const needsConfirmation = booking.status === "pending_completion" && booking.customer_id === user?.id;

  return (
    <MainLayout activeTab="Bookings" setActiveTab={() => {}} userRole="customer" isAuthenticated={true}>
      <div className="container min-h-screen py-8">
        <div className="mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate("/bookings")}
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Bookings
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Booking Details */}
          <div className="lg:col-span-2 space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Booking Details</CardTitle>
                  <div className="flex items-center gap-2">
                    {getPaymentStatusBadge()}
                    <Badge
                      variant={getStatusBadgeVariant(booking.status)}
                    >
                      {getStatusLabel(booking.status)}
                    </Badge>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Service</h4>
                    <p className="font-medium">{booking.services?.title}</p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Price</h4>
                    <p className="font-medium">{formatPrice(booking.services?.price, 'USD')}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Date</h4>
                    <p className="font-medium">
                      {new Date(booking.scheduled_time).toLocaleDateString()}
                    </p>
                  </div>
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Time</h4>
                    <p className="font-medium">
                      {new Date(booking.scheduled_time).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </p>
                  </div>
                </div>

                <div>
                  <h4 className="text-sm font-medium text-muted-foreground">Location</h4>
                  <p className="font-medium">{booking.location || booking.services?.location}</p>
                </div>

                {booking.notes && (
                  <div>
                    <h4 className="text-sm font-medium text-muted-foreground">Notes</h4>
                    <p className="font-medium">{booking.notes}</p>
                  </div>
                )}

                {isCustomer() && isPaymentNeeded() && (
                  <Alert className="mt-2">
                    <AlertTriangle className="h-4 w-4" />
                    <AlertTitle>Payment Required</AlertTitle>
                    <AlertDescription>
                      Payment is required to secure your booking. Your payment will be held in escrow until the service is completed successfully.
                    </AlertDescription>
                  </Alert>
                )}

                {booking.status === 'pending' && booking.payment_status === 'completed' && (
                  <Alert className="mt-2 bg-blue-50 border-blue-200">
                    <Shield className="h-4 w-4 text-blue-600" />
                    <AlertTitle>Payment Protected</AlertTitle>
                    <AlertDescription>
                      Your payment is securely held in escrow. It will be released to the service provider only after you confirm the service has been completed successfully.
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>

            {/* Service Provider Details */}
            <Card>
              <CardHeader>
                <CardTitle>Service Provider</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={booking.provider?.avatar_url} />
                    <AvatarFallback>
                      {booking.provider?.username?.charAt(0).toUpperCase() || "P"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <h4 className="font-medium">{booking.provider?.username}</h4>
                    <p className="text-sm text-muted-foreground">Service Provider</p>
                    <div className="flex items-center mt-1">
                      <Badge variant="outline" className={booking.provider?.kyc_verified ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}>
                        {booking.provider?.kyc_verified ? "KYC Verified" : "Not Verified"}
                      </Badge>
                    </div>
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/messages?user=${booking.provider_id}`)}
                  >
                    <MessageSquare className="h-4 w-4 mr-2" />
                    Contact Provider
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Actions Sidebar */}
          <div className="space-y-6">
            {isProvider() && (
              <BookingPaymentCard 
                booking={booking} 
                onPaymentAction={handlePaymentAction} 
              />
            )}

            <Card>
              <CardHeader>
                <CardTitle>Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {isCustomer() && isPaymentNeeded() && (
                  <Button
                    variant="default"
                    className="w-full flex items-center gap-2"
                    onClick={() => navigate(`/payment/${booking.id}`)}
                  >
                    <CreditCard className="h-4 w-4" />
                    Complete Payment
                  </Button>
                )}

                {needsConfirmation && (
                  <div className="p-4 border rounded-lg border-yellow-200 bg-yellow-900 mb-4">
                    <div className="flex items-start gap-3">
                      <div className="text-yellow-500 mt-0.5">
                        <AlertTriangle size={18} />
                      </div>
                      <div>
                        <h4 className="font-medium text-yellow-80">Service Completion Pending</h4>
                        <p className="text-sm text-yellow-70 mt-1">
                          The service provider has marked this service as completed. Please confirm if you are satisfied with the service.
                        </p>
                        <div className="mt-3 flex gap-2">
                          <Button
                            size="sm"
                            onClick={() => setShowConfirmationModal(true)}
                          >
                            Review & Confirm
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              
                {canCancel && (
                  <Button
                    variant="destructive"
                    className="w-full"
                    onClick={() => setShowCancelDialog(true)}
                  >
                    Cancel Booking
                  </Button>
                )}
              </CardContent>
            </Card>

            {/* Booking Status Card */}
            <Card>
              <CardHeader>
                <CardTitle>Booking Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${booking.status === 'pending' ? 'bg-blue-500' : 'bg-gray-300'}`} />
                  <span className={booking.status === 'pending' ? 'font-medium' : 'text-muted-foreground'}>Pending Approval</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${booking.status === 'confirmed' ? 'bg-blue-500' : (booking.status === 'pending_completion' || booking.status === 'completed') ? 'bg-gray-300' : 'bg-gray-200'}`} />
                  <span className={booking.status === 'confirmed' ? 'font-medium' : 'text-muted-foreground'}>Confirmed</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${booking.status === 'pending_completion' ? 'bg-blue-500' : booking.status === 'completed' ? 'bg-gray-300' : 'bg-gray-200'}`} />
                  <span className={booking.status === 'pending_completion' ? 'font-medium' : 'text-muted-foreground'}>Awaiting Confirmation</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <div className={`h-3 w-3 rounded-full ${booking.status === 'completed' ? 'bg-green-500' : 'bg-gray-200'}`} />
                  <span className={booking.status === 'completed' ? 'font-medium' : 'text-muted-foreground'}>Completed</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Cancel Confirmation Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
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
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                No, Keep Booking
              </Button>
              <Button
                variant="destructive"
                onClick={handleCancelBooking}
                disabled={cancelling}
              >
                {cancelling ? (
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

        {/* Service Completion Confirmation Modal */}
        <CustomerConfirmationModal
          isOpen={showConfirmationModal}
          onClose={() => setShowConfirmationModal(false)}
          booking={booking}
          onConfirm={handleConfirmCompletion}
          onDispute={handleDisputeCompletion}
          user={user}
        />

        {/* Payment Modal */}
        <Dialog open={showPaymentModal} onOpenChange={setShowPaymentModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Payment Information</DialogTitle>
              <DialogDescription>
                Payments are currently handled directly between you and the service provider.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="p-4 border rounded-lg">
                <h3 className="font-medium mb-2">Service Details</h3>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span>Service:</span>
                    <span>{booking.services?.title}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Price:</span>
                    <span className="font-medium">{formatPrice(booking.services?.price, 'USD')}</span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5 text-blue-500" />
                <p className="text-sm text-muted-foreground">
                  Please use the chat feature to discuss payment methods and details with the service provider.
                </p>
              </div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowPaymentModal(false)}>
                Close
              </Button>
              <Button
                onClick={() => {
                  setShowPaymentModal(false);
                  navigate(`/messages?user=${booking.provider_id}`);
                }}
              >
                Contact Provider
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
} 