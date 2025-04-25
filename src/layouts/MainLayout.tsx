import { useState, useEffect } from "react";
import { Sidebar } from "@/components/home/Sidebar";
import { MobileHeader } from "@/components/home/MobileHeader";
import { supabase } from "@/integrations/supabase/client";
import { RoleSetupModal } from "@/components/onboarding/RoleSetupModal";
import { useNavigate, useLocation } from "react-router-dom";
import { useNotifications } from "@/contexts/NotificationContext";

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
  userRole,
  isAuthenticated: propIsAuthenticated,
  unreadNotifications: propUnreadNotifications,
  unreadMessages: propUnreadMessages
}: MainLayoutProps) {
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(propIsAuthenticated !== undefined ? propIsAuthenticated : false);
  const navigate = useNavigate();
  const location = useLocation();
  // Get notification counts from context
  const { unreadNotifications, unreadMessages } = useNotifications();

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session) {
          setIsAuthenticated(true);
          
          // Get user profile data to check role and onboarding status
          const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single();
          
          if (!error && data) {
            // Check if onboarding is completed
            if (!data.onboarding_completed) {
              // Redirect to onboarding if not completed
              navigate('/onboarding');
              return;
            }
            
            // If userRole prop is not provided (and hence setUserRole is also not provided),
            // we don't try to update it
            if (typeof userRole === 'undefined' && 'user_role' in data) {
              // Just log it for debugging - we don't have access to setter
              console.log("User role found:", data.user_role);
            }
            // Otherwise we're just using the userRole passed as a prop
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch (error) {
        console.error("Error fetching profile:", error);
      }
    };
    
    checkUserStatus();
  }, [propIsAuthenticated, userRole, navigate]);

  const handleOnboardingComplete = async () => {
    setShowOnboarding(false);
    
    // Refresh user role after onboarding
    const { data } = await supabase
      .from('profiles')
      .select('user_role')
      .eq('id', (await supabase.auth.getUser()).data.user?.id || "")
      .single();
    
    // We don't need to do anything with userRole here since it's not a setter
    console.log("Onboarding complete, new role:", data?.user_role);
  };
  
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-pulse text-center">
          <div className="w-16 h-16 border-4 border-t-primary border-r-transparent border-b-transparent border-l-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white/60">Loading...</p>
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
      {/* Desktop sidebar - remains hidden on mobile */}
      <Sidebar 
        activeTab={activeTab} 
        setActiveTab={setActiveTab} 
        userRole={userRole} 
        isAuthenticated={isAuthenticated} 
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
      
      {isAuthenticated && (
        <RoleSetupModal 
          isOpen={showOnboarding} 
          onComplete={handleOnboardingComplete} 
        />
      )}
    </div>
  );
} 