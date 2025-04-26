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

// Add script to head to prevent theme flash
const themeScript = `
  (function() {
    // Try to get theme from localStorage
    const storedTheme = localStorage.getItem("ui-theme");
    
    // Apply the theme
    function setTheme(theme) {
      document.documentElement.classList.remove('light', 'dark');
      
      if (theme === "system" || !theme) {
        const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        document.documentElement.classList.add(systemTheme);
      } else {
        document.documentElement.classList.add(theme);
      }
    }
    
    // First check localStorage
    if (storedTheme) {
      setTheme(storedTheme);
    } else {
      // Default to system if no stored preference
      setTheme("system");
    }
  })();
`;

// Create and inject script to document head on initial load
if (typeof window !== 'undefined') {
  const createThemeScript = () => {
    if (!document.getElementById('theme-script')) {
      const script = document.createElement('script');
      script.id = 'theme-script';
      script.innerHTML = themeScript;
      document.head.appendChild(script);
    }
  };
  createThemeScript();
}

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

        // Get stored theme preference for all users
        const storedTheme = localStorage.getItem(storageKey) as Theme;
        setTheme(storedTheme || defaultTheme);
        
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
      
      if (!isUserAuthenticated && !isInitialized) {
        // Don't reset theme on logout, keep user preference
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
      // Store theme preference for all users, not just authenticated ones
      localStorage.setItem(storageKey, newTheme);
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