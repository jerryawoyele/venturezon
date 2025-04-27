import { useState, useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { 
  CalendarIcon, 
  Clock, 
  MapPin, 
  DollarSign, 
  Check, 
  Loader2, 
  ArrowLeft, 
  ArrowRight,
  CheckCircle,
  ShieldCheck 
} from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { useUser } from "@/hooks/use-user";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { 
  Dialog, 
  DialogContent, 
  DialogFooter, 
  DialogHeader, 
  DialogTitle,
  DialogDescription
} from "@/components/ui/dialog";
import { useCurrency } from "@/contexts/CurrencyContext";

interface MultiStepBookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentService: any;
  providerId: string;
}

const formSchema = z.object({
  date: z.date({
    required_error: "Please select a date",
  }).refine(date => date >= new Date(new Date().setHours(0, 0, 0, 0)), {
    message: "Booking date cannot be in the past",
  }),
  time: z.string().min(1, "Please select a time"),
  location: z.string().min(3, "Please provide a location"),
  notes: z.string().optional(),
  serviceIds: z.array(z.string()).min(1, "Please select at least one service"),
});

export function MultiStepBookingModal({ isOpen, onClose, currentService, providerId }: MultiStepBookingModalProps) {
  const [step, setStep] = useState(1);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [services, setServices] = useState<any[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [checkingActiveBookings, setCheckingActiveBookings] = useState(false);
  const [activeBookings, setActiveBookings] = useState<any[]>([]);
  const { user } = useUser();
  const { toast } = useToast();
  const navigate = useNavigate();
  const intentionalSubmitRef = useRef(false);
  const { formatPrice, symbol } = useCurrency();

  // Get tomorrow as the default date to avoid any timezone issues with today
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(0, 0, 0, 0);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      date: tomorrow,
      time: "10:00",
      location: "",
      notes: "",
      serviceIds: currentService ? [currentService.id] : [],
    },
  });

  // Reset form and step when modal is opened
  useEffect(() => {
    if (isOpen) {
      setStep(1);
      if (currentService) {
        form.setValue("serviceIds", [currentService.id]);
      }
      
      // Check for active bookings when modal opens
      if (user) {
        checkForActiveBookings();
      }
    }
  }, [isOpen, currentService, form, user]);

  // Check if the user has any active bookings for the selected services
  const checkForActiveBookings = async () => {
    if (!user || !providerId) return;
    
    setCheckingActiveBookings(true);
    try {
      // Get all active bookings for the current user
      const { data: bookings, error } = await supabase
        .from("bookings")
        .select(`
          id,
          service_id,
          status,
          payment_status
        `)
        .eq("customer_id", user.id)
        .in("status", ["pending", "confirmed", "in_progress"])
        .not("payment_status", "eq", "refunded");
        
      if (error) throw error;
      
      if (bookings && bookings.length > 0) {
        setActiveBookings(bookings);
        
        // Check if current service is already booked
        if (currentService && bookings.some(booking => booking.service_id === currentService.id)) {
          toast({
            title: "Service already booked",
            description: "You already have an active booking for this service. Please wait until it's completed or cancelled before booking again.",
            variant: "destructive",
          });
          onClose();
        }
      }
    } catch (error) {
      console.error("Error checking active bookings:", error);
    } finally {
      setCheckingActiveBookings(false);
    }
  };

  // Fetch all services from the same provider
  useEffect(() => {
    const fetchServices = async () => {
      if (!providerId) return;
      
      setLoadingServices(true);
      try {
        const { data, error } = await supabase
          .from("services")
          .select("*")
          .eq("owner_id", providerId);
          
        if (error) throw error;
        setServices(data || []);
      } catch (error) {
        console.error("Error fetching services:", error);
        toast({
          title: "Error",
          description: "Failed to load services from this provider",
          variant: "destructive",
        });
      } finally {
        setLoadingServices(false);
      }
    };
    
    if (isOpen && providerId) {
      fetchServices();
    }
  }, [isOpen, providerId, toast]);

  const onSubmit = async (values: z.infer<typeof formSchema>) => {
    // Only proceed if this is an intentional submission from the Book Now button
    if (!intentionalSubmitRef.current && step === 3) {
      // If we're on step 3 but this wasn't triggered by the button click,
      // prevent form submission
      return;
    }
    
    if (!user) {
      toast({
        title: "Authentication required",
        description: "Please log in to book services",
        variant: "destructive",
      });
      onClose();
      navigate("/auth");
      return;
    }
    
    // Check if any selected service is already booked
    const selectedServiceIds = form.getValues("serviceIds");
    const alreadyBookedServices = services.filter(service => 
      selectedServiceIds.includes(service.id) && 
      activeBookings.some(booking => booking.service_id === service.id)
    );
    
    if (alreadyBookedServices.length > 0) {
      toast({
        title: "Service already booked",
        description: `You already have active bookings for: ${alreadyBookedServices.map(s => s.title).join(", ")}. Please wait until they're completed or cancelled.`,
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      // Combine date and time
      const scheduledDateTime = new Date(values.date);
      const [hours, minutes] = values.time.split(":").map(Number);
      scheduledDateTime.setHours(hours, minutes);

      const serviceIdsArray = Array.isArray(values.serviceIds) 
        ? values.serviceIds 
        : [values.serviceIds];

      // Find the main service (the first one or the current service)
      const mainServiceId = serviceIdsArray[0];
      const mainService = services.find(s => s.id === mainServiceId) || currentService;

      if (!mainService) {
        throw new Error("Main service not found");
      }

      // Calculate platform fee and final price
      const subtotal = getTotalPrice();
      const platformFee = getPlatformFee();
      const finalPrice = getFinalPrice();

      // Create booking data object first to validate
      const bookingData = {
        service_id: mainServiceId, // Use first service as main service
        customer_id: user.id,
        provider_id: providerId,
        status: "pending", // Changed from "draft" to "pending"
        payment_status: "pending",
        notes: `Date: ${format(scheduledDateTime, "PPP")}\nTime: ${format(scheduledDateTime, "p")}\nLocation: ${values.location}${
          serviceIdsArray.length > 1 
            ? `\n\nAdditional Services: ${serviceIdsArray.slice(1).join(", ")}` 
            : ""
        }${values.notes ? `\n\nAdditional Notes: ${values.notes}` : ""}`,
        total_price: finalPrice
      };

      console.log("Submitting booking data:", bookingData);

      // Insert the booking
      const { data: newBooking, error: bookingError } = await supabase
        .from("bookings")
        .insert(bookingData)
        .select()
        .single();

      if (bookingError) {
        console.error("Booking error details:", bookingError);
        throw new Error(bookingError.message || "Failed to create booking");
      }

      if (!newBooking) {
        throw new Error("No booking data returned from server");
      }

      toast({
        title: "Booking created",
        description: "Your booking is being processed. Redirecting to payment...",
      });

      // Redirect to payment page with booking ID only if intentional submit
      if (intentionalSubmitRef.current) {
        navigate(`/payment/${newBooking.id}`);
        onClose(); // Close the modal
      }
    } catch (error: any) {
      console.error("Error creating booking:", error);
      let errorMessage = "There was an error processing your booking. Please try again.";
      
      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null) {
        errorMessage = JSON.stringify(error);
      }
      
      toast({
        title: "Booking failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
      intentionalSubmitRef.current = false; // Reset after submission
    }
  };

  const nextStep = () => {
    // Reset intentional submit flag when moving between steps
    intentionalSubmitRef.current = false;
    
    // Validate the current step before proceeding
    if (step === 1) {
      const serviceIds = form.getValues("serviceIds");
      if (!serviceIds || serviceIds.length === 0) {
        toast({
          title: "Please select a service",
          description: "You must select at least one service to continue",
          variant: "destructive",
        });
        return;
      }
      setStep(2);
    } else if (step === 2) {
      form.trigger(["date", "time", "location"]);
      if (form.formState.errors.date || form.formState.errors.time || form.formState.errors.location) {
        return;
      }
      setStep(3);
    }
  };

  const prevStep = () => {
    // Reset intentional submit flag when moving between steps
    intentionalSubmitRef.current = false;
    
    if (step > 1) {
      setStep(step - 1);
    }
  };

  // Calculate platform fee percentage based on total price
  const getPlatformFeePercentage = (price: number) => {
    if (price >= 1000) return 1; // 1% for bookings >= $1000
    if (price <= 50) return 8;   // 8% for bookings <= $50
    
    // For amounts between $50 and $1000, calculate a sliding scale
    // From 8% at $50 to 1% at $1000
    const percentage = 8 - ((price - 50) / (1000 - 50)) * (8 - 1);
    return Math.round(percentage * 10) / 10; // Round to 1 decimal place
  };

  // Calculate platform fee amount
  const getPlatformFee = () => {
    const totalPrice = getTotalPrice();
    const feePercentage = getPlatformFeePercentage(totalPrice);
    return (totalPrice * feePercentage) / 100;
  };

  // Calculate final price including platform fee
  const getFinalPrice = () => {
    const totalPrice = getTotalPrice();
    const platformFee = getPlatformFee();
    return totalPrice + platformFee;
  };

  const handleToggleService = (serviceId: string) => {
    const currentServiceIds = form.getValues("serviceIds") || [];
    const isSelected = currentServiceIds.includes(serviceId);
    
    if (isSelected) {
      // Don't allow deselecting if it's the only service selected
      if (currentServiceIds.length === 1) {
        toast({
          title: "At least one service required",
          description: "You must select at least one service",
          variant: "destructive",
        });
        return;
      }
      // Remove the service
      form.setValue("serviceIds", currentServiceIds.filter(id => id !== serviceId));
    } else {
      // Add the service
      form.setValue("serviceIds", [...currentServiceIds, serviceId]);
    }
  };

  const getTotalPrice = () => {
    const serviceIds = form.getValues("serviceIds") || [];
    return services
      .filter(service => serviceIds.includes(service.id))
      .reduce((total, service) => total + (service.price || 0), 0);
  };

  const renderStepContent = () => {
    switch (step) {
      case 1:
        return (
          <div className="space-y-4">
            <DialogDescription>
              Select the services you'd like to book. You can select multiple services.
            </DialogDescription>
            
            {loadingServices ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin" />
              </div>
            ) : (
              <div className="space-y-3 max-h-[50vh] overflow-y-auto pt-2 pr-1">
                {services.map(service => {
                  const isSelected = form.getValues("serviceIds")?.includes(service.id);
                  return (
                    <Card 
                      key={service.id} 
                      className={`cursor-pointer transition-all ${isSelected ? 'border-primary' : 'border-border'}`}
                      onClick={() => handleToggleService(service.id)}
                    >
                      <CardContent className="p-4 flex items-center gap-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <h3 className="font-medium text-lg">{service.title}</h3>
                            {isSelected && (
                              <CheckCircle className="text-primary h-4 w-4" />
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2 mt-1">
                            {service.description}
                          </p>
                          <div className="flex flex-wrap items-center gap-4 mt-2 text-sm">
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3 text-muted-foreground" />
                              <span>
                                {service.duration_minutes < 60
                                  ? `${service.duration_minutes}m`
                                  : `${Math.floor(service.duration_minutes / 60)}h${
                                      service.duration_minutes % 60 ? ` ${service.duration_minutes % 60}m` : ""
                                    }`}
                              </span>
                            </div>
                            <Badge>{service.category}</Badge>
                          </div>
                        </div>
                        <div className="text-lg font-semibold text-primary">
                          {formatPrice(service.price)}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
            
            <div className="pt-2">
              <div className="flex justify-between items-center px-1">
                <span className="font-medium">Selected Services:</span>
                <span>{form.getValues("serviceIds")?.length || 0}</span>
              </div>
              <div className="flex justify-between items-center px-1 mt-1">
                <span className="font-medium">Total:</span>
                <span className="text-lg font-semibold">{formatPrice(getTotalPrice())}</span>
              </div>
            </div>
          </div>
        );
        
      case 2:
        return (
          <div className="space-y-4">
            <DialogDescription>
              Schedule your appointment by selecting a date, time, and location.
            </DialogDescription>
            
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="date">Date</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="date"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !form.watch("date") && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {form.watch("date") ? (
                        format(form.watch("date"), "PPP")
                      ) : (
                        <span>Select date</span>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={form.watch("date")}
                      onSelect={(date) => {
                        if (date) {
                          form.setValue("date", date, { shouldValidate: true });
                        }
                      }}
                      disabled={(date) => 
                        date < new Date(new Date().setHours(0, 0, 0, 0))
                      }
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
                {form.formState.errors.date && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.date.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="time">Time</Label>
                <div className="flex items-center">
                  <Clock className="h-4 w-4 mr-2 text-muted-foreground" />
                  <Input
                    id="time"
                    type="time"
                    {...form.register("time")}
                  />
                </div>
                {form.formState.errors.time && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.time.message as string}
                  </p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="location">Location</Label>
                <div className="flex items-center">
                  <MapPin className="h-4 w-4 mr-2 text-muted-foreground" />
                  <Input
                    id="location"
                    placeholder="Enter the service location"
                    {...form.register("location")}
                  />
                </div>
                {form.formState.errors.location && (
                  <p className="text-sm text-red-500">
                    {form.formState.errors.location.message as string}
                  </p>
                )}
              </div>
            </div>
          </div>
        );
        
      case 3:
        return (
          <div className="space-y-4">
            <DialogDescription>
              Review your booking details and add any additional notes.
            </DialogDescription>
            
            <div className="space-y-4">
              <div className="bg-muted/30 p-4 rounded-lg space-y-3">
                <h3 className="font-medium">Selected Services</h3>
                <div className="space-y-2">
                  {services
                    .filter(service => form.getValues("serviceIds")?.includes(service.id))
                    .map(service => (
                      <div key={service.id} className="flex justify-between items-center">
                        <span>{service.title}</span>
                        <span>{formatPrice(service.price)}</span>
                      </div>
                    ))
                  }
                  <div className="pt-2 border-t border-border flex justify-between items-center">
                    <span>Subtotal</span>
                    <span>{formatPrice(getTotalPrice())}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm text-muted-foreground">
                    <span>Platform fee ({getPlatformFeePercentage(getTotalPrice())}%)</span>
                    <span>{formatPrice(getPlatformFee())}</span>
                  </div>
                  <div className="pt-2 border-t border-border flex justify-between items-center font-medium">
                    <span>Total</span>
                    <span>{formatPrice(getFinalPrice())}</span>
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Date</Label>
                  <div className="flex items-center gap-1">
                    <CalendarIcon className="h-3 w-3 text-muted-foreground" />
                    <span>{format(form.getValues("date"), "PPP")}</span>
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Time</Label>
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-muted-foreground" />
                    <span>{form.getValues("time")}</span>
                  </div>
                </div>
                <div className="space-y-1 col-span-1 sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Location</Label>
                  <div className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-muted-foreground" />
                    <span>{form.getValues("location")}</span>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="notes">Additional Notes (optional)</Label>
                <Textarea
                  id="notes"
                  placeholder="Any special requirements or information for the service provider"
                  rows={3}
                  {...form.register("notes")}
                />
              </div>
              
              {/* Payment Information - Now displayed above the Book Now button */}
              <div className="bg-primary/5 p-4 rounded-lg space-y-2 border border-primary/20">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-primary">{symbol}</span>
                  <h3 className="font-medium">Payment Information</h3>
                </div>
                <p className="text-sm text-muted-foreground">
                  Total Price: <span className="font-medium">{formatPrice(getFinalPrice(), 'USD')}</span>
                </p>
                <div className="flex items-center gap-1.5 text-sm text-primary">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  <span>Secure payment processing</span>
                </div>
                <p className="text-sm text-muted-foreground">
                  Your payment will be held in escrow until you confirm the service has been completed satisfactorily.
                </p>
              </div>
            </div>
          </div>
        );
        
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-[550px] w-[calc(100%-2rem)] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Book Service</DialogTitle>
        </DialogHeader>
        
        <div className="mb-4 border-b pb-2">
          <div className="flex justify-between items-center">
            <div className="flex gap-1 sm:gap-2 items-center">
              <div className={`rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center text-xs sm:text-sm ${step >= 1 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                1
              </div>
              <span className={`text-xs sm:text-sm ${step >= 1 ? 'font-medium' : 'text-muted-foreground'}`}>Services</span>
            </div>
            <div className="h-0.5 w-4 sm:w-10 bg-muted flex-shrink-0" />
            <div className="flex gap-1 sm:gap-2 items-center">
              <div className={`rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center text-xs sm:text-sm ${step >= 2 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                2
              </div>
              <span className={`text-xs sm:text-sm ${step >= 2 ? 'font-medium' : 'text-muted-foreground'}`}>Schedule</span>
            </div>
            <div className="h-0.5 w-4 sm:w-10 bg-muted flex-shrink-0" />
            <div className="flex gap-1 sm:gap-2 items-center">
              <div className={`rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center text-xs sm:text-sm ${step >= 3 ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'}`}>
                3
              </div>
              <span className={`text-xs sm:text-sm ${step >= 3 ? 'font-medium' : 'text-muted-foreground'}`}>Review</span>
            </div>
            <div className="h-0.5 w-4 sm:w-10 bg-muted flex-shrink-0 hidden sm:block" />
            <div className="flex gap-1 sm:gap-2 items-center hidden sm:flex">
              <div className={`rounded-full h-5 w-5 sm:h-6 sm:w-6 flex items-center justify-center text-xs sm:text-sm bg-muted text-muted-foreground`}>
                4
              </div>
              <span className="text-xs sm:text-sm text-muted-foreground">Payment</span>
            </div>
          </div>
        </div>
        
        <form 
          onSubmit={(e) => {
            if (step < 3) {
              e.preventDefault();
              return;
            }
            form.handleSubmit(onSubmit)(e);
          }} 
          noValidate
        >
          {renderStepContent()}
          
          <DialogFooter className="mt-6 flex justify-between items-center">
            {step > 1 ? (
              <Button 
                type="button" 
                variant="outline" 
                onClick={prevStep}
                className="flex items-center"
                disabled={isSubmitting}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            ) : (
              <div></div> // Placeholder for spacing
            )}
            
            {step < 3 ? (
              <Button 
                type="button" 
                onClick={nextStep}
                className="flex items-center"
              >
                Next
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            ) : (
              <Button 
                type="submit" 
                disabled={isSubmitting}
                className="flex items-center"
                onClick={() => {
                  intentionalSubmitRef.current = true;
                }}
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    Book and Proceed to Payment
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            )}
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
} 