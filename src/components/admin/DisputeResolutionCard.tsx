import { useState } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { EscrowService } from "@/utils/escrow-service";
import { 
  Loader2,
  AlertTriangle,
  CheckCircle,
  XCircle,
  Shield,
  MessageSquare
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

interface DisputeResolutionCardProps {
  booking: any;
  onResolutionComplete?: () => void;
}

export const DisputeResolutionCard = ({ booking, onResolutionComplete }: DisputeResolutionCardProps) => {
  const { toast } = useToast();
  const [resolution, setResolution] = useState<"refund" | "release" | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  
  const { formatPrice } = useCurrency();
  
  // Get the payment from booking
  const payment = booking?.escrow_payments && booking.escrow_payments.length > 0 
    ? booking.escrow_payments[0] 
    : null;
  
  // Is this booking disputed?
  if (booking.status !== "disputed") {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dispute Resolution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col items-center justify-center py-4">
            <div className="p-3 bg-gray-100 rounded-full mb-3">
              <CheckCircle className="h-5 w-5 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium mb-1">No Dispute</h3>
            <p className="text-sm text-muted-foreground text-center mb-3">
              This booking is not currently under dispute.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  const handleResolveDispute = async () => {
    if (!booking.id || !resolution) return;
    
    setIsSubmitting(true);
    try {
      if (resolution === "refund") {
        // Refund to customer
        if (payment?.id) {
          await EscrowService.refundPayment(payment.id, resolutionNotes || "Admin resolved dispute in favor of customer");
          
          // Update payment status in the database
          await supabase
            .from("escrow_payments")
            .update({ 
              status: "refunded",
              notes: resolutionNotes || "Admin resolved dispute in favor of customer"
            })
            .eq("id", payment.id);
        }
        
        // Update booking status to cancelled
        await supabase
          .from("bookings")
          .update({ 
            status: "cancelled",
            admin_notes: resolutionNotes || "Dispute resolved in favor of customer"
          })
          .eq("id", booking.id);
        
        // Notify customer
        if (booking.customer_id) {
          await supabase.from("notifications").insert({
            user_id: booking.customer_id,
            type: "dispute_resolved",
            title: "Dispute Resolved",
            message: "Your dispute has been resolved in your favor. Payment has been refunded.",
            is_read: false,
            data: JSON.stringify({
              booking_id: booking.id,
              service_id: booking.service_id,
              resolution: "refund"
            }),
          });
        }
        
        // Notify provider
        if (booking.provider_id) {
          await supabase.from("notifications").insert({
            user_id: booking.provider_id,
            type: "dispute_resolved",
            title: "Dispute Resolved",
            message: "A dispute for your service has been resolved in favor of the customer. Payment has been refunded.",
            is_read: false,
            data: JSON.stringify({
              booking_id: booking.id,
              service_id: booking.service_id,
              resolution: "refund"
            }),
          });
        }
      } else if (resolution === "release") {
        // Release payment to provider
        if (payment?.id) {
          await EscrowService.releasePayment(payment.id, resolutionNotes || "Admin resolved dispute in favor of provider");
          
          // Update payment status in the database
          await supabase
            .from("escrow_payments")
            .update({ 
              status: "released",
              notes: resolutionNotes || "Admin resolved dispute in favor of provider"
            })
            .eq("id", payment.id);
        }
        
        // Update booking status to completed
        await supabase
          .from("bookings")
          .update({ 
            status: "completed",
            admin_notes: resolutionNotes || "Dispute resolved in favor of provider"
          })
          .eq("id", booking.id);
        
        // Notify customer
        if (booking.customer_id) {
          await supabase.from("notifications").insert({
            user_id: booking.customer_id,
            type: "dispute_resolved",
            title: "Dispute Resolved",
            message: "Your dispute has been resolved in favor of the service provider. Payment has been released.",
            is_read: false,
            data: JSON.stringify({
              booking_id: booking.id,
              service_id: booking.service_id,
              resolution: "release"
            }),
          });
        }
        
        // Notify provider
        if (booking.provider_id) {
          await supabase.from("notifications").insert({
            user_id: booking.provider_id,
            type: "dispute_resolved",
            title: "Dispute Resolved",
            message: "A dispute for your service has been resolved in your favor. Payment has been released.",
            is_read: false,
            data: JSON.stringify({
              booking_id: booking.id,
              service_id: booking.service_id,
              resolution: "release"
            }),
          });
        }
      }
      
      toast({
        title: "Dispute Resolved",
        description: resolution === "refund" 
          ? "The dispute has been resolved in favor of the customer. Payment refunded."
          : "The dispute has been resolved in favor of the provider. Payment released.",
      });
      
      if (onResolutionComplete) {
        onResolutionComplete();
      }
    } catch (error) {
      console.error("Error resolving dispute:", error);
      toast({
        title: "Error",
        description: "Failed to resolve the dispute. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      setShowConfirmDialog(false);
    }
  };
  
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Dispute Resolution</CardTitle>
          <Badge variant="destructive">Disputed</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-3 pb-3">
          <div className="p-2 bg-red-100 rounded-full">
            <AlertTriangle className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h3 className="font-medium mb-1">Service Under Dispute</h3>
            <p className="text-sm text-muted-foreground">
              The customer has disputed the completion of this service. Please review the details and resolve the dispute.
            </p>
          </div>
        </div>
        
        <div className="space-y-3 pt-2">
          <div className="bg-muted p-3 rounded-md">
            <h4 className="font-medium text-sm mb-1">Dispute Details</h4>
            <p className="text-sm">
              {booking.customer_feedback || "No specific details provided by the customer."}
            </p>
          </div>
          
          {payment && (
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Payment Details</h4>
              <div className="flex justify-between text-sm">
                <span>Amount in Escrow:</span>
                <span>{formatPrice(payment.amount)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span>Payment Date:</span>
                <span>{new Date(payment.created_at).toLocaleDateString()}</span>
              </div>
            </div>
          )}
          
          <div className="pt-4">
            <h4 className="font-medium mb-2">Resolution Notes</h4>
            <Textarea
              placeholder="Add notes about your decision (visible to both parties)..."
              value={resolutionNotes}
              onChange={(e) => setResolutionNotes(e.target.value)}
              className="min-h-24"
            />
          </div>
        </div>
      </CardContent>
      
      <CardFooter className="flex-col space-y-3">
        <div className="w-full flex flex-col sm:flex-row gap-3">
          <Button 
            variant="outline" 
            className="flex-1 border-green-600 text-green-700 hover:bg-green-50"
            onClick={() => {
              setResolution("release");
              setShowConfirmDialog(true);
            }}
            disabled={isSubmitting}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Resolve for Provider
          </Button>
          
          <Button 
            variant="outline" 
            className="flex-1 border-red-600 text-red-700 hover:bg-red-50"
            onClick={() => {
              setResolution("refund");
              setShowConfirmDialog(true);
            }}
            disabled={isSubmitting}
          >
            <XCircle className="mr-2 h-4 w-4" />
            Resolve for Customer
          </Button>
        </div>
        
        <Button 
          variant="ghost" 
          className="w-full text-blue-600"
          disabled={isSubmitting}
        >
          <MessageSquare className="mr-2 h-4 w-4" />
          Contact Both Parties
        </Button>
        
        <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Confirm Resolution</AlertDialogTitle>
              <AlertDialogDescription>
                {resolution === "refund" 
                  ? "You're about to resolve this dispute in favor of the customer. The payment will be refunded and the booking will be cancelled."
                  : "You're about to resolve this dispute in favor of the service provider. The payment will be released and the booking will be marked as completed."
                }
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction 
                onClick={handleResolveDispute}
                className={resolution === "refund" ? "bg-red-600 hover:bg-red-700" : "bg-green-600 hover:bg-green-700"}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>Confirm Resolution</>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}; 