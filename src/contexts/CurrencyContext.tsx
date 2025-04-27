import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { getCountryFromIP, saveUserCountry } from '@/lib/location';
import { supabase } from "@/integrations/supabase/client";
import { 
  DEFAULT_CURRENCY, 
  SUPPORTED_CURRENCIES, 
  getUserCurrencyPreference, 
  saveUserCurrencyPreference,
  formatPrice as formatPriceUtil,
  convertCurrency,
  getUserCurrency
} from "@/utils/currency-helper";
import { useAuth } from "./AuthContext";

// Define available currencies - use the types from currency-helper
export type CurrencyCode = keyof typeof SUPPORTED_CURRENCIES;

interface CurrencySymbols {
  [key: string]: string;
}

// Currency symbols
const currencySymbols: CurrencySymbols = {
  NGN: '₦',
  USD: '$',
  EUR: '€',
  GBP: '£',
  CAD: 'CA$',
  AUD: 'A$',
  JPY: '¥',
};

// Country to currency mapping
const countryCurrencyMap: { [key: string]: CurrencyCode } = {
  // Africa
  NG: 'NGN',
  GH: 'GHS',
  ZA: 'ZAR',
  KE: 'KES',
  
  // North America
  US: 'USD',
  CA: 'CAD',
  MX: 'USD',
  
  // Europe
  GB: 'GBP',
  EU: 'EUR', // Not a country code but used for simplification
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  PT: 'EUR',
  IE: 'EUR',
  CH: 'EUR',
  AT: 'EUR',
  
  // Asia
  JP: 'JPY',
  CN: 'CNY',
  IN: 'INR',
  SG: 'USD',
  
  // Oceania
  AU: 'AUD',
  NZ: 'USD',
};

// Default currency if country is not in the map
const defaultCurrency: CurrencyCode = 'USD';

// Simplified exchange rates (in production, these would come from an API)
const exchangeRates: { [key: string]: number } = {
  USD: 1,
  NGN: 1500,
  GBP: 0.78,
  EUR: 0.92,
  CAD: 1.35,
  AUD: 1.52,
  INR: 83.12,
  JPY: 150.5,
  CNY: 7.22,
  ZAR: 18.27,
  GHS: 14.54,
  KES: 129.82
};

interface CurrencyContextType {
  currency: CurrencyCode;
  setCurrency: (currency: CurrencyCode) => void;
  symbol: string;
  convertPrice: (amount: number, fromCurrency?: CurrencyCode) => Promise<number>;
  formatPrice: (amount: number, fromCurrency?: CurrencyCode) => string;
  forceOverride: (countryCode: string) => void;
}

const CurrencyContext = createContext<CurrencyContextType | undefined>(undefined);

export const useCurrency = () => {
  const context = useContext(CurrencyContext);
  if (!context) {
    console.warn('useCurrency used outside CurrencyProvider - using fallback values');
    return {
      currency: 'USD',
      symbol: '$',
      formatPrice: (price) => `$${Number(price).toFixed(2)}`,
      // Add other necessary properties
    };
  }
  return context;
};

interface CurrencyProviderProps {
  children: ReactNode;
}

