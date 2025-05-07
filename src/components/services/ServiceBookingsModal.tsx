import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Calendar, Clock, User, DollarSign, MessageSquare } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { EscrowService } from "@/utils/escrow-service";
import { createNotification } from "@/utils/notification-helper";

interface ServiceBookingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  service: any;
}

export function ServiceBookingsModal({ 
  isOpen, 
  onClose,
  service
}: ServiceBookingsModalProps) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("all");
  const [messageText, setMessageText] = useState("");
  const [messageTargetBooking, setMessageTargetBooking] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (isOpen && service) {
      fetchBookings();
    }
  }, [isOpen, service]);

  const fetchBookings = async () => {
    if (!service?.id) return;
    
    try {
      setLoading(true);
      
      // First, get the bookings
      const { data, error } = await supabase
        .from('bookings')
        .select('*')
        .eq('service_id', service.id)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      if (!data || data.length === 0) {
        setBookings([]);
        setLoading(false);
        return;
      }
      
      // Get customer data
      const customerIds = data.map(booking => booking.customer_id);
      const { data: customerData, error: customerError } = await supabase
          .from('profiles')
          .select('id, username, avatar_url')
          .in('id', customerIds);
          
      if (customerError) throw customerError;
      
      // Get payment data
      const bookingIds = data.map(booking => booking.id);
      const { data: paymentData, error: paymentError } = await supabase
        .from('escrow_payments')
        .select('*')
        .in('booking_id', bookingIds);
        
      if (paymentError) throw paymentError;
      
      // Combine the data
      const enrichedBookings = data.map(booking => {
        const customer = customerData?.find(c => c.id === booking.customer_id);
        const payments = paymentData?.filter(p => p.booking_id === booking.id) || [];
        
        return {
          ...booking,
          customer: customer || { username: 'Anonymous' },
          escrow_payments: payments
        };
      });
      
      setBookings(enrichedBookings);
    } catch (error) {
      console.error("Error fetching bookings:", error);
      toast({
        title: "Error",
        description: "Failed to fetch booking data",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const filteredBookings = () => {
    if (activeTab === "all") return bookings;
    return bookings.filter(booking => {
      if (activeTab === "pending") return booking.status === "pending";
      if (activeTab === "confirmed") return booking.status === "confirmed";
      if (activeTab === "completed") return booking.status === "completed";
      if (activeTab === "canceled") return booking.status === "canceled";
      if (activeTab === "pending_completion") return booking.status === "pending_completion" || booking.status === "confirm_service";
      return true;
    });
  };

  const handleStatusChange = async (bookingId: string, newStatus: string) => {
    try {
      if (newStatus === "completed") {
        // For completed status, we'll only mark it as pending_completion
        // This requires customer confirmation
        const { error } = await supabase
          .from('bookings')
          .update({ status: "pending_completion" })
          .eq('id', bookingId);
          
        if (error) throw error;
        
        // Update local state
        setBookings(bookings.map(booking => 
          booking.id === bookingId 
            ? { ...booking, status: "pending_completion" } 
            : booking
        ));
        
        // Get customer information for notification
        const booking = bookings.find(b => b.id === bookingId);
        if (booking?.customer_id) {
          // Create notification for customer to confirm completion
          const { data: serviceData } = await supabase
            .from('services')
            .select('title')
            .eq('id', service.id)
            .single();
            
          await createNotification({
            userId: booking.customer_id,
            actorId: service.owner_id,
            type: 'booking_completion',
            message: `Service provider has marked "${serviceData?.title || 'a service'}" as completed. Please confirm completion.`,
            linkType: 'booking',
            linkId: bookingId
          });
        }
        
        toast({
          title: "Status Updated",
          description: "Customer has been notified to confirm service completion",
        });
        
        return;
      }

      const { error } = await supabase
        .from('bookings')
        .update({ status: newStatus })
        .eq('id', bookingId);
      
      if (error) throw error;
      
      // Handle escrow status changes based on booking status change
      if (newStatus === "canceled") {
        // Refund the payment
        const booking = bookings.find(b => b.id === bookingId);
        if (booking?.escrow_payments?.[0]?.id) {
          await EscrowService.refundPayment(booking.escrow_payments[0].id);
        }
      }

      // Update local state
      setBookings(bookings.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: newStatus } 
          : booking
      ));
      
      toast({
        title: "Status Updated",
        description: `Booking status has been changed to ${newStatus}`,
      });
    } catch (error) {
      console.error("Error updating booking status:", error);
      toast({
        title: "Error",
        description: "Failed to update booking status",
        variant: "destructive",
      });
    }
  };

  const handleSendMessage = async () => {
    if (!messageText.trim() || !messageTargetBooking) return;
    
    try {
      const booking = bookings.find(b => b.id === messageTargetBooking);
      
      // Insert message into database
      const { error } = await supabase
        .from('messages')
        .insert({
          booking_id: messageTargetBooking,
          sender_id: service.owner_id,
          recipient_id: booking?.customer_id,
          content: messageText,
          is_read: false
        });

      if (error) throw error;

      toast({
        title: "Message Sent",
        description: "Your message has been sent successfully"
      });

      // Reset message state
      setMessageText("");
      setMessageTargetBooking(null);
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'confirmed': return 'bg-blue-100 text-blue-800';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'canceled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[600px] max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            Bookings for {service?.title}
          </DialogTitle>
        </DialogHeader>
        
        <Tabs defaultValue="all" onValueChange={setActiveTab}>
          <TabsList className="grid grid-cols-5 mb-4">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="pending">Pending</TabsTrigger>
            <TabsTrigger value="confirmed">Confirmed</TabsTrigger>
            <TabsTrigger value="completed">Completed</TabsTrigger>
            <TabsTrigger value="canceled">Canceled</TabsTrigger>
          </TabsList>
          
          <TabsContent value={activeTab} className="mt-0">
            {loading ? (
              <div className="flex justify-center p-8">
                <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full"></div>
              </div>
            ) : filteredBookings().length === 0 ? (
              <div className="text-center p-8 border rounded-lg border-dashed">
                <p className="text-muted-foreground">No {activeTab === "all" ? "" : activeTab} bookings found</p>
              </div>
            ) : (
              <div className="space-y-4">
                {filteredBookings().map((booking) => (
                  <div key={booking.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex justify-between items-start">
                      <div>
                        <h3 className="font-medium flex items-center gap-2">
                          <User className="h-4 w-4" />
                          {booking.customer?.username || "Anonymous User"}
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          {booking.customer?.email || "No email provided"}
                        </p>
                      </div>
                      <Badge 
                        className={getStatusColor(booking.status)}
                        variant="outline"
                      >
                        {booking.status.charAt(0).toUpperCase() + booking.status.slice(1)}
                      </Badge>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex items-center gap-1">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <span>Booked: {formatDate(booking.created_at)}</span>
                      </div>
                      {booking.scheduled_time && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <span>Scheduled: {formatDate(booking.scheduled_time)}</span>
                        </div>
                      )}
                      {booking.escrow_payments?.[0] && (
                        <div className="flex items-center gap-1">
                          <DollarSign className="h-4 w-4 text-muted-foreground" />
                          <span>Amount: ${booking.escrow_payments[0].amount}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t pt-3 flex flex-wrap gap-2">
                      {booking.status === "pending" && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleStatusChange(booking.id, "confirmed")}
                          >
                            Confirm
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleStatusChange(booking.id, "canceled")}
                          >
                            Decline
                          </Button>
                        </>
                      )}

                      {booking.status === "confirmed" && (
                        <>
                          <Button 
                            size="sm" 
                            onClick={() => handleStatusChange(booking.id, "pending_completion")}
                          >
                            Mark as Completed
                          </Button>
                          <Button 
                            size="sm" 
                            variant="destructive"
                            onClick={() => handleStatusChange(booking.id, "canceled")}
                          >
                            Cancel
                          </Button>
                        </>
                      )}

                      {booking.status === "pending_completion" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled
                        >
                          Awaiting Customer Confirmation
                        </Button>
                      )}

                      {booking.status === "confirm_service" && (
                        <Button 
                          size="sm" 
                          variant="outline"
                          disabled
                        >
                          Customer Needs To Confirm
                        </Button>
                      )}

                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setMessageTargetBooking(messageTargetBooking === booking.id ? null : booking.id)}
                        className="ml-auto"
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        Message
                      </Button>
                    </div>

                    {messageTargetBooking === booking.id && (
                      <div className="border-t pt-3 space-y-2">
                        <Textarea
                          placeholder="Type your message here..."
                          value={messageText}
                          onChange={(e) => setMessageText(e.target.value)}
                          className="min-h-[80px]"
                        />
                        <div className="flex justify-end">
                          <Button 
                            size="sm"
                            onClick={handleSendMessage}
                            disabled={!messageText.trim()}
                          >
                            Send Message
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
} 