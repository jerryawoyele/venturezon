import { Share2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/use-toast";

interface ShareServiceButtonProps {
  serviceId: string;
  serviceTitle?: string;
  className?: string;
  variant?: "ghost" | "outline" | "default";
  size?: "icon" | "sm" | "default" | "lg";
  showText?: boolean;
}

export function ShareServiceButton({ 
  serviceId, 
  serviceTitle, 
  className = "", 
  variant = "ghost", 
  size = "icon",
  showText = false
}: ShareServiceButtonProps) {
  const { toast } = useToast();
  
  const handleShare = async () => {
    // Generate the URL to share
    const serviceUrl = `${window.location.origin}/services/${serviceId}`;
    
    if (navigator.share) {
      // Use the Web Share API if available (mobile devices)
      try {
        await navigator.share({
          title: `${serviceTitle || 'Service'} on Markezon`,
          text: `Check out this service on Markezon: ${serviceTitle || 'View service details'}`,
          url: serviceUrl
        });
      } catch (error) {
        if ((error as Error).name !== 'AbortError') {
          console.error('Error sharing:', error);
          // Fallback to clipboard
          copyToClipboard(serviceUrl);
        }
      }
    } else {
      // Fallback for desktop: copy to clipboard
      copyToClipboard(serviceUrl);
    }
  };
  
  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Link copied!",
        description: "Service link copied to clipboard"
      });
    }).catch(err => {
      console.error('Failed to copy:', err);
      toast({
        title: "Failed to copy",
        description: "Please try again",
        variant: "destructive"
      });
    });
  };
  
  return (
    <Button 
      variant={variant} 
      size={size} 
      onClick={handleShare}
      className={className}
      aria-label="Share service"
    >
      <Share2 className="h-5 w-5" />
      {showText && <span className="ml-2">Share</span>}
    </Button>
  );
} 