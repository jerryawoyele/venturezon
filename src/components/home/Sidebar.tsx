import { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import {
  Home as HomeIcon,
  Compass,
  Send,
  Heart,
  User,
  LogOut,
  LogIn,
  Bell as BellIcon,
  Briefcase as BriefcaseIcon,
  ShoppingCart
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { AuthRequiredModal } from "@/components/auth/AuthRequiredModal";
import { Link } from "react-router-dom";
import { CUSTOMER_NAV_ITEMS, BUSINESS_NAV_ITEMS } from "@/constants/navigation";

interface SidebarProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
  userRole?: "business" | "customer" | null;
  isAuthenticated?: boolean;
  unreadNotifications?: number;
  unreadMessages?: number;
}

interface NavItemProps {
  icon: React.ReactNode;
  label: string;
  isActive: boolean;
  onClick: () => void;
  badgeCount?: number;
}

// Add this component to define NavItem
const NavItem = ({ icon, label, isActive, onClick, badgeCount = 0 }: NavItemProps) => {
  return (
    <Button
      variant="ghost"
      className={cn(
        "w-full justify-start gap-3 py-6 px-4 text-base",
        isActive
          ? "bg-gray-300  dark:bg-zinc-700 dark:text-white  text-black"
          : "hover:bg-gray-300 dark:hover:bg-zinc-700 dark:hover:text-white  hover:text-black"
      )}
      onClick={onClick}
    >
      <div className="relative">
        {icon}
        {badgeCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-primary lg:bg-slate-700 text-white text-xs font-bold rounded-full h-5 w-5 flex items-center justify-center">
            {badgeCount > 99 ? '99+' : badgeCount}
          </span>
        )}
      </div>
      <span>{label}</span>
    </Button>
  );
};

export function Sidebar({
  activeTab,
  setActiveTab,
  userRole = "customer",
  isAuthenticated = true,
  unreadNotifications = 0,
  unreadMessages = 0,
}: SidebarProps) {
  const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [navItems, setNavItems] = useState<typeof CUSTOMER_NAV_ITEMS>([]);
  const navigate = useNavigate();
  const location = useLocation();

  // Set the correct navigation items based on user role
  useEffect(() => {
    if (userRole === "business") {
      setNavItems(BUSINESS_NAV_ITEMS);
    } else {
      setNavItems(CUSTOMER_NAV_ITEMS);
    }
  }, [userRole]);

  const handleNavigation = (label: string, path: string) => {
    // If not authenticated and trying to access restricted pages
    const publicPages = ['/discover', '/auth'];
    const isUserProfile = path.startsWith('/user/');
    
    if (!isAuthenticated && !publicPages.includes(path) && !isUserProfile) {
      setShowAuthModal(true);
      return;
    }
    
    // Prevent accessing role-specific routes
    if (userRole === "customer" && path === "/services") {
      // Customers don't have access to services page
      navigate('/bookings');
      setActiveTab("Bookings");
      return;
    } else if (userRole === "business" && path === "/bookings") {
      // Business users should see services first
      navigate('/services');
      setActiveTab("Services");
      return;
    }
    
    setActiveTab(label);
    navigate(path);
  };

  const handleLogoutClick = () => {
    setShowLogoutConfirm(true);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setShowLogoutConfirm(false);
    navigate("/");
  };
  
  const handleLoginClick = () => {
    navigate("/auth");
  };

  // Mobile Bottom Navigation
  const mobileNav = (
    <nav className="fixed bottom-0 left-0 right-0 w-full bg-[hsl(0,0%,93%)] dark:bg-[hsl(240,10%,12%)] border-t border-border px-2 py-3 lg:hidden z-50">
      <ul className="flex justify-around max-w-screen-xl mx-auto">
        {navItems.map((item) => (
          <li key={item.label}>
            <Button
              variant="ghost"
              className={cn(
                "flex flex-col items-center justify-center p-2 ",
                activeTab === item.label && "bg-primary/10 text-primary"
              )}
              onClick={() => handleNavigation(item.label, item.path)}
            >
              <div className="relative">
                <item.icon className="w-5 h-5" />
                {item.label === "Messages" && unreadMessages > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadMessages > 99 ? '99+' : unreadMessages}
                  </span>
                )}
                {item.label === "Profile" && unreadNotifications > 0 && (
                  <span className="absolute -top-1 -right-1 bg-primary text-white text-xs font-bold rounded-full h-4 w-4 flex items-center justify-center">
                    {unreadNotifications > 99 ? '99+' : unreadNotifications}
                  </span>
                )}
              </div>
              <span className="sr-only">{item.label}</span>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );

  // Desktop Sidebar
  const desktopNav = (
    <div className="hidden lg:flex flex-col fixed left-0 top-0 h-screen w-64 bg-[hsl(0,0%,93%)] dark:bg-[hsl(240,10%,12%)] border-r border-border z-30">
      <div className="p-4 border-b border-border mb-2">
        <Link to="/" className="flex items-center space-x-2">
          <span className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-purple-600">Venturezon</span>
        </Link>
      </div>

      <div className="flex-1 px-3 py-2">
        <div className="space-y-2">
          {navItems.map((item) => (
            <NavItem
              key={item.label}
              icon={<item.icon />}
              label={item.label}
              isActive={activeTab === item.label}
              onClick={() => handleNavigation(item.label, item.path)}
              badgeCount={
                item.label === "Messages" 
                  ? unreadMessages 
                  : item.label === "Profile" 
                    ? unreadNotifications 
                    : 0
              }
            />
          ))}
        </div>
      </div>
      
      <div className="p-2 w-full border-t border-border mt-2">
        {isAuthenticated ? (
          <Button
            variant="ghost"
            className="justify-start gap-3 w-full py-6 px-4 dark:hover:bg-zinc-700 hover:bg-gray-300 hover:text-black dark:hover:text-white"
            onClick={handleLogoutClick}
          >
            <LogOut className="w-5 h-5" />
            <span>Logout</span>
          </Button>
        ) : (
          <Button
            variant="ghost"
            className="justify-start gap-3 w-full py-6 px-4 hover:bg-primary hover:text-white"
            onClick={handleLoginClick}
          >
            <LogIn className="w-5 h-5" />
            <span>Login</span>
          </Button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {desktopNav}
      {mobileNav}

      {/* Logout Confirmation Dialog */}
      <Dialog open={showLogoutConfirm} onOpenChange={setShowLogoutConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Logout</DialogTitle>
            <DialogDescription>
              Are you sure you want to log out? You will need to sign in again
              to access your account.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowLogoutConfirm(false)}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleLogout}>
              Logout
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Auth Required Modal */}
      <AuthRequiredModal 
        isOpen={showAuthModal} 
        setIsOpen={setShowAuthModal} 
        message="You need to sign in to access this feature."
      />
    </>
  );
}
