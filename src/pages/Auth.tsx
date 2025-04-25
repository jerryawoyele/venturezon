import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Check, Shield, Star } from "lucide-react";

const GoogleIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    fill="currentColor"
  >
    <path d="M12.545,10.239v3.821h5.445c-0.712,2.315-2.647,3.972-5.445,3.972c-3.332,0-6.033-2.701-6.033-6.032s2.701-6.032,6.033-6.032c1.498,0,2.866,0.549,3.921,1.453l2.814-2.814C17.503,2.988,15.139,2,12.545,2C7.021,2,2.543,6.477,2.543,12s4.478,10,10.002,10c8.396,0,10.249-7.85,9.426-11.748L12.545,10.239z" />
  </svg>
);

const GitHubIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    fill="currentColor"
  >
    <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.42.36.81 1.096.81 2.22 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
  </svg>
);

const TwitterIcon = () => (
  <svg
    viewBox="0 0 24 24"
    width="16"
    height="16"
    stroke="currentColor"
    fill="currentColor"
  >
    <path d="M23.953 4.57a10 10 0 01-2.825.775 4.958 4.958 0 002.163-2.723c-.951.555-2.005.959-3.127 1.184a4.92 4.92 0 00-8.384 4.482C7.69 8.095 4.067 6.13 1.64 3.162a4.822 4.822 0 00-.666 2.475c0 1.71.87 3.213 2.188 4.096a4.904 4.904 0 01-2.228-.616v.06a4.923 4.923 0 003.946 4.827 4.996 4.996 0 01-2.212.085 4.936 4.936 0 004.604 3.417 9.867 9.867 0 01-6.102 2.105c-.39 0-.779-.023-1.17-.067a13.995 13.995 0 007.557 2.209c9.053 0 13.998-7.496 13.998-13.985 0-.21 0-.42-.015-.63A9.935 9.935 0 0024 4.59z" />
  </svg>
);

