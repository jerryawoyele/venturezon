import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Mail, ArrowLeft, Check, RefreshCw } from "lucide-react";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";

export default function EmailConfirmation() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email || "your email";
  const [countdown, setCountdown] = useState(60);
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    // If user navigated here without an email in state, redirect to auth
    if (!location.state?.email) {
      navigate("/auth");
      return;
    }

    // Countdown timer for resend option
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [location.state, navigate]);

  const handleResendEmail = async () => {
    setIsResending(true);
    
    try {
      // Add resend logic here if you have an API endpoint for it
      // For now we'll just simulate a delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Reset countdown
      setCountdown(60);
    } catch (error) {
      console.error("Error resending email:", error);
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
      <Link to="/" className="absolute left-4 top-4 md:left-8 md:top-8">
        <Button variant="ghost" className="flex h-9 w-9 items-center justify-center p-0">
          <ArrowLeft className="h-4 w-4" />
          <span className="sr-only">Back</span>
        </Button>
      </Link>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <Card className="overflow-hidden">
          <CardHeader className="space-y-1 text-center pb-0">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-primary/10 p-6">
                <Mail className="h-12 w-12 text-primary" />
              </div>
            </div>
            <CardTitle className="text-2xl font-bold">Check Your Email</CardTitle>
            <CardDescription className="text-md">
              We've sent a confirmation email to
            </CardDescription>
            <p className="font-medium text-foreground">{email}</p>
          </CardHeader>
          <CardContent className="space-y-4 pt-6">
            <div className="rounded-lg bg-primary/10 p-4">
              <div className="flex items-start space-x-3">
                <Check className="h-5 w-5 text-primary mt-0.5" />
                <div>
                  <p className="font-medium">Confirmation link sent</p>
                  <p className="text-sm text-foreground/70">
                    Please click the link in your email to verify your account and continue to the app.
                  </p>
                </div>
              </div>
            </div>
            
            <div className="space-y-2 text-center">
              <p className="text-sm text-foreground/70">
                Didn't receive the email? Check your spam folder or
              </p>
              <Button 
                variant="outline" 
                className="mt-2"
                onClick={handleResendEmail}
                disabled={countdown > 0 || isResending}
              >
                {isResending ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Resending...
                  </>
                ) : countdown > 0 ? (
                  `Resend email (${countdown}s)`
                ) : (
                  "Resend email"
                )}
              </Button>
            </div>
          </CardContent>
          <CardFooter>
            <Button variant="ghost" className="w-full" onClick={() => navigate("/auth")}>
              Back to login
            </Button>
          </CardFooter>
        </Card>
      </motion.div>
    </div>
  );
} 