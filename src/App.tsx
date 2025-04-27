import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { OfflineAlert } from "@/components/OfflineAlert";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ThemeProvider } from "@/contexts/ThemeContext";
import { AuthProvider } from "@/contexts/AuthContext";
import { CurrencyProvider } from "@/contexts/CurrencyContext";
import Index from "./pages/Index";
import Auth from "./pages/Auth";
import Home from "./pages/Home";
import Discover from "./pages/Discover";
import Messages from "./pages/Messages";
import Notifications from "./pages/Notifications";
import { Profile } from "./pages/Profile";
import { UserProfile } from "./pages/UserProfile";
import NotFound from "./pages/NotFound";
import AuthCallback from "./pages/AuthCallback";
import { UsernameSetup } from "./components/onboarding/UsernameSetup";
import { Onboarding } from "./pages/Onboarding";
import { useEffect, useState } from "react";
import ServiceDetailPage from "./pages/ServiceDetailPage";
import Settings from "./pages/Settings";
import ServicesAndBookingsPage from "./pages/ServicesAndBookingsPage";
import BookingDetailsPage from "./pages/BookingDetailsPage";
import PaymentPage from "./pages/PaymentPage";
import EmailConfirmation from "./pages/EmailConfirmation";
import { Analytics } from "@vercel/analytics/react";
import CurrencyDisplayWrapper from "./components/currency/CurrencyDisplayWrapper";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false, // Prevents refetching data when window regains focus
      staleTime: 1000 * 60 * 5, // Data is fresh for 5 minutes
      gcTime: 1000 * 60 * 30, // Cache is kept for 30 minutes (previously cacheTime)
    },
  },
});

// This simple script runs immediately to ensure we have the right currency set
// for Nigerian users before the React app even loads
(() => {
  try {
    // Check if the user is likely in Nigeria
    const isNigeria = 
      navigator.languages?.some(lang => lang.includes('NG') || lang.includes('ng')) ||
      Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Lagos') ||
      window.location.hostname.endsWith('.ng');
    
    // If user hasn't set a preference and is in Nigeria, default to NGN
    if (isNigeria && !localStorage.getItem('currency_preference')) {
      console.log('Nigerian user detected on page load, setting currency to NGN');
      localStorage.setItem('currency_preference', 'NGN');
    }
  } catch (e) {
    console.error('Early currency detection failed:', e);
  }
})();

const App = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // If offline, only show the offline alert
  if (!isOnline) {
    return <OfflineAlert />;
  }

  return (
      <AuthProvider>
    <QueryClientProvider client={queryClient}>
        <ThemeProvider>
          <CurrencyProvider>
            <CurrencyDisplayWrapper>
              <TooltipProvider>
                <NotificationProvider>
                  <BrowserRouter>
                    <Toaster />
                    <Sonner position="top-right" className="z-[100]" />
                    <div className="fixed bottom-4 left-4 z-50">
                      {!navigator.onLine && <OfflineAlert />}
                    </div>
                    <Analytics />

                    <Routes>
                      <Route path="/" element={<Index />} />
                      <Route path="/auth" element={<Auth />} />
                      <Route path="/email-confirmation" element={<EmailConfirmation />} />
                      <Route path="/home" element={<Home />} />
                      <Route path="/discover" element={<Discover />} />
                      <Route path="/messages" element={<Messages />} />
                      <Route path="/notifications" element={<Notifications />} />
                      <Route path="/profile" element={<Profile />} />
                      <Route path="/settings" element={<Settings />} />
                      <Route path="/:username" element={<UserProfile />} />
                      <Route path="/:username/:postId" element={<UserProfile />} />
                      <Route path="/user/:userId" element={<UserProfile />} />
                      <Route path="/user/:userId/:postId" element={<UserProfile />} />
                      <Route path="/userprofile/:userId" element={<UserProfile />} />
                      <Route
                        path="/userprofile/:userId/:postId"
                        element={<UserProfile />}
                      />
                      <Route path="/auth-callback" element={<AuthCallback />} />
                      <Route path="/setup-username" element={<UsernameSetup />} />
                      <Route path="/onboarding" element={<Onboarding />} />
                      <Route path="/services" element={<ServicesAndBookingsPage />} />
                      <Route
                        path="/services/:serviceId"
                        element={<ServiceDetailPage />}
                      />
                      <Route path="/bookings" element={<ServicesAndBookingsPage />} />
                      <Route path="/bookings/:id" element={<BookingDetailsPage />} />
                      <Route path="/payment/:bookingId" element={<PaymentPage />} />
                      <Route path="*" element={<NotFound />} />
                    </Routes>
                  </BrowserRouter>
                </NotificationProvider>
              </TooltipProvider>
            </CurrencyDisplayWrapper>
          </CurrencyProvider>
        </ThemeProvider>
    </QueryClientProvider>
      </AuthProvider>
  );
};

export default App;
