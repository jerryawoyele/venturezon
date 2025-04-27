import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ServiceType } from "@/types";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/components/ui/use-toast";
import { createNotification } from '@/utils/notification-helper';
import { useNavigate } from 'react-router-dom';
import { useCurrency } from "@/contexts/CurrencyContext";

interface ServiceModalProps {
  service: ServiceType | null;
  isOpen: boolean;
  onClose: () => void;
}

export function ServiceModal({ service, isOpen, onClose }: ServiceModalProps) {
  if (!service) return null;
  
  const [isBooking, setIsBooking] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { formatPrice } = useCurrency();
  
  const handleBookService = async () => {
    try {
      setIsBooking(true);
      
      // Get current user's session
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        toast({
          variant: "destructive",
          title: "Not logged in",
          description: "Please log in to book this service.",
        });
        return;
      }
      
      const currentUserId = session.user.id;
      
      // Don't allow booking your own service
      if (currentUserId === service.owner_id) {
        toast({
          variant: "destructive",
          title: "Cannot book your own service",
          description: "You cannot book a service that you offer.",
        });
        return;
      }
      
      // Create a booking record in the database
      const bookingData = {
        service_id: service.id,
        customer_id: currentUserId,
        provider_id: service.owner_id,
        status: 'pending',
        created_at: new Date().toISOString(),
      };
      
      const { data: bookingResult, error: bookingError } = await supabase
        .from('bookings')
        .insert(bookingData)
        .select()
        .single();
        
      if (bookingError) {
        throw bookingError;
      }
      
      // Get current user's profile info for notification
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('username')
        .eq('id', currentUserId)
        .single();
        
      if (!profileError && profileData) {
        // Create notification for the service provider
        await createNotification({
          userId: service.owner_id,
          actorId: currentUserId,
          actorName: profileData.username || 'Someone',
          type: 'booking',
          entityId: bookingResult.id,
          message: `${profileData.username} booked your service: "${service.title}"`
        });
      }
      
      toast({
        title: "Service Booked",
        description: "Your booking request has been sent to the service provider.",
      });
      
      // Close the modal
      onClose();
      
      // Navigate to bookings page
      navigate('/bookings');
      
    } catch (error) {
      console.error("Error booking service:", error);
      toast({
        variant: "destructive",
        title: "Booking failed",
        description: "There was an error booking this service. Please try again.",
      });
    } finally {
      setIsBooking(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden">
        <ScrollArea className="max-h-[calc(90vh-120px)] pr-4">
          <DialogHeader>
            <DialogTitle className="text-2xl font-bold">{service.title}</DialogTitle>
            <div className="flex items-center gap-2 mt-2">
              <Badge>{service.category}</Badge>
              {service.business && (
                <span className="text-sm text-gray-500">By {service.business}</span>
              )}
            </div>
          </DialogHeader>

          <div className="my-4 h-64 overflow-hidden rounded-md">
            <img 
              src={service.image || '/placeholder.svg'} 
              alt={service.title} 
              className="w-full h-full object-cover"
            />
          </div>

          <div className="space-y-4">
            <div>
              <h3 className="text-xl font-semibold mb-2">Description</h3>
              <p className="text-gray-700">{service.description}</p>
            </div>

            {service.features && service.features.length > 0 && (
              <div>
                <h3 className="text-xl font-semibold mb-2">Features</h3>
                <ul className="list-disc pl-5 space-y-1">
                  {service.features.map((feature, index) => (
                    <li key={index} className="text-gray-700">{feature}</li>
                  ))}
                </ul>
              </div>
            )}

            {service.price && (
              <div>
                <h3 className="text-xl font-semibold mb-2">Pricing</h3>
                <p className="text-lg font-medium">{formatPrice(parseFloat(service.price))}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter className="mt-6">
          <Button onClick={onClose} variant="outline">Close</Button>
          {/* <Button 
            variant="default" 
            onClick={handleBookService}
            disabled={isBooking}
          >
            {isBooking ? "Processing..." : "Book Service"}
          </Button> */}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
