import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { EscrowService } from "@/utils/escrow-service";
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
  const [showRefundDialog, setShowRefundDialog] = useState(false);
  
  const payment = booking?.escrow_payments && booking.escrow_payments.length > 0 ? booking.escrow_payments[0] : null;
  
  const { formatPrice } = useCurrency();
  
  // Check if this booking has a payment
  if (!payment) {
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
  
  const getStatusBadge = () => {
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
  
  const canRelease = payment.status === 'completed';
  const canRefund = ['completed', 'pending'].includes(payment.status);
  
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
      
      {(canRelease || canRefund) && (
        <CardFooter className="flex flex-col space-y-3">
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
                    <AlertDialogTitle>Confirm Refund</AlertDialogTitle>
                    <AlertDialogDescription>
                      Are you sure you want to refund this payment? This will cancel the booking and return the full amount to the customer.
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
      )}
    </Card>
  );
}; 