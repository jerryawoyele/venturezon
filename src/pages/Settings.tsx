import { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { KYCVerification } from "@/components/kyc/KYCVerification";
import { MainLayout } from "@/layouts/MainLayout";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Bell, CreditCard, Globe, Lock, LogOut, Save, Shield, User, Wallet, AlertCircle, ExternalLink, CheckCircle, AlertTriangle, Briefcase, Info, Loader2, ArrowLeft, DollarSign, Sun, Moon, Monitor } from "lucide-react";
import { KYCVerificationService } from "@/utils/kyc-verification-service";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ProfileAvatar } from "@/components/profile/ProfileAvatar";
import { uploadFileWithFallback } from "@/utils/upload-helper";
import { Badge } from "@/components/ui/badge";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
  loadStripe
} from "@/utils/stripe-components";
import { StyledCardElement } from "@/utils/stripe-elements";
import { PaymentProviderService, PaymentProvider, ProviderServiceType } from "@/utils/payment-provider-service";
import { useTheme } from "@/contexts/ThemeContext";

// Define interfaces
interface PaymentMethod {
  id: string;
  user_id: string;
  provider: string;
  card_last4: string;
  card_brand: string;
  card_exp_month: number;
  card_exp_year: number;
  is_default: boolean;
  created_at: string;
}

// Initialize Stripe with the public key
const stripePromise = loadStripe(import.meta.env.VITE_STRIPE_PUBLIC_KEY || "");

// Add fallback if Stripe key is not available
const StripeWrapper: React.FC<{children: React.ReactNode}> = ({ children }) => {
  const [stripeError, setStripeError] = useState<string | null>(null);

  if (!import.meta.env.VITE_STRIPE_PUBLIC_KEY) {
    console.warn("Stripe public key not found in environment variables");
    return (
      <div className="p-4 border border-yellow-500 bg-yellow-50 rounded-md text-yellow-800">
        <h3 className="text-sm font-medium flex items-center">
          <AlertTriangle className="h-4 w-4 mr-2" /> Stripe configuration missing
        </h3>
        <p className="text-xs mt-1">
          Stripe payment processing is unavailable. Please contact support.
        </p>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      {stripeError ? (
        <div className="p-4 border border-red-300 bg-red-50 rounded-md text-red-800">
          <h3 className="text-sm font-medium flex items-center">
            <AlertCircle className="h-4 w-4 mr-2" /> Stripe connection error
          </h3>
          <p className="text-xs mt-1">{stripeError}</p>
        </div>
      ) : (
        children
      )}
    </Elements>
  );
};

interface PaymentFormProps {
  onSuccess: () => void;
  userId: string;
}

const PaymentForm: React.FC<PaymentFormProps> = ({ onSuccess, userId }) => {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  // Handle form submission
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      await handleStripeSubmit();
    } catch (error) {
      console.error('Payment form error:', error);
      setError(error instanceof Error ? error.message : 'An unexpected error occurred');
      toast({
        title: "Payment Error",
        description: error instanceof Error ? error.message : "Failed to process payment method",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Handle Stripe payment submission
  const handleStripeSubmit = async () => {
    if (!stripe || !elements) {
      setError("Stripe has not been properly initialized");
      return;
    }
    
    const cardElement = elements.getElement(CardElement);
    if (!cardElement) {
      setError("Card information is incomplete");
      return;
    }
    
    // Create the payment method - properly typed for Stripe API v3
    const { paymentMethod, error: stripeError } = await stripe.createPaymentMethod({
      type: 'card',
      card: cardElement,
    });
    
    if (stripeError) {
      console.error('Error creating payment method:', stripeError);
      setError(stripeError.message || 'Failed to process your card. Please try again.');
      return;
    }

    // Handle successful result
    if (!paymentMethod) {
      setError('Failed to create payment method. Please try again.');
      return;
    }

    console.log('Successfully created payment method:', paymentMethod);
    
    // Save to database
    const { error: saveError } = await supabase
      .from('payment_methods')
      .insert({
        id: paymentMethod.id,
        user_id: userId,
        provider: 'stripe',
        card_last4: paymentMethod.card.last4,
        card_brand: paymentMethod.card.brand,
        card_exp_month: paymentMethod.card.exp_month,
        card_exp_year: paymentMethod.card.exp_year,
        is_default: true,
        created_at: new Date().toISOString()
      });

    if (saveError) {
      console.error('Error saving payment method:', saveError);
      setError('Payment method was created but could not be saved. Please try again.');
      return;
    }

    // Clear form and notify success
    cardElement.clear();
    toast({
      title: "Payment method added",
      description: `Card ending in ${paymentMethod.card.last4} has been added to your account.`,
    });
    
    onSuccess();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="card-element" className="font-medium">Card Information</Label>
        <div className="mt-1 p-3 border rounded-md">
          <StyledCardElement 
            id="card-element"
            className="w-full"
          />
        </div>
        <div className="flex gap-2 mt-2">
          <img src="/visa-logo.svg" alt="Visa" className="h-6" />
          <img src="/mastercard-logo.svg" alt="Mastercard" className="h-6" />
          <img src="/discover-logo.svg" alt="Discover" className="h-6" />
          <img src="/amex-logo.svg" alt="American Express" className="h-6" />
        </div>
        <div className="text-xs text-gray-500 mt-1">
          Your card details are securely encrypted. The appropriate payment processor will be selected automatically when you make a payment.
        </div>
      </div>
      
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-md text-sm text-red-600">
          {error}
        </div>
      )}
      
      <Button
        type="submit"
        className="w-full"
        disabled={submitting || !stripe}
      >
        {submitting ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Processing...
          </>
        ) : (
          <>Add Payment Method</>
        )}
      </Button>
    </form>
  );
};