export default function Auth() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [resetPassword, setResetPassword] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkUser = async () => {
      const { data } = await supabase.auth.getUser();
      if (data.user) {
        navigate("/home");
      }
    };
    checkUser();
  }, [navigate]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate name
      if (!name.trim()) {
        toast({
          title: "Name required",
          description: "Please enter your name.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // First validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Check password strength
      if (password.length < 8) {
        toast({
          title: "Weak password",
          description: "Password must be at least 8 characters long.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }
      
      // Additional password strength check
      const hasUpperCase = /[A-Z]/.test(password);
      const hasLowerCase = /[a-z]/.test(password);
      const hasNumbers = /\d/.test(password);
      const hasSpecialChar = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]+/.test(password);
      
      if (!(hasUpperCase && hasLowerCase && hasNumbers) && !hasSpecialChar) {
        toast({
          title: "Weak password",
          description: "Password must contain uppercase, lowercase, numbers, or special characters.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Show loading feedback
      toast({
        title: "Creating account...",
        description: "Please wait while we set up your account.",
      });

      // Proceed with signup - Supabase will reject if email exists
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            name,
          },
        },
      });

      // Handle specific error for existing user
      if (error) {
        if (
          error.message.includes("already registered") ||
          error.message.toLowerCase().includes("user already registered") ||
          error.message.toLowerCase().includes("already in use") ||
          error.message.toLowerCase().includes("already exists") ||
          error.status === 400
        ) {
          toast({
            title: "Email already in use",
            description:
              "This email address is already registered. Please sign in instead.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
        return;
      }

      toast({
        title: "Success!",
        description: "Check your email for the confirmation link.",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: error.message || "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Validate email and password are not empty
      if (!email.trim() || !password) {
        toast({
          title: "Missing information",
          description: "Please enter both email and password.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // First validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        toast({
          title: "Invalid email",
          description: "Please enter a valid email address.",
          variant: "destructive",
        });
        setLoading(false);
        return;
      }

      // Show loading feedback
      toast({
        title: "Signing in...",
        description: "Verifying your credentials.",
      });

      const { error, data } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        if (error.message.includes("Invalid login credentials")) {
          toast({
            title: "Authentication failed",
            description: "Invalid email or password. Please try again.",
            variant: "destructive",
          });
        } else {
          throw error;
        }
      } else {
        toast({
          title: "Welcome back!",
          description: "Successfully signed in.",
        });
        navigate("/home");
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again later.",
        variant: "destructive",
      });
      console.error("Sign in error:", error);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      });

      if (error) throw error;

      toast({
        title: "Success!",
        description: "Check your email for the password reset link.",
      });
      setResetPassword(false);
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthSignIn = async (
    provider: "google" | "github" | "twitter"
  ) => {
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/home`,
        },
      });

      if (error) throw error;
    } catch (error) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-background via-background to-background dark:from-black dark:via-gray-900 dark:to-black">
      <div className="container max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex-1 flex flex-col py-10">
        <div className="flex justify-between items-center mb-8">
          <Link to="/" className="flex items-center gap-2">
            <span className="font-bold text-2xl bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-600">Venturezon</span>
          </Link>
          
          <Link to="/" className="text-sm text-foreground/70 dark:text-white/70 hover:text-foreground dark:hover:text-white flex items-center gap-1 transition-colors">
            <ArrowLeft className="h-4 w-4" />
            Back to Home
          </Link>
        </div>

        <div className="flex-1 flex flex-col md:flex-row gap-8 md:gap-12 items-center">
          <div className="w-full md:w-1/2 lg:w-6/12 flex flex-col items-center md:items-start">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="max-w-md"
            >
              <h1 className="text-4xl font-bold mb-4 bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600 dark:from-blue-400 dark:to-purple-600 text-center md:text-left">
                {resetPassword ? "Reset Your Password" : "Welcome to Venturezon"}
              </h1>
              <p className="text-lg text-foreground/70 dark:text-white/70 mb-8 text-center md:text-left">
                {resetPassword
                  ? "Enter your email to receive password reset instructions"
                  : "Join our community of service providers and customers."
                }
              </p>
              
              <div className="hidden md:block">
                <div className="grid grid-cols-3 gap-4 mb-8">
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <Check className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-sm text-foreground/80 dark:text-white/80 text-center">Easy To Use</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-sm text-foreground/80 dark:text-white/80 text-center">Secure Payments</span>
                  </div>
                  <div className="flex flex-col items-center">
                    <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center mb-2">
                      <Star className="h-6 w-6 text-primary" />
                    </div>
                    <span className="text-sm text-foreground/80 dark:text-white/80 text-center">Trusted Services</span>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>

          <div className="w-full md:w-1/2 lg:w-5/12">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
            >
              {resetPassword ? (
                <Card className="border-border w-full">
                  <CardHeader>
                    <CardTitle>Reset Password</CardTitle>
                    <CardDescription>
                      Enter your email to receive a password reset link
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handlePasswordReset} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          type="email"
                          placeholder="your.email@example.com"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        className="w-full"
                        disabled={loading}
                      >
                        {loading ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Sending Email...
                          </>
                        ) : (
                          "Send Reset Link"
                        )}
                      </Button>
                    </form>
                  </CardContent>
                  <CardFooter className="flex justify-center border-t pt-4">
                    <Button variant="link" onClick={() => setResetPassword(false)}>
                      Back to Sign In
                    </Button>
                  </CardFooter>
                </Card>
              ) : (
                <Tabs defaultValue="signin" className="w-full">
                  <TabsList className="grid w-full grid-cols-2 mb-4">
                    <TabsTrigger value="signin">Sign In</TabsTrigger>
                    <TabsTrigger value="signup">Sign Up</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="signin">
                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle>Sign In</CardTitle>
                        <CardDescription>
                          Enter your credentials to access your account
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-4">
                        <form onSubmit={handleSignIn} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="signin-email">Email</Label>
                            <Input
                              id="signin-email"
                              type="email"
                              placeholder="your.email@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="signin-password">Password</Label>
                              <Button
                                variant="link"
                                className="p-0 h-auto text-xs"
                                onClick={() => setResetPassword(true)}
                                type="button"
                              >
                                Forgot password?
                              </Button>
                            </div>
                            <Input
                              id="signin-password"
                              type="password"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                          </div>
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Signing In...
                              </>
                            ) : (
                              "Sign In"
                            )}
                          </Button>
                        </form>

                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t"></span>
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="bg-card px-2 text-foreground/70 dark:text-white/70">
                              or
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2"
                            type="button"
                            onClick={() => handleOAuthSignIn("google")}
                            disabled={loading}
                          >
                            <GoogleIcon />
                            <span>Continue with Google</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                  
                  <TabsContent value="signup">
                    <Card className="border-border">
                      <CardHeader>
                        <CardTitle>Sign Up</CardTitle>
                        <CardDescription>
                          Create a new account to get started
                        </CardDescription>
                      </CardHeader>
                      <CardContent>
                        <form onSubmit={handleSignUp} className="space-y-4">
                          <div className="space-y-2">
                            <Label htmlFor="signup-name">Full Name</Label>
                            <Input
                              id="signup-name"
                              type="text"
                              placeholder="John Doe"
                              value={name}
                              onChange={(e) => setName(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-email">Email</Label>
                            <Input
                              id="signup-email"
                              type="email"
                              placeholder="your.email@example.com"
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              required
                            />
                          </div>
                          <div className="space-y-2">
                            <Label htmlFor="signup-password">Password</Label>
                            <Input
                              id="signup-password"
                              type="password"
                              placeholder="••••••••"
                              value={password}
                              onChange={(e) => setPassword(e.target.value)}
                              required
                            />
                            <p className="text-xs text-foreground/70 dark:text-white/70">
                              Password must be at least 8 characters long and include uppercase, lowercase, 
                              and numbers, or a special character.
                            </p>
                          </div>
                          <Button
                            type="submit"
                            className="w-full"
                            disabled={loading}
                          >
                            {loading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Creating Account...
                              </>
                            ) : (
                              "Create Account"
                            )}
                          </Button>
                        </form>

                        <div className="relative my-4">
                          <div className="absolute inset-0 flex items-center">
                            <span className="w-full border-t"></span>
                          </div>
                          <div className="relative flex justify-center text-xs">
                            <span className="bg-card px-2 text-foreground/70 dark:text-white/70">
                              or
                            </span>
                          </div>
                        </div>

                        <div className="flex justify-center">
                          <Button
                            variant="outline"
                            className="w-full flex items-center justify-center gap-2"
                            type="button"
                            onClick={() => handleOAuthSignIn("google")}
                            disabled={loading}
                          >
                            <GoogleIcon />
                            <span>Continue with Google</span>
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  </TabsContent>
                </Tabs>
              )}
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  );
}
