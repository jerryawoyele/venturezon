import { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

type Theme = "light" | "dark" | "system";

type ThemeProviderProps = {
  children: React.ReactNode;
  defaultTheme?: Theme;
  storageKey?: string;
};

type ThemeProviderState = {
  theme: Theme;
  setTheme: (theme: Theme) => void;
};

const initialState: ThemeProviderState = {
  theme: "system",
  setTheme: () => null,
};

const ThemeProviderContext = createContext<ThemeProviderState>(initialState);

export function ThemeProvider({
  children,
  defaultTheme = "system",
  storageKey = "ui-theme",
  ...props
}: ThemeProviderProps) {
  const [theme, setTheme] = useState<Theme>("system"); // Initialize with system as default
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);

  // Check authentication status
  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        const isUserAuthenticated = !!session;
        setIsAuthenticated(isUserAuthenticated);

        // Only apply stored theme for authenticated users
        if (isUserAuthenticated) {
          const storedTheme = localStorage.getItem(storageKey) as Theme;
          setTheme(storedTheme || defaultTheme);
        } else {
          // For unauthenticated users, always use system theme
          setTheme("system");
        }
        
        setIsInitialized(true);
      } catch (error) {
        console.error("Error checking auth:", error);
        // Default to system theme on error
        setTheme("system");
        setIsInitialized(true);
      }
    };

    checkAuth();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      const isUserAuthenticated = !!session;
      setIsAuthenticated(isUserAuthenticated);
      
      if (!isUserAuthenticated) {
        // Reset to system theme when user logs out
        setTheme("system");
      } else if (isUserAuthenticated && !isInitialized) {
        // Apply stored theme when user logs in
        const storedTheme = localStorage.getItem(storageKey) as Theme;
        setTheme(storedTheme || defaultTheme);
      }
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [defaultTheme, storageKey]);

  // Apply theme to document
  useEffect(() => {
    if (!isInitialized) return;
    
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
    } else {
      root.classList.add(theme);
    }
  }, [theme, isInitialized]);

  // Handle system theme changes
  useEffect(() => {
    if (!isInitialized) return;
    
    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    
    const handleChange = () => {
      if (theme === "system") {
        const root = window.document.documentElement;
        root.classList.remove("light", "dark");
        root.classList.add(mediaQuery.matches ? "dark" : "light");
      }
    };

    mediaQuery.addEventListener("change", handleChange);
    return () => mediaQuery.removeEventListener("change", handleChange);
  }, [theme, isInitialized]);

  const value = {
    theme,
    setTheme: (newTheme: Theme) => {
      // Only store theme preference for authenticated users
      if (isAuthenticated) {
        localStorage.setItem(storageKey, newTheme);
      }
      setTheme(newTheme);
    },
  };

  return (
    <ThemeProviderContext.Provider {...props} value={value}>
      {children}
    </ThemeProviderContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeProviderContext);

  if (context === undefined)
    throw new Error("useTheme must be used within a ThemeProvider");

  return context;
}; 