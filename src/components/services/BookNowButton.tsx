import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useUser } from "@/hooks/use-user";
import { useToast } from "@/components/ui/use-toast";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

interface Service {
  id: string;
  title: string;
  price: number;
  currency_created_in: string;
}

interface BookNowButtonProps {
  service: Service;
  onOpenModal?: () => void;
}

export function BookNowButton({ service, onOpenModal }: BookNowButtonProps) {
  const { user } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();
  const [isChecking, setIsChecking] = useState(false);

  const handleBookNow = async () => {
    if (!user) {
      toast({
        title: "Sign in required",
        description: "Please sign in to book this service",
        variant: "destructive",
      });
      
      setTimeout(() => {
        navigate("/signin", { state: { from: location } });
      }, 2000);
      
      return;
    }

    setIsChecking(true);

    try {
      const { data: draftBookings, error } = await supabase
        .from("bookings")
        .select("id, status")
        .eq("customer_id", user.id)
        .eq("service_id", service.id)
        .eq("status", "draft")
        .order("created_at", { ascending: false })
        .limit(1);

      if (error) {
        throw error;
      }

      if (draftBookings && draftBookings.length > 0) {
        toast({
          title: "Draft booking found",
          description: "Loading your previous booking information",
        });
        
        if (onOpenModal) {
          onOpenModal();
        } else {
          navigate(`/book/${service.id}`, {
            state: {
              serviceId: service.id,
              serviceTitle: service.title,
              servicePrice: service.price,
              serviceCurrency: service.currency_created_in,
            },
          });
        }
        return;
      }

      if (onOpenModal) {
        onOpenModal();
      } else {
        navigate(`/book/${service.id}`, {
          state: {
            serviceId: service.id,
            serviceTitle: service.title,
            servicePrice: service.price,
            serviceCurrency: service.currency_created_in,
          },
        });
      }
    } catch (error) {
      console.error("Error checking for draft bookings:", error);
      if (onOpenModal) {
        onOpenModal();
      } else {
        navigate(`/book/${service.id}`, {
          state: {
            serviceId: service.id,
            serviceTitle: service.title,
            servicePrice: service.price,
            serviceCurrency: service.currency_created_in,
          },
        });
      }
    } finally {
      setIsChecking(false);
    }
  };

  return (
    <Button onClick={handleBookNow} disabled={isChecking}>
      {isChecking ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Checking...
        </>
      ) : (
        "Book Now"
      )}
    </Button>
  );
} 