export const CurrencyProvider = ({ children }: CurrencyProviderProps) => {
  console.log('CurrencyProvider mounted');
  // Immediate check for currency preference in localStorage 
  let initialCurrency = DEFAULT_CURRENCY;
  let initialSymbol = SUPPORTED_CURRENCIES[DEFAULT_CURRENCY].symbol;
  
  try {
    // Check localStorage first
    const storedPreference = localStorage.getItem('currency_preference');
    if (storedPreference && SUPPORTED_CURRENCIES[storedPreference]) {
      initialCurrency = storedPreference;
      initialSymbol = SUPPORTED_CURRENCIES[storedPreference].symbol;
      console.log(`Using stored currency preference: ${initialCurrency}`);
    } 
    // Then check Nigeria-specific indicators
    else {
      const isNigeria = 
        navigator.languages?.some(lang => lang.includes('NG') || lang.includes('ng')) ||
        Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Lagos') ||
        window.location.hostname.endsWith('.ng');
        
      if (isNigeria) {
        initialCurrency = 'NGN';
        initialSymbol = SUPPORTED_CURRENCIES.NGN.symbol;
        console.log('Nigeria detected - using NGN currency');
      }
    }
  } catch (e) {
    console.error('Error checking initial currency:', e);
  }
  
  const [currency, setCurrency] = useState<CurrencyCode>(initialCurrency as CurrencyCode);
  const [symbol, setSymbol] = useState<string>(initialSymbol);
  const [loading, setLoading] = useState<boolean>(true);
  const { user, isLoading: authLoading } = useAuth();

  // Detect user's currency preference or use location-based default
  useEffect(() => {
    const initCurrency = async () => {
      try {
        setLoading(true);
        
        console.log('Initializing currency context...');
        
        // If user is authenticated, get their currency preference
        if (user) {
          console.log('User is authenticated, checking currency preference...');
          const userCurrency = await getUserCurrencyPreference(user.id);
          
          if (userCurrency && SUPPORTED_CURRENCIES[userCurrency]) {
            console.log(`User has currency preference set: ${userCurrency}`);
            setCurrency(userCurrency as CurrencyCode);
            setSymbol(SUPPORTED_CURRENCIES[userCurrency].symbol);
            setLoading(false);
            return;
          }
        } 
        
        // Fallback to location-based currency if no user preference
        try {
          console.log('Detecting country from IP...');
          const countryCode = await getCountryFromIP();
          
          if (countryCode) {
            console.log(`Country detected: ${countryCode}`);
            
            // Save country code to profile if user is logged in
            if (user) {
              console.log(`Saving country code ${countryCode} for user ${user.id}`);
              await saveUserCountry(user.id, countryCode);
            }
            
            // Get currency for this country
            const locationCurrency = countryCurrencyMap[countryCode] || DEFAULT_CURRENCY;
            console.log(`Mapped country ${countryCode} to currency: ${locationCurrency}`);
            
            setCurrency(locationCurrency);
            setSymbol(SUPPORTED_CURRENCIES[locationCurrency].symbol);
            
            // Save this preference if user is logged in
            if (user) {
              console.log(`Saving currency preference ${locationCurrency} for user ${user.id}`);
              await saveUserCurrencyPreference(user.id, locationCurrency);
            }
            
            setLoading(false);
            return;
          }
        } catch (locationError) {
          console.error('Error detecting location-based currency:', locationError);
        }
        
        // Default fallback
        console.log(`No country detected or currency mapped. Using default: ${DEFAULT_CURRENCY}`);
        setCurrency(DEFAULT_CURRENCY as CurrencyCode);
        setSymbol(SUPPORTED_CURRENCIES[DEFAULT_CURRENCY].symbol);
      } catch (error) {
        console.error('Error initializing currency:', error);
        // Fallback to default
        setCurrency(DEFAULT_CURRENCY as CurrencyCode);
        setSymbol(SUPPORTED_CURRENCIES[DEFAULT_CURRENCY].symbol);
      } finally {
        setLoading(false);
      }
    };

    // Only initialize after auth state is determined
    if (!authLoading) {
      initCurrency();
    }
  }, [user, authLoading]);

  // Convert price from one currency to another
  const convertPrice = async (amount: number, fromCurrency: CurrencyCode = DEFAULT_CURRENCY as CurrencyCode): Promise<number> => {
    try {
      return await convertCurrency(amount, fromCurrency, currency);
    } catch (error) {
      console.error('Error converting currency:', error);
      return amount;
    }
  };

  // Format price with currency symbol and proper decimals
  const formatPrice = (amount: number, fromCurrency?: CurrencyCode): string => {
    try {
      if (fromCurrency && fromCurrency !== currency) {
        // Convert the amount from fromCurrency to the current currency
        // Convert synchronously using the simplified exchange rates
        const fromRate = exchangeRates[fromCurrency] || 1;
        const toRate = exchangeRates[currency] || 1;
        
        // Calculate the converted amount
        // If from USD to NGN: amount * (1500/1) = amount * 1500
        // If from NGN to USD: amount * (1/1500) = amount / 1500
        const convertedAmount = amount * (toRate / fromRate);
        
        return formatPriceUtil(convertedAmount, currency);
      }
      
      if (!fromCurrency && currency !== DEFAULT_CURRENCY) {
        // If no fromCurrency is specified, assume it's USD
        const toRate = exchangeRates[currency] || 1;
        const convertedAmount = amount * toRate;
        return formatPriceUtil(convertedAmount, currency);
      }
      
      return formatPriceUtil(amount, currency);
    } catch (error) {
      console.error('Error formatting price:', error);
      return `${symbol}${amount.toFixed(2)}`;
    }
  };

  // Set user currency and save preference
  const setUserCurrency = async (newCurrency: CurrencyCode) => {
    if (!SUPPORTED_CURRENCIES[newCurrency]) {
      console.error(`Currency ${newCurrency} is not supported`);
      return;
    }
    
    setCurrency(newCurrency);
    setSymbol(SUPPORTED_CURRENCIES[newCurrency].symbol);
    
    // Save preference if user is authenticated
    if (user) {
      await saveUserCurrencyPreference(user.id, newCurrency);
    }
  };

  const forceOverride = async (countryCode: string) => {
    console.log(`Manually overriding country to: ${countryCode}`);
    
    try {
      const normalizedCountry = countryCode.toUpperCase();
      
      // Get currency for this country
      const locationCurrency = countryCurrencyMap[normalizedCountry] || DEFAULT_CURRENCY;
      console.log(`Mapped country ${normalizedCountry} to currency: ${locationCurrency}`);
      
      setCurrency(locationCurrency);
      setSymbol(SUPPORTED_CURRENCIES[locationCurrency].symbol);
      
      // Save this preference if user is logged in
      if (user) {
        console.log(`Saving overridden currency preference ${locationCurrency} for user ${user.id}`);
        await saveUserCountry(user.id, normalizedCountry);
        await saveUserCurrencyPreference(user.id, locationCurrency);
      }
      
      return true;
    } catch (error) {
      console.error('Error overriding currency:', error);
      return false;
    }
  };

  const value = {
    currency,
    setCurrency: setUserCurrency,
    symbol,
    convertPrice,
    formatPrice,
    forceOverride,
  };

  if (loading && authLoading) {
    // Could return a loading spinner here if needed
    return <>{children}</>;
  }

  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}; 