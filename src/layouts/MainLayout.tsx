import { useState, useEffect } from "react";
import { Sidebar } from "@/components/home/Sidebar";
import { MobileHeader } from "@/components/home/MobileHeader";
import { supabase } from "@/integrations/supabase/client";
import { RoleSetupModal } from "@/components/onboarding/RoleSetupModal";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";
import { Loader2 } from "lucide-react";

interface MainLayoutProps {
  children: React.ReactNode;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: "business" | "customer" | null;
  isAuthenticated?: boolean;
  unreadNotifications?: number;
  unreadMessages?: number;
}

export function MainLayout({ 
  children, 
  activeTab, 
  setActiveTab, 
  unreadNotifications: propUnreadNotifications,
  unreadMessages: propUnreadMessages
}: MainLayoutProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isReady, setIsReady] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  // Get notification counts from context
  const { unreadNotifications, unreadMessages } = useNotifications();
  // Get authentication state from context
  const { user, isLoading: authLoading, userRole } = useAuth();

  // Wait for authentication to complete before showing anything
  useEffect(() => {
    if (!authLoading) {
      // First check is complete, now check onboarding status
      checkOnboardingStatus();
    }
  }, [authLoading]);
  
  // Check if redirection is needed based on user role
  useEffect(() => {
    if (!authLoading && user && userRole) {
      // If on a role-specific page, redirect if needed
      const path = location.pathname;
      
      if (userRole === "business" && path === "/bookings") {
        // Business users should see services
        navigate('/services');
        setActiveTab("Services");
      } else if (userRole === "customer" && path === "/services") {
        // Customers should see bookings
        navigate('/bookings');
        setActiveTab("Bookings");
      }
      
      // Now we're ready to show the UI
      setIsReady(true);
      setIsLoading(false);
    } else if (!authLoading && !user) {
      // User is not authenticated, we can still show the UI
      setIsReady(true);
      setIsLoading(false);
    }
  }, [authLoading, user, userRole, location.pathname, navigate, setActiveTab]);

  const checkOnboardingStatus = async () => {
    try {
      if (user) {
        // Get user profile data to check onboarding status
        const { data, error } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', user.id)
          .single();
        
        if (!error && data) {
          // Check if onboarding is completed
          if (!data.onboarding_completed) {
            // Redirect to onboarding if not completed
            navigate('/onboarding');
            return;
          }
        }
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    }
  };

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
  };
  
  // Show loading state if any loading is happening
  if (isLoading || authLoading || !isReady) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <Loader2 className="h-12 w-12 animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading your experience...</p>
        </div>
      </div>
    );
  }

  // Use the notification counts from context or props if provided
  const displayUnreadNotifications = propUnreadNotifications !== undefined 
    ? propUnreadNotifications 
    : unreadNotifications;
    
  const displayUnreadMessages = propUnreadMessages !== undefined 
    ? propUnreadMessages 
    : unreadMessages;

  return (
    <div className="min-h-screen bg-[hsl(0,0%,93%)] dark:bg-[hsl(240,10%,8%)] flex flex-col">
      {/* Only render the sidebar when we're fully ready */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole} 
        isAuthenticated={!!user} 
        unreadNotifications={displayUnreadNotifications}
        unreadMessages={displayUnreadMessages}
      />
      
      {/* Main content area */}
      <div className="flex-1 lg:ml-64 lg:max-w-[calc(100vw-64px)] overflow-x-hidden">
        <MobileHeader 
          unreadNotifications={displayUnreadNotifications}
          unreadMessages={displayUnreadMessages}
        />
        <div className="container mx-auto pt-4 lg:pt-8 pb-24 lg:pb-8 px-4">
          {children}
        </div>
      </div>
      
      {user && (
        <RoleSetupModal 
          isOpen={showOnboarding} 
          onComplete={handleOnboardingComplete} 
        />
      )}
    </div>
  );
} 