export default function Settings() {
  const [activeTab, setActiveTab] = useState("profile");
  const [userId, setUserId] = useState<string | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [kycStatus, setKycStatus] = useState<string>("not_started");
  const [paymentBlocked, setPaymentBlocked] = useState(true);
  const [verificationResult, setVerificationResult] = useState<{ status: string; message: string } | null>(null);

  // Profile settings
  const [username, setUsername] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [bio, setBio] = useState("");
  const [aboutBusiness, setAboutBusiness] = useState("");
  const [businessName, setBusinessName] = useState("");
  const [usernameAvailable, setUsernameAvailable] = useState(true);
  const [isCheckingUsername, setIsCheckingUsername] = useState(false);

  // Notification settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [marketingEmails, setMarketingEmails] = useState(false);

  // Privacy settings
  const [profileVisibility, setProfileVisibility] = useState("public");
  const [activityVisibility, setActivityVisibility] = useState("followers");

  // Payment settings
  const [defaultPaymentMethod, setDefaultPaymentMethod] = useState("");
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [paymentMethodsLoading, setPaymentMethodsLoading] = useState(false);
  const [showAddPaymentForm, setShowAddPaymentForm] = useState(false);
  const [payoutAccount, setPayoutAccount] = useState<any>(null);
  const [showAddPayoutAccount, setShowAddPayoutAccount] = useState(false);
  const [showEditPayoutAccount, setShowEditPayoutAccount] = useState(false);
  const [payoutFormData, setPayoutFormData] = useState({
    bank_name: '',
    account_number: '',
    account_holder_name: '',
  });
  const [isKycStarted, setIsKycStarted] = useState(false);
  const [kycSessionURL, setKycSessionURL] = useState('');

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [isDirty, setIsDirty] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const { toast } = useToast();

  // Theme settings
  const { theme, setTheme } = useTheme();

  // Add this at the top of the component
  const usernameCheckTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Check for tab parameter in URL
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const tabParam = params.get('tab');
    const statusParam = params.get('status');

    // Only set active tab if it's a valid tab value
    if (tabParam && ["profile", "notifications", "privacy", "verification"].includes(tabParam)) {
      setActiveTab(tabParam);
    }

    // Handle verification status from URL
    if (tabParam === 'verification' && statusParam) {
      if (statusParam === 'success') {
        setVerificationResult({
          status: 'success',
          message: 'Your verification information has been submitted successfully. We will process it shortly.'
        });

        // Show a toast notification
        toast({
          title: "Verification Submitted",
          description: "Your verification information has been submitted successfully.",
          variant: "default",
        });
      } else if (statusParam === 'error') {
        setVerificationResult({
          status: 'error',
          message: 'There was an issue with your verification. Please try again or contact support.'
        });

        // Show a toast notification
        toast({
          title: "Verification Error",
          description: "There was an issue with your verification process.",
          variant: "destructive",
        });
      }

      // Clean up the URL to remove the status parameter
      const newParams = new URLSearchParams(location.search);
      newParams.delete('status');
      navigate({
        pathname: location.pathname,
        search: newParams.toString()
      }, { replace: true });
    }
  }, [location.search, navigate, toast]);

  // Add effect to load payment methods when the payments tab is selected
  useEffect(() => {
    // Initialize data when userId is available
    if (userId && activeTab === 'payments' && userProfile?.id) {
      // Function to load payment methods
      const loadPaymentData = async () => {
        try {
          // Fetch payment methods
          const { data, error } = await supabase
            .from('payment_methods')
            .select('*')
            .eq('user_id', userProfile.id)
            .order('is_default', { ascending: false });
          
          if (error) {
            console.error('Error loading payment methods:', error);
          } else {
            setPaymentMethods(data || []);
          }
          
          // Fetch payout account for business users
          if (userProfile.user_role === 'business') {
            try {
              const { data: payoutData, error: payoutError } = await supabase
                .from('payout_accounts')
                .select('*')
                .eq('user_id', userProfile.id)
                .single();
              
              if (!payoutError && payoutData) {
                setPayoutAccount(payoutData);
                
                // Pre-fill form data
                setPayoutFormData({
                  bank_name: payoutData.bank_name || '',
                  account_number: payoutData.account_number || '',
                  account_holder_name: payoutData.account_holder_name || '',
                });
              }
            } catch (e) {
              console.error('Payout accounts table may not exist:', e);
              // Continue without payout account data
            }
          }
        } catch (error) {
          console.error('Error loading payment data:', error);
        }
      };
      
      loadPaymentData();
    }
  }, [userId, activeTab, userProfile]);

  // Add an effect to initialize user data
  useEffect(() => {
    // Function to initialize user data
    const initializeUserData = async () => {
      try {
        // Get the authenticated user
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        
        if (userError || !user) {
          console.error("Error getting authenticated user:", userError);
          navigate('/auth');
          return;
        }
        
        // Set user ID
        setUserId(user.id);
        setEmail(user.email || "");
        
        // Fetch user profile data
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();
          
        if (profileError) {
          console.error("Error fetching profile:", profileError);
          // Continue anyway to create profile if it doesn't exist
        }
        
        if (profileData) {
          // Set profile data to state
          setUserProfile(profileData);
          setUsername(profileData.username || "");
          setDisplayName(profileData.display_name || profileData.username || "");
          setBio(profileData.bio || "");
          setAboutBusiness(profileData.about_business || "");
          setBusinessName(profileData.business_name || "");
          setKycStatus(profileData.kyc_status || "not_started");
          setEmailNotifications(profileData.email_notifications !== false);
          setPushNotifications(profileData.push_notifications !== false);
          setMarketingEmails(profileData.marketing_emails === true);
          setProfileVisibility(profileData.profile_visibility || "public");
          setActivityVisibility(profileData.activity_visibility || "followers");
        } else {
          // Create a new profile if one doesn't exist
          const { data: newProfileData, error: createError } = await supabase
            .from("profiles")
            .insert([{
              id: user.id,
              user_role: "customer",
              email: user.email,
              username: user.email?.split('@')[0] || `user_${Math.floor(Math.random() * 10000)}`,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            }])
            .select();
            
          if (createError) {
            console.error("Error creating profile:", createError);
          } else if (newProfileData && newProfileData.length > 0) {
            setUserProfile(newProfileData[0]);
            setUsername(newProfileData[0].username || "");
          }
        }
      } catch (error) {
        console.error("Error initializing user data:", error);
        toast({
          title: "Error",
          description: "Failed to load your profile. Please try again.",
          variant: "destructive",
        });
      } finally {
        // Set loading to false to show the main content
        setLoading(false);
      }
    };
    
    // Call the initialize function
    initializeUserData();
  }, [navigate, toast]);

  const checkUsernameAvailability = async (username: string) => {
    // If username is empty or matches current user's username, it's considered "available"
    if (!username || username.trim() === "") {
      setUsernameAvailable(true);
      return;
    }
    
    // If it's the same as the current username, it's available
    if (username === userProfile?.username) {
      setUsernameAvailable(true);
      return;
    }

    setIsCheckingUsername(true);

    try {
      // Check if username already exists in database
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .ilike("username", username.toLowerCase()) // Use case-insensitive comparison
        .not("id", "eq", userId) // Exclude current user
        .maybeSingle();

      if (error) {
        console.error("Error checking username:", error);
        // On error, assume username is unavailable to be safe
        setUsernameAvailable(false);
      } else {
        // If data is returned, username exists and is unavailable
        setUsernameAvailable(!data);
      }
    } catch (error) {
      console.error("Error checking username:", error);
      setUsernameAvailable(false);
    } finally {
      setIsCheckingUsername(false);
    }
  };

  const handleUsernameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Only allow alphanumeric characters and underscores
    const value = e.target.value.replace(/[^a-zA-Z0-9_]/g, "").toLowerCase();
    setUsername(value);
    
    // Clear any existing timeout
    if (usernameCheckTimeoutRef.current) {
      clearTimeout(usernameCheckTimeoutRef.current);
    }
    
    // Set a new timeout to check username availability after 500ms of no typing
    if (value && value !== userProfile?.username) {
      usernameCheckTimeoutRef.current = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
    } else {
      setUsernameAvailable(true);
    }
  };

  const saveProfileSettings = async () => {
    if (!userId) return;

    // Username validation
    if (!username) {
      toast({
        title: "Username required",
        description: "Please enter a username for your profile.",
        variant: "destructive",
      });
      return;
    }

    if (!usernameAvailable) {
      toast({
        title: "Username not available",
        description: "Please choose a different username.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);

    try {
      const updateData: any = {
        username,
        display_name: displayName.trim() || username.trim(),
        bio,
        about_business: aboutBusiness,
        business_name: businessName,
        user_role: userProfile?.user_role,
        updated_at: new Date().toISOString(),
      };

      // Only add business_name for business accounts
      if (userProfile?.user_role === "business") {
        updateData.business_name = businessName;
      }

      const { error } = await supabase
        .from("profiles")
        .update(updateData)
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Profile updated",
        description: "Your profile settings have been saved successfully.",
      });
    } catch (error) {
      console.error("Error saving profile settings:", error);
      toast({
        title: "Update failed",
        description: "There was an error saving your profile settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const saveNotificationSettings = async () => {
    if (!userId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          email_notifications: emailNotifications,
          push_notifications: pushNotifications,
          marketing_emails: marketingEmails,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Notification settings updated",
        description: "Your notification preferences have been saved.",
      });
    } catch (error) {
      console.error("Error saving notification settings:", error);
      toast({
        title: "Update failed",
        description: "There was an error saving your notification settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const savePrivacySettings = async () => {
    if (!userId) return;

    setSaving(true);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          profile_visibility: profileVisibility,
          activity_visibility: activityVisibility,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      toast({
        title: "Privacy settings updated",
        description: "Your privacy preferences have been saved.",
      });
    } catch (error) {
      console.error("Error saving privacy settings:", error);
      toast({
        title: "Update failed",
        description: "There was an error saving your privacy settings.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();

      if (error) throw error;

      navigate("/");
    } catch (error) {
      console.error("Error logging out:", error);
      toast({
        title: "Logout failed",
        description: "There was an error logging out. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleKYCStatusChange = (status: string) => {
    setKycStatus(status);
    // Update payment blocking based on KYC status
    setPaymentBlocked(status !== "verified");
  };

  const handleStartKYCVerification = async () => {
    setIsKycStarted(true);
    
    try {
      const result = await KYCVerificationService.startVerification(userProfile.id);
      if (result && result.url) {
        setKycSessionURL(result.url);
      } else {
        throw new Error("Failed to start verification process");
      }
    } catch (error) {
      console.error("Error starting KYC verification:", error);
      toast({
        title: "Verification Error",
        description: "There was a problem starting the verification process. Please try again later.",
        variant: "destructive",
      });
      setIsKycStarted(false);
    }
  };

  const handleAvatarSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      // Check if the file is an image
      if (!file.type.startsWith('image/')) {
        toast({
          title: "Invalid File",
          description: "Please select an image file",
          variant: "destructive",
        });
        return;
      }

      // Check file size (limit to 5MB)
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "File Too Large",
          description: "Image file is too large. Please select an image less than 5MB",
          variant: "destructive",
        });
        return;
      }

      setAvatarFile(file);
    }
  };

  const uploadAvatar = async () => {
    if (!avatarFile || !userId) return;

    setSaving(true);

    try {
      // Upload to Supabase Storage
      const filePath = `profiles/${userId}/avatar/${Date.now()}-${avatarFile.name}`;
      const result = await uploadFileWithFallback(avatarFile, filePath);

      if (!result || typeof result.url !== 'string') {
        throw new Error("Failed to upload image");
      }

      // Update profile with new avatar URL
      const { error } = await supabase
        .from("profiles")
        .update({
          avatar_url: result.url,
          updated_at: new Date().toISOString(),
        })
        .eq("id", userId);

      if (error) throw error;

      // Update local state
      setUserProfile({
        ...userProfile,
        avatar_url: result.url
      });

      setAvatarFile(null);

      toast({
        title: "Profile Picture Updated",
        description: "Your profile picture has been updated successfully.",
      });
    } catch (error) {
      console.error("Error uploading avatar:", error);
      toast({
        title: "Upload Error",
        description: "Failed to update profile picture. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handlePaymentMethodAdded = () => {
    setShowAddPaymentForm(false);
    
    // Refresh payment methods by updating activeTab to trigger the useEffect
    // This is a workaround since we've moved fetchPaymentMethods inside the useEffect
    if (activeTab === 'payments') {
      const refreshTab = async () => {
        // Directly fetch payment methods
        if (userProfile?.id) {
          try {
            const { data, error } = await supabase
              .from('payment_methods')
              .select('*')
              .eq('user_id', userProfile.id)
              .order('is_default', { ascending: false });
            
            if (error) throw error;
            setPaymentMethods(data || []);
          } catch (error) {
            console.error('Error refreshing payment methods:', error);
          }
        }
      };
      refreshTab();
    }
    
    toast({
      title: "Payment method added",
      description: "Your payment method has been successfully added.",
    });
  };
  
  const handleRemovePaymentMethod = async (methodId: string) => {
    try {
      const { error } = await supabase
        .from('payment_methods')
        .delete()
        .eq('id', methodId);
      
      if (error) throw error;
      
      setPaymentMethods(prev => prev.filter(method => method.id !== methodId));
      
      toast({
        title: "Payment method removed",
        description: "Your payment method has been successfully removed.",
      });
    } catch (error) {
      console.error('Error removing payment method:', error);
      toast({
        title: "Error",
        description: "Failed to remove payment method. Please try again.",
        variant: "destructive",
      });
    }
  };
  
  const handleSavePayoutAccount = async () => {
    if (!userProfile?.id) return;
    
    setSaving(true);
    
    try {
      // Validate form data
      if (!payoutFormData.bank_name || !payoutFormData.account_number || 
          !payoutFormData.account_holder_name) {
        throw new Error("Please fill in all required fields");
      }
      
      // Mask account number for display and storage
      const fullAccountNumber = payoutFormData.account_number;
      const last4 = fullAccountNumber.slice(-4);
      
      const payoutAccountData = {
        user_id: userProfile.id,
        bank_name: payoutFormData.bank_name,
        account_number: fullAccountNumber, // Will be encrypted in DB
        account_last4: last4,
        account_holder_name: payoutFormData.account_holder_name,
        status: 'pending', // New accounts need verification
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      
      if (payoutAccount) {
        // Update existing account
        const { error } = await supabase
          .from('payout_accounts')
          .update(payoutAccountData)
          .eq('id', payoutAccount.id);
        
        if (error) throw error;
      } else {
        // Create new account
        const { error } = await supabase
          .from('payout_accounts')
          .insert(payoutAccountData);
        
        if (error) throw error;
      }
      
      toast({
        title: "Payout account saved",
        description: "Your payout account has been successfully saved and is pending verification.",
      });
      
      setShowAddPayoutAccount(false);
      
      // Refresh payout account data directly
      if (userProfile?.id) {
        try {
          const { data, error } = await supabase
            .from('payout_accounts')
            .select('*')
            .eq('user_id', userProfile.id)
            .single();
          
          if (!error && data) {
            setPayoutAccount(data);
          }
        } catch (refreshError) {
          console.error('Error refreshing payout account data:', refreshError);
        }
      }
    } catch (error) {
      console.error('Error saving payout account:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to save payout account. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  // Main layout loading placeholder
  if (loading) {
    return (
      <MainLayout activeTab="settings" setActiveTab={setActiveTab} userRole={userProfile?.user_role}>
        <div className="animate-pulse min-h-screen space-y-4 my-8">
          <div className="h-8 bg-gray-700/30 rounded w-1/3"></div>
          <div className="h-64 bg-gray-700/30 rounded"></div>
          <div className="h-32 bg-gray-700/30 rounded"></div>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout activeTab="settings" setActiveTab={setActiveTab} userRole={userProfile?.user_role}>
      <div className="py-6 min-h-screen w-full overflow-x-hidden pb-16 md:pb-6">
        <div className="flex items-center mb-6">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => navigate('/profile')}
            className="mr-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Profile
          </Button>
          <h3 className="text-3xl font-semibold">Settings</h3>
        </div>

        <Tabs defaultValue="profile" value={activeTab} onValueChange={setActiveTab} className="w-full">
          <div className="overflow-x-auto pb-2">
            <TabsList className="inline-flex w-max min-w-full md:w-full md:grid md:grid-cols-6 gap-2">
              <TabsTrigger value="profile" className="flex items-center gap-2">
                <User size={16} />
                <span>Profile</span>
              </TabsTrigger>
              <TabsTrigger value="notifications" className="flex items-center gap-2">
                <Bell size={16} />
                <span>Notifications</span>
              </TabsTrigger>
              <TabsTrigger value="privacy" className="flex items-center gap-2">
                <Lock size={16} />
                <span>Privacy</span>
              </TabsTrigger>
              <TabsTrigger value="verification" className="flex items-center gap-2">
                <Shield size={16} />
                <span>Verification</span>
              </TabsTrigger>
              <TabsTrigger value="payments" className="flex items-center gap-2">
                <Wallet size={16} />
                <span>Payments</span>
              </TabsTrigger>
              <TabsTrigger value="kyc" className="flex items-center gap-2">
                <Briefcase size={16} />
                <span>Business Verification</span>
              </TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="profile" className="space-y-6">
            <div>
              <h3 className="mb-4 text-lg font-medium">Profile Settings</h3>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Avatar Upload */}
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Profile Picture</CardTitle>
                      <CardDescription>Upload a profile picture to personalize your account.</CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center">
                      <div className="my-4 relative">
                        <ProfileAvatar userProfile={userProfile} size={100} />
                      </div>
                      <div className="grid w-full max-w-sm items-center gap-1.5">
                        <Label htmlFor="avatar-upload">New Picture</Label>
                        <Input
                          id="avatar-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleAvatarSelect}
                          disabled={saving}
                        />
                        {avatarFile && (
                          <Button
                            onClick={uploadAvatar}
                            className="w-full mt-2"
                            disabled={saving}
                          >
                            {saving ? "Uploading..." : "Upload Picture"}
                          </Button>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Appearance card - Added here */}
                  <Card className="col-span-1">
                    <CardHeader>
                      <CardTitle>Appearance</CardTitle>
                      <CardDescription>Customize how Venturezon looks for you</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="space-y-4">
                        <div>
                          <h3 className="text-sm font-medium">Theme</h3>
                          <p className="text-sm text-muted-foreground mb-3">
                            Select your preferred theme
                          </p>
                          <RadioGroup 
                            value={theme} 
                            onValueChange={(value) => setTheme(value as "light" | "dark" | "system")}
                            className="flex flex-col space-y-1"
                          >
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="light" id="light" />
                              <Label htmlFor="light" className="flex items-center">
                                <Sun className="h-4 w-4 mr-2" />
                                Light
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="dark" id="dark" />
                              <Label htmlFor="dark" className="flex items-center">
                                <Moon className="h-4 w-4 mr-2" />
                                Dark
                              </Label>
                            </div>
                            <div className="flex items-center space-x-2">
                              <RadioGroupItem value="system" id="system" />
                              <Label htmlFor="system" className="flex items-center">
                                <Monitor className="h-4 w-4 mr-2" />
                                System
                              </Label>
                            </div>
                          </RadioGroup>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>

                {/* Basic Information */}
                <Card>
                  <CardHeader>
                    <CardTitle>Profile Information</CardTitle>
                    <CardDescription>
                      Update your personal information and profile details
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {userProfile?.user_role === "business" && (
                      <div className="space-y-2">
                        <Label htmlFor="businessName">Business Name</Label>
                        <Input
                          id="businessName"
                          value={businessName}
                          onChange={(e) => setBusinessName(e.target.value)}
                          placeholder="Your business name"
                        />
                        <p className="text-xs text-muted-foreground">
                          This name will be displayed on your business profile
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="username">Username</Label>
                        <div className="flex items-center gap-2">
                          <div className="relative flex-1">
                            <Input
                              id="username"
                              value={username}
                              onChange={handleUsernameChange}
                              placeholder="Your username"
                              className={`pr-10 ${!usernameAvailable && username.length > 0 ? 'border-red-500 focus-visible:ring-red-500' : ''}`}
                            />
                            {isCheckingUsername && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <Loader2 className="h-4 w-4 animate-spin text-primary" />
                              </div>
                            )}
                            {!isCheckingUsername && !usernameAvailable && username.length > 0 && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <AlertCircle className="h-4 w-4 text-red-500" />
                              </div>
                            )}
                            {!isCheckingUsername && usernameAvailable && username.length > 0 && username !== userProfile?.username && (
                              <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              </div>
                            )}
                          </div>
                        </div>
                        {!usernameAvailable && username.length > 0 ? (
                          <p className="text-xs text-red-500">
                            This username is already taken. Please choose another one.
                          </p>
                        ) : username.length > 0 && username !== userProfile?.username ? (
                          <p className="text-xs text-green-500">
                            Username is available!
                          </p>
                        ) : (
                          <p className="text-xs text-muted-foreground">
                            Your unique username for @mentions and profile URL
                          </p>
                        )}
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="displayName">Display Name</Label>
                        <Input
                          id="displayName"
                          value={displayName}
                          onChange={(e) => setDisplayName(e.target.value)}
                          placeholder="Your display name"
                        />
                        <p className="text-xs text-muted-foreground">
                          The name displayed on your profile and posts
                        </p>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input
                          id="email"
                          value={email}
                          disabled
                          className="bg-muted"
                        />
                        <p className="text-xs text-muted-foreground">
                          Contact support to change your email address
                        </p>
                      </div>
                    </div>

                    {/* Account Type Selection */}
                    <div className="space-y-2">
                      <Label htmlFor="userRole">Account Type</Label>
                      <div className="flex flex-row gap-4 pt-2">
                        <label 
                          className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all w-full max-w-[180px] ${
                            userProfile?.user_role === "customer" 
                              ? "border-primary bg-primary/10" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="userRole" 
                            value="customer" 
                            checked={userProfile?.user_role === "customer"} 
                            onChange={() => setUserProfile({...userProfile, user_role: "customer"})}
                            className="sr-only" 
                          />
                          <div className="text-lg mb-2">👤</div>
                          <div className="font-medium">Customer</div>
                          <div className="text-xs text-muted-foreground text-center mt-1">
                            Browse and book services
                          </div>
                        </label>
                        
                        <label 
                          className={`flex flex-col items-center p-4 rounded-lg border-2 cursor-pointer transition-all w-full max-w-[180px] ${
                            userProfile?.user_role === "business" 
                              ? "border-primary bg-primary/10" 
                              : "border-gray-200 hover:border-gray-300"
                          }`}
                        >
                          <input 
                            type="radio" 
                            name="userRole" 
                            value="business" 
                            checked={userProfile?.user_role === "business"} 
                            onChange={() => setUserProfile({...userProfile, user_role: "business"})}
                            className="sr-only" 
                          />
                          <div className="text-lg mb-2">🛠️</div>
                          <div className="font-medium">Business</div>
                          <div className="text-xs text-muted-foreground text-center mt-1">
                            Offer and manage services
                          </div>
                        </label>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="bio">Bio</Label>
                      <Textarea
                        id="bio"
                        value={bio}
                        onChange={(e) => setBio(e.target.value)}
                        placeholder="Tell us about yourself"
                        className="min-h-[100px]"
                      />
                    </div>

                    {userProfile?.user_role === "business" && (
                      <div className="space-y-2">
                        <Label htmlFor="aboutBusiness">About Business</Label>
                        <Textarea
                          id="aboutBusiness"
                          value={aboutBusiness}
                          onChange={(e) => setAboutBusiness(e.target.value)}
                          placeholder="Tell us about your business"
                          className="min-h-[100px]"
                        />
                      </div>
                    )}


                  </CardContent>
                  <CardFooter className="flex justify-end space-x-2">
                    <Button
                      type="submit"
                      onClick={saveProfileSettings}
                      disabled={saving || !usernameAvailable}
                    >
                      {saving ? "Saving..." : "Save Changes"}
                    </Button>
                  </CardFooter>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Account Actions</CardTitle>
                    <CardDescription>
                      Manage your account settings
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <Button
                      variant="destructive"
                      className="w-full sm:w-auto"
                      onClick={handleLogout}
                    >
                      <LogOut className="mr-2 h-4 w-4" />
                      Sign Out
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="notifications" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Notification Preferences</CardTitle>
                <CardDescription>
                  Manage how you receive notifications and updates
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="emailNotifications">Email Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive notifications about messages and bookings via email
                      </p>
                    </div>
                    <Switch
                      id="emailNotifications"
                      checked={emailNotifications}
                      onCheckedChange={setEmailNotifications}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="pushNotifications">Push Notifications</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive push notifications on your device
                      </p>
                    </div>
                    <Switch
                      id="pushNotifications"
                      checked={pushNotifications}
                      onCheckedChange={setPushNotifications}
                    />
                  </div>

                  <Separator />

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="marketingEmails">Marketing Emails</Label>
                      <p className="text-sm text-muted-foreground">
                        Receive promotional content and special offers
                      </p>
                    </div>
                    <Switch
                      id="marketingEmails"
                      checked={marketingEmails}
                      onCheckedChange={setMarketingEmails}
                    />
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={saveNotificationSettings}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Preferences"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="privacy" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>Privacy Settings</CardTitle>
                <CardDescription>
                  Control who can see your profile and activity
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="profileVisibility">Profile Visibility</Label>
                    <Select
                      value={profileVisibility}
                      onValueChange={setProfileVisibility}
                    >
                      <SelectTrigger id="profileVisibility">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public (Everyone can see)</SelectItem>
                        <SelectItem value="private">Private (Only you)</SelectItem>
                        <SelectItem value="followers">Followers Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose who can see your full profile information
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="activityVisibility">Activity Visibility</Label>
                    <Select
                      value={activityVisibility}
                      onValueChange={setActivityVisibility}
                    >
                      <SelectTrigger id="activityVisibility">
                        <SelectValue placeholder="Select visibility" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="public">Public (Everyone can see)</SelectItem>
                        <SelectItem value="private">Private (Only you)</SelectItem>
                        <SelectItem value="followers">Followers Only</SelectItem>
                      </SelectContent>
                    </Select>
                    <p className="text-sm text-muted-foreground">
                      Choose who can see your activity on the platform
                    </p>
                  </div>
                </div>
              </CardContent>
              <CardFooter>
                <Button
                  onClick={savePrivacySettings}
                  disabled={saving}
                >
                  {saving ? "Saving..." : "Save Privacy Settings"}
                </Button>
              </CardFooter>
            </Card>
          </TabsContent>

          <TabsContent value="verification" className="space-y-6">
            <div className="flex-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Business Verification
                  </CardTitle>
                  <CardDescription>
                    {userProfile?.user_role === "business"
                      ? "Complete business verification to unlock full marketplace features and provide services to customers. This helps maintain a safe and trusted marketplace."
                      : "Business verification is only required for business accounts offering services on the platform."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Account Type Alert */}
                  {userProfile?.user_role !== "business" && (
                    <Alert>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Standard Account</AlertTitle>
                      </div>
                      <AlertDescription>
                        You have a standard account. Verification is only required for business accounts.
                        If you wish to offer services on the platform, you can upgrade to a business account in the Profile tab.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Verification Result Messages */}
                  {verificationResult && (
                    <Alert variant={verificationResult.status === 'success' ? "default" : "destructive"}
                      className={verificationResult.status === 'success' ? "bg-green-900 border-green-200" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {verificationResult.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        <AlertTitle>
                          {verificationResult.status === 'success' ? "Verification Submitted" : "Verification Error"}
                        </AlertTitle>
                      </div>
                      <AlertDescription>
                        {verificationResult.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* KYC Status Section */}
                  <div className="rounded-md border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">Verification Status</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {userProfile?.kyc_verified
                            ? "Your business has been successfully verified."
                            : userProfile?.user_role === "business"
                              ? "Your business verification is pending or incomplete."
                              : "Not applicable for standard accounts."}
                        </p>
                      </div>

                      <div>
                        {userProfile?.kyc_verified ? (
                          <div className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                            <CheckCircle className="h-4 w-4" />
                            <span>Verified</span>
                          </div>
                        ) : userProfile?.user_role !== "business" ? (
                          <div className="flex items-center gap-1 bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Not Required</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Not Verified</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status details if available */}
                  {userProfile?.user_role === "business" && (
                    <>
                      {kycStatus === 'started' || kycStatus === 'pending' ? (
                        <Alert className="bg-blue-900 border-blue-200">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertTitle>Verification In Progress</AlertTitle>
                          </div>
                          <AlertDescription>
                            Your business verification is being processed. This usually takes 1-3 business days.
                            You'll receive a notification when it's complete.
                          </AlertDescription>
                        </Alert>
                      ) : kycStatus === 'rejected' ? (
                        <Alert variant="destructive">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Verification Rejected</AlertTitle>
                          </div>
                          <AlertDescription>
                            {userProfile?.kyc_rejection_reason ||
                              "Your verification was rejected. Please ensure your business documents are clear and valid, then try again. Contact support if you need assistance."}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </>
                  )}

                  {/* Verification Benefits */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <h3 className="font-medium">Trust & Safety</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Verification adds a trust badge to your profile and increases customer confidence in your services.
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <h3 className="font-medium">Accept Payments</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Verified businesses can receive payments and manage service bookings through the platform.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border p-4 bg-muted/50">
                    <h3 className="font-medium mb-2">Verification Information</h3>
                    <p className="text-sm text-muted-foreground">
                      We use Sumsub for secure, compliant business verification. Verification typically takes 1-2 business days 
                      after document submission. Your information is encrypted and securely stored.
                    </p>
                    <div className="flex items-center mt-2">
                      <ExternalLink className="h-4 w-4 mr-1 text-muted-foreground" />
                      <a 
                        href="https://sumsub.com/document-verification/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Learn more about Sumsub verification
                      </a>
                    </div>
                  </div>

                  {/* Start Verification Button */}
                  {userProfile?.user_role === "business" && !userProfile?.kyc_verified && kycStatus !== 'pending' && (
                    <Button
                      onClick={handleStartKYCVerification}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? (
                        <>Loading...</>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Start Business Verification
                        </>
                      )}
                    </Button>
                  )}

                  {/* For regular users - account upgrade button */}
                  {userProfile?.user_role !== "business" && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("profile")}
                      >
                        <Briefcase className="mr-2 h-4 w-4" />
                        Upgrade to Business Account
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          <TabsContent value="payments" className="space-y-6">
            <div>
              <h3 className="text-lg font-medium mb-4">Payment Settings</h3>
              
              <Card>
                <CardHeader>
                  <CardTitle>Payment Methods</CardTitle>
                  <CardDescription>
                    Manage your payment methods for transactions on the platform.
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <div className="flex justify-center py-4">
                      <Loader2 className="h-6 w-6 animate-spin" />
                    </div>
                  ) : (
                    <>
                      {/* Payment methods list */}
                      <div className="space-y-4">
                        {paymentMethods.length > 0 ? (
                          <div className="grid gap-3">
                            {paymentMethods.map((method) => (
                              <div
                                key={method.id}
                                className="flex items-center justify-between p-3 border rounded-lg"
                              >
                                <div className="flex items-center gap-3">
                                  <CreditCard className="h-8 w-8 text-primary" />
                                  <div>
                                    <p className="font-medium">
                                      {method.card_brand} •••• {method.card_last4}
                                    </p>
                                    <p className="text-sm text-gray-500">
                                      Expires {method.card_exp_month}/{method.card_exp_year}
                                    </p>
                                  </div>
                                  {method.is_default && (
                                    <Badge variant="outline" className="ml-2">
                                      Default
                                    </Badge>
                                  )}
                                </div>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleRemovePaymentMethod(method.id)}
                                >
                                  Remove
                                </Button>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-gray-500">No payment methods added yet.</p>
                          </div>
                        )}

                        <div className="mt-4">
                          <Button onClick={() => setShowAddPaymentForm(!showAddPaymentForm)}>
                            {showAddPaymentForm ? "Cancel" : "Add Payment Method"}
                          </Button>
                        </div>

                        {showAddPaymentForm && (
                          <div className="mt-6 border rounded-lg p-4">
                            <h4 className="font-medium mb-4">Add New Payment Method</h4>
                            <StripeWrapper>
                              <PaymentForm onSuccess={handlePaymentMethodAdded} userId={userProfile.id} />
                            </StripeWrapper>
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>

              {/* Payout account section - Only for business users */}
              {userProfile?.user_role === "business" && (
                <Card className="mt-6">
                  <CardHeader>
                    <CardTitle>Payout Account</CardTitle>
                    <CardDescription>
                      Manage your account details for receiving payments.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    {loading ? (
                      <div className="flex justify-center py-4">
                        <Loader2 className="h-6 w-6 animate-spin" />
                      </div>
                    ) : (
                      <>
                        {payoutAccount ? (
                          <div className="p-3 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">
                                  {payoutAccount.bank_name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  Account ending in {payoutAccount.account_last4}
                                </p>
                                {payoutAccount.status === "verified" && (
                                  <Badge variant="outline" className="mt-2 bg-green-50">
                                    <CheckCircle className="h-3 w-3 mr-1" /> Verified
                                  </Badge>
                                )}
                                {payoutAccount.status === "pending" && (
                                  <Badge variant="outline" className="mt-2 bg-yellow-50">
                                    <AlertCircle className="h-3 w-3 mr-1" /> Verification Pending
                                  </Badge>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setShowEditPayoutAccount(true)}
                              >
                                Edit
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <div className="text-center py-6">
                            <p className="text-gray-500">No payout account added.</p>
                            <p className="text-sm text-red-500 mt-2">
                              You need to add a payout account to receive payments for your services.
                            </p>
                          </div>
                        )}

                        <div className="mt-4">
                          <Button onClick={() => setShowAddPayoutAccount(!showAddPayoutAccount)}>
                            {payoutAccount ? "Update Payout Account" : "Add Payout Account"}
                          </Button>
                        </div>

                        {showAddPayoutAccount && (
                          <div className="mt-6 border rounded-lg p-4">
                            <h4 className="font-medium mb-4">
                              {payoutAccount ? "Update Payout Account" : "Add Payout Account"}
                            </h4>
                            <div className="space-y-4">
                              <div className="grid gap-2">
                                <Label htmlFor="bank_name">Bank Name</Label>
                                <Input
                                  id="bank_name"
                                  value={payoutFormData.bank_name}
                                  onChange={(e) => setPayoutFormData({ ...payoutFormData, bank_name: e.target.value })}
                                  placeholder="Enter bank name"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="account_number">Account Number</Label>
                                <Input
                                  id="account_number"
                                  value={payoutFormData.account_number}
                                  onChange={(e) => setPayoutFormData({ ...payoutFormData, account_number: e.target.value })}
                                  placeholder="Enter account number"
                                />
                              </div>
                              <div className="grid gap-2">
                                <Label htmlFor="account_holder_name">Account Holder Name</Label>
                                <Input
                                  id="account_holder_name"
                                  value={payoutFormData.account_holder_name}
                                  onChange={(e) => setPayoutFormData({ ...payoutFormData, account_holder_name: e.target.value })}
                                  placeholder="Enter account holder name"
                                />
                              </div>
                              <Alert className="mt-2">
                                <AlertCircle className="h-4 w-4" />
                                <AlertTitle>About Payout Accounts</AlertTitle>
                                <AlertDescription>
                                  Your payout account is where you'll receive payments for services you provide. Once verified, payments will be automatically deposited to this account when a service is completed.
                                </AlertDescription>
                              </Alert>
                              <div className="flex justify-end space-x-2 mt-4">
                                <Button variant="outline" onClick={() => setShowAddPayoutAccount(false)}>
                                  Cancel
                                </Button>
                                <Button onClick={handleSavePayoutAccount}>
                                  {saving ? (
                                    <>
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...
                                    </>
                                  ) : (
                                    "Save Account"
                                  )}
                                </Button>
                              </div>
                            </div>
                          </div>
                        )}
                      </>
                    )}
                  </CardContent>
                </Card>
              )}
            </div>
          </TabsContent>

          <TabsContent value="kyc" className="space-y-6">
            <div className="flex-1">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    Business Verification
                  </CardTitle>
                  <CardDescription>
                    {userProfile?.user_role === "business"
                      ? "Complete business verification to unlock full marketplace features and provide services to customers. This helps maintain a safe and trusted marketplace."
                      : "Business verification is only required for business accounts offering services on the platform."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Account Type Alert */}
                  {userProfile?.user_role !== "business" && (
                    <Alert>
                      <div className="flex items-center gap-2">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Standard Account</AlertTitle>
                      </div>
                      <AlertDescription>
                        You have a standard account. Verification is only required for business accounts.
                        If you wish to offer services on the platform, you can upgrade to a business account in the Profile tab.
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* Verification Result Messages */}
                  {verificationResult && (
                    <Alert variant={verificationResult.status === 'success' ? "default" : "destructive"}
                      className={verificationResult.status === 'success' ? "bg-green-900 border-green-200" : ""}
                    >
                      <div className="flex items-center gap-2">
                        {verificationResult.status === 'success' ? (
                          <CheckCircle className="h-4 w-4 text-green-600" />
                        ) : (
                          <AlertTriangle className="h-4 w-4" />
                        )}
                        <AlertTitle>
                          {verificationResult.status === 'success' ? "Verification Submitted" : "Verification Error"}
                        </AlertTitle>
                      </div>
                      <AlertDescription>
                        {verificationResult.message}
                      </AlertDescription>
                    </Alert>
                  )}

                  {/* KYC Status Section */}
                  <div className="rounded-md border p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="font-medium">Verification Status</h3>
                        <p className="text-sm text-muted-foreground mt-1">
                          {userProfile?.kyc_verified
                            ? "Your business has been successfully verified."
                            : userProfile?.user_role === "business"
                              ? "Your business verification is pending or incomplete."
                              : "Not applicable for standard accounts."}
                        </p>
                      </div>

                      <div>
                        {userProfile?.kyc_verified ? (
                          <div className="flex items-center gap-1 bg-green-100 text-green-800 px-3 py-1 rounded-full text-sm">
                            <CheckCircle className="h-4 w-4" />
                            <span>Verified</span>
                          </div>
                        ) : userProfile?.user_role !== "business" ? (
                          <div className="flex items-center gap-1 bg-gray-100 text-gray-800 px-3 py-1 rounded-full text-sm">
                            <AlertCircle className="h-4 w-4" />
                            <span>Not Required</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-3 py-1 rounded-full text-sm">
                            <AlertTriangle className="h-4 w-4" />
                            <span>Not Verified</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Status details if available */}
                  {userProfile?.user_role === "business" && (
                    <>
                      {kycStatus === 'started' || kycStatus === 'pending' ? (
                        <Alert className="bg-blue-900 border-blue-200">
                          <div className="flex items-center gap-2">
                            <AlertCircle className="h-4 w-4 text-blue-600" />
                            <AlertTitle>Verification In Progress</AlertTitle>
                          </div>
                          <AlertDescription>
                            Your business verification is being processed. This usually takes 1-3 business days.
                            You'll receive a notification when it's complete.
                          </AlertDescription>
                        </Alert>
                      ) : kycStatus === 'rejected' ? (
                        <Alert variant="destructive">
                          <div className="flex items-center gap-2">
                            <AlertTriangle className="h-4 w-4" />
                            <AlertTitle>Verification Rejected</AlertTitle>
                          </div>
                          <AlertDescription>
                            {userProfile?.kyc_rejection_reason ||
                              "Your verification was rejected. Please ensure your business documents are clear and valid, then try again. Contact support if you need assistance."}
                          </AlertDescription>
                        </Alert>
                      ) : null}
                    </>
                  )}

                  {/* Verification Benefits */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-primary" />
                        <h3 className="font-medium">Trust & Safety</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Verification adds a trust badge to your profile and increases customer confidence in your services.
                      </p>
                    </div>
                    
                    <div className="p-4 border rounded-md">
                      <div className="flex items-center gap-2 mb-2">
                        <DollarSign className="h-5 w-5 text-primary" />
                        <h3 className="font-medium">Accept Payments</h3>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        Verified businesses can receive payments and manage service bookings through the platform.
                      </p>
                    </div>
                  </div>

                  <div className="rounded-md border p-4 bg-muted/50">
                    <h3 className="font-medium mb-2">Verification Information</h3>
                    <p className="text-sm text-muted-foreground">
                      We use Sumsub for secure, compliant business verification. Verification typically takes 1-2 business days 
                      after document submission. Your information is encrypted and securely stored.
                    </p>
                    <div className="flex items-center mt-2">
                      <ExternalLink className="h-4 w-4 mr-1 text-muted-foreground" />
                      <a 
                        href="https://sumsub.com/document-verification/" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-xs text-primary hover:underline"
                      >
                        Learn more about Sumsub verification
                      </a>
                    </div>
                  </div>

                  {/* Start Verification Button */}
                  {userProfile?.user_role === "business" && !userProfile?.kyc_verified && kycStatus !== 'pending' && (
                    <Button
                      onClick={handleStartKYCVerification}
                      disabled={saving}
                      className="w-full"
                    >
                      {saving ? (
                        <>Loading...</>
                      ) : (
                        <>
                          <ExternalLink className="mr-2 h-4 w-4" />
                          Start Business Verification
                        </>
                      )}
                    </Button>
                  )}

                  {/* For regular users - account upgrade button */}
                  {userProfile?.user_role !== "business" && (
                    <div className="flex justify-center">
                      <Button
                        variant="outline"
                        onClick={() => setActiveTab("profile")}
                      >
                        <Briefcase className="mr-2 h-4 w-4" />
                        Upgrade to Business Account
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
} 