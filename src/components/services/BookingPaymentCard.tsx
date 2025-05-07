import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { EscrowService } from "@/utils/escrow-service";
import { supabase } from "@/integrations/supabase/client";
import { 
  CreditCard, 
  Shield, 
  AlertTriangle, 
  ArrowUpRight, 
  CheckCircle,
  Loader2,
  RefreshCw,
  Clock
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useCurrency } from "@/contexts/CurrencyContext";

interface BookingPaymentCardProps {
  booking: any;
  onPaymentAction?: (status: string, bookingId: string) => void;
}

export const BookingPaymentCard = ({ booking, onPaymentAction }: BookingPaymentCardProps) => {
  const { toast } = useToast();
  const [isReleasing, setIsReleasing] = useState(false);
  const [isRefunding, setIsRefunding] = useState(false);
  const [isMarkingCompleted, setIsMarkingCompleted] = useState(false);
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  
  const payment = booking?.escrow_payments && booking.escrow_payments.length > 0 ? booking.escrow_payments[0] : null;
  
  const { formatPrice } = useCurrency();
  
  // Check if this booking has a payment
  if (!payment && booking.status !== 'confirmed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Payment Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="p-3 bg-amber-100 rounded-full mb-3">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
            </div>
            <h3 className="text-lg font-medium mb-1">No Payment Found</h3>
            <p className="text-sm text-muted-foreground text-center mb-3">
              This booking doesn't have a payment record.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const handleReleasePayment = async () => {
    if (!payment?.id) return;
    
    setIsReleasing(true);
    try {
      const success = await EscrowService.releasePayment(payment.id);
      
      if (success) {
        toast({
          title: "Payment released",
          description: "Payment has been successfully released to the service provider.",
          variant: "default",
        });
        
        if (onPaymentAction) {
          onPaymentAction("released", booking.id);
        }
      } else {
        toast({
          title: "Failed to release payment",
          description: "There was an issue releasing the payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error releasing payment:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsReleasing(false);
    }
  };
  
  const handleRefundPayment = async () => {
    if (!payment?.id) return;
    
    setIsRefunding(true);
    try {
      const reason = "Refunded by service provider";
      const success = await EscrowService.refundPayment(payment.id, reason);
      
      if (success) {
        toast({
          title: "Payment refunded",
          description: "Payment has been successfully refunded to the customer.",
          variant: "default",
        });
        
        if (onPaymentAction) {
          onPaymentAction("refunded", booking.id);
        }
      } else {
        toast({
          title: "Failed to refund payment",
          description: "There was an issue refunding the payment. Please try again.",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error refunding payment:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsRefunding(false);
      setShowRefundDialog(false);
    }
  };
  
  // Handle marking service as completed - requiring customer confirmation
  const handleMarkCompleted = async () => {
    if (!booking.id) return;
    
    setIsMarkingCompleted(true);
    try {
      // Update booking status to pending_completion
      const { error } = await supabase
        .from('bookings')
        .update({ status: 'pending_completion' })
        .eq('id', booking.id);
        
      if (error) throw error;
      
      // Send notification to customer about pending confirmation
      if (booking.customer_id) {
        await supabase.from("notifications").insert({
          user_id: booking.customer_id,
          type: "booking_completion_request",
          title: "Service Completion Confirmation Required",
          message: `Service provider has marked "${booking.services?.title || 'your booking'}" as completed. Please confirm to release payment.`,
          is_read: false,
          data: JSON.stringify({
            booking_id: booking.id,
            service_id: booking.service_id
          }),
        });
      }
      
      toast({
        title: "Service marked as completed",
        description: "Customer has been notified to confirm service completion.",
        variant: "default",
      });
      
      if (onPaymentAction) {
        onPaymentAction("pending_completion", booking.id);
      }
    } catch (error) {
      console.error("Error marking service as completed:", error);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
    } finally {
      setIsMarkingCompleted(false);
    }
  };
  
  const getStatusBadge = () => {
    if (booking.status === 'pending_completion') {
      return <Badge variant="outline" className="bg-blue-50 text-blue-600">Awaiting Customer Confirmation</Badge>;
    }
    
    if (booking.status === 'confirm_service') {
      return <Badge variant="outline" className="bg-green-50 text-green-600">Ready For Confirmation</Badge>;
    }
    
    if (!payment) {
      return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">No Payment</Badge>;
    }
    
    switch (payment.status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-50 text-yellow-700">Payment Pending</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-blue-50 text-blue-600">In Escrow</Badge>;
      case 'released':
        return <Badge variant="outline" className="bg-green-50 text-green-600">Released</Badge>;
      case 'refunded':
        return <Badge variant="outline" className="bg-gray-50 text-gray-600">Refunded</Badge>;
      case 'disputed':
        return <Badge variant="outline" className="bg-red-50 text-red-600">Disputed</Badge>;
      default:
        return <Badge variant="outline">Unknown</Badge>;
    }
  };
  
  const canRelease = payment && payment.status === 'completed';
  const canRefund = payment && ['completed', 'pending'].includes(payment.status);
  // Can mark as completed when booking is confirmed and not already pending completion
  const canMarkCompleted = booking.status === 'confirmed';

  // Show confirmation card when status is confirm_service
  if (booking.status === 'confirm_service') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Completion</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 pb-3">
            <div className="p-2 bg-green-100 rounded-full">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Service Ready For Confirmation</h3>
              <p className="text-sm text-muted-foreground">
                The service provider has marked this service as completed. Please confirm if the service has been completed to your satisfaction.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex gap-2">
          <Button 
            className="flex-1"
            onClick={() => onPaymentAction('confirm_completion', booking.id)}
          >
            Confirm Completion
          </Button>
          <Button 
            variant="outline"
            className="flex-1"
            onClick={() => onPaymentAction('dispute', booking.id)}
          >
            Report Issue
          </Button>
        </CardFooter>
      </Card>
    );
  }

  // Show completion card when there's no payment or payment info
  if (!payment && booking.status === 'confirmed') {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Service Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 pb-3">
            <div className="p-2 bg-primary/10 rounded-full">
              <Clock className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Service In Progress</h3>
              <p className="text-sm text-muted-foreground">
                This booking is confirmed and in progress. When the service is completed, mark it as done to notify the customer.
              </p>
            </div>
          </div>
        </CardContent>
        <CardFooter>
          <Button 
            className="w-full bg-green-600 hover:bg-green-700"
            onClick={handleMarkCompleted}
            disabled={isMarkingCompleted}
          >
            {isMarkingCompleted ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Service as Completed
              </>
            )}
          </Button>
        </CardFooter>
      </Card>
    );
  }
  
  // Show awaiting confirmation card
  if (booking.status === 'pending_completion') {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Service Status</CardTitle>
            {getStatusBadge()}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-3 pb-3">
            <div className="p-2 bg-blue-100 rounded-full">
              <Clock className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-medium mb-1">Awaiting Customer Confirmation</h3>
              <p className="text-sm text-muted-foreground">
                The customer has been notified to confirm that the service has been completed. Once they confirm, the payment will be released to you.
              </p>
              {payment && (
                <div className="text-sm font-medium mt-2">
                  Expected payment: {formatPrice(payment.amount)}
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Payment Details</CardTitle>
          {getStatusBadge()}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 pb-3">
          <div className="p-2 bg-primary/10 rounded-full">
            <Shield className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Secure Escrow Payment</h3>
            <p className="text-sm text-muted-foreground">
              {payment.status === 'completed' ? 
                "Payment is held in escrow and will be released once the service is completed." :
                payment.status === 'released' ?
                "Payment has been released to your account." :
                payment.status === 'refunded' ?
                "Payment has been refunded to the customer." :
                payment.status === 'disputed' ?
                "Payment is currently disputed and under review." :
                "Payment is pending completion by the customer."
              }
            </p>
          </div>
        </div>
        
        <div className="space-y-3 pt-2">
          <div className="flex justify-between">
            <span>Service Fee</span>
            <span>{formatPrice(payment.amount)}</span>
          </div>
          <div className="flex justify-between">
            <span>Platform Fee (8%)</span>
            <span>{formatPrice(payment.platform_fee)}</span>
          </div>
          <Separator />
          <div className="flex justify-between font-bold">
            <span>Total</span>
            <span>{formatPrice(payment.total_amount)}</span>
          </div>
          
          <div className="text-xs text-muted-foreground mt-2">
            <p>Payment made on {new Date(payment.created_at).toLocaleDateString()}</p>
            {payment.payment_method && (
              <p>Method: {payment.payment_method}</p>
            )}
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex flex-col space-y-3">
        {canMarkCompleted && (
          <Button 
            className="w-full bg-green-600 hover:bg-green-700" 
            onClick={handleMarkCompleted}
            disabled={isMarkingCompleted}
          >
            {isMarkingCompleted ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <CheckCircle className="mr-2 h-4 w-4" />
                Mark Service as Completed
              </>
            )}
          </Button>
        )}
        
        {canRelease && (
          <Button 
            className="w-full" 
            onClick={handleReleasePayment}
            disabled={isReleasing}
          >
            {isReleasing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                <ArrowUpRight className="mr-2 h-4 w-4" />
                Release Payment
              </>
            )}
          </Button>
        )}
        
        {canRefund && (
          <>
            <AlertDialog open={showRefundDialog} onOpenChange={setShowRefundDialog}>
              <AlertDialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full"
                  disabled={isRefunding}
                >
                  {isRefunding ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refund Payment
                    </>
                  )}
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Refund Payment</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to refund the payment? This action cannot be undone.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={handleRefundPayment}>
                    Confirm Refund
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </>
        )}
      </CardFooter>
    </Card>
  );
}; 