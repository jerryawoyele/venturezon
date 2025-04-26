import { createContext, useState, useEffect, useContext, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Session, User } from "@supabase/supabase-js";

// Create a context type with the shape of our auth state
type AuthContextType = {
  session: Session | null;
  user: User | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  persistSession: boolean;
  userRole: "business" | "customer" | null;
};

// Default context value
const defaultAuthContext: AuthContextType = {
  session: null,
  user: null,
  isLoading: true,
  signOut: async () => {},
  persistSession: true,
  userRole: null,
};

// Create the auth context
const AuthContext = createContext<AuthContextType>(defaultAuthContext);

// Session storage key for caching
const SESSION_STORAGE_KEY = "markezon_session_cache";
const USER_ROLE_KEY = "markezon_user_role";

// Provider component
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [userRole, setUserRole] = useState<"business" | "customer" | null>(null);
  
  // Used to determine if we should persist the session
  const [persistSession] = useState(true);

  // Load cached user role
  useEffect(() => {
    try {
      const cachedRole = localStorage.getItem(USER_ROLE_KEY);
      if (cachedRole) {
        setUserRole(cachedRole as "business" | "customer");
      }
    } catch (error) {
      console.error("Error loading cached user role:", error);
    }
  }, []);

  useEffect(() => {
    // Try to get cached session first for instant UI updates
    try {
      const cachedSessionStr = localStorage.getItem(SESSION_STORAGE_KEY);
      if (cachedSessionStr) {
        const cachedSession = JSON.parse(cachedSessionStr);
        // Only use cached session if it hasn't expired
        if (cachedSession.expires_at * 1000 > Date.now()) {
          setSession(cachedSession);
          setUser(cachedSession.user);
        }
      }
    } catch (error) {
      console.error("Error loading cached session:", error);
    }

    // Get the current session from Supabase
    const getInitialSession = async () => {
      try {
        setIsLoading(true);
        
        const { data: { session: supabaseSession }, error } = await supabase.auth.getSession();
        
        if (error) {
          throw error;
        }
        
        if (supabaseSession) {
          setSession(supabaseSession);
          setUser(supabaseSession.user);
          
          // Cache the session for faster loading next time
          if (persistSession) {
            localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(supabaseSession));
          }

          // Fetch user role from profile
          fetchUserRole(supabaseSession.user.id);
        }
      } catch (error) {
        console.error("Error fetching session:", error);
      } finally {
        setIsLoading(false);
      }
    };

    getInitialSession();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setSession(newSession);
        setUser(newSession?.user || null);
        
        // Cache the session for faster loading next time
        if (newSession && persistSession) {
          localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(newSession));
          
          // Fetch user role when session changes
          fetchUserRole(newSession.user.id);
        } else if (!newSession) {
          localStorage.removeItem(SESSION_STORAGE_KEY);
          localStorage.removeItem(USER_ROLE_KEY);
          setUserRole(null);
        }
        
        setIsLoading(false);
      }
    );

    // Cleanup the subscription
    return () => {
      subscription.unsubscribe();
    };
  }, [persistSession]);

  // Fetch user role from profile
  const fetchUserRole = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("user_role")
        .eq("id", userId)
        .single();
      
      if (error) {
        throw error;
      }
      
      if (data && data.user_role) {
        setUserRole(data.user_role as "business" | "customer");
        
        // Cache the user role
        if (persistSession) {
          localStorage.setItem(USER_ROLE_KEY, data.user_role);
        }
      }
    } catch (error) {
      console.error("Error fetching user role:", error);
    }
  };

  const signOut = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // Clear cached session and role
      localStorage.removeItem(SESSION_STORAGE_KEY);
      localStorage.removeItem(USER_ROLE_KEY);
      setSession(null);
      setUser(null);
      setUserRole(null);
    } catch (error) {
      console.error("Error signing out:", error);
    }
  };

  const value = {
    session,
    user,
    isLoading,
    signOut,
    persistSession,
    userRole,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// Hook to use the auth context
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}; 