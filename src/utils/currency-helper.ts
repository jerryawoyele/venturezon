import { supabase } from "@/integrations/supabase/client";

// Define supported currencies with their symbols and codes
export const SUPPORTED_CURRENCIES = {
  USD: { symbol: "$", name: "US Dollar", code: "USD" },
  NGN: { symbol: "₦", name: "Nigerian Naira", code: "NGN" },
  GBP: { symbol: "£", name: "British Pound", code: "GBP" },
  EUR: { symbol: "€", name: "Euro", code: "EUR" },
  CAD: { symbol: "C$", name: "Canadian Dollar", code: "CAD" },
  AUD: { symbol: "A$", name: "Australian Dollar", code: "AUD" },
  INR: { symbol: "₹", name: "Indian Rupee", code: "INR" },
  JPY: { symbol: "¥", name: "Japanese Yen", code: "JPY" },
  CNY: { symbol: "¥", name: "Chinese Yuan", code: "CNY" },
  ZAR: { symbol: "R", name: "South African Rand", code: "ZAR" },
  GHS: { symbol: "GH₵", name: "Ghanaian Cedi", code: "GHS" },
  KES: { symbol: "KSh", name: "Kenyan Shilling", code: "KES" },
};

// Default currency
export const DEFAULT_CURRENCY = "USD";

// Map countries to currencies
export const COUNTRY_CURRENCY_MAP: { [key: string]: string } = {
  // North America
  "united states": "USD",
  "canada": "CAD",
  "mexico": "USD",
  
  // Europe
  "united kingdom": "GBP",
  "france": "EUR",
  "germany": "EUR",
  "italy": "EUR",
  "spain": "EUR",
  "netherlands": "EUR",
  "belgium": "EUR",
  "portugal": "EUR",
  "ireland": "EUR",
  "greece": "EUR",
  "sweden": "EUR",
  "denmark": "EUR",
  "finland": "EUR",
  "norway": "EUR",
  "switzerland": "EUR",
  "austria": "EUR",
  
  // Africa
  "nigeria": "NGN",
  "ghana": "GHS",
  "kenya": "KES",
  "south africa": "ZAR",
  "egypt": "USD",
  "morocco": "USD",
  "tanzania": "USD",
  "ethiopia": "USD",
  
  // Asia
  "india": "INR",
  "japan": "JPY",
  "china": "CNY",
  "south korea": "USD",
  "singapore": "USD",
  "malaysia": "USD",
  "indonesia": "USD",
  "thailand": "USD",
  "vietnam": "USD",
  "philippines": "USD",
  
  // Oceania
  "australia": "AUD",
  "new zealand": "USD",
};

// Function to get exchange rates from an API
// Using exchangerate-api.com as an example (you'll need to register for an API key)
export async function fetchExchangeRates(baseCurrency = "USD") {
  try {
    const apiKey = import.meta.env.VITE_EXCHANGE_RATE_API_KEY;
    
    // If no API key is available, return mock data
    if (!apiKey) {
      console.warn("No exchange rate API key found. Using mock data.");
      return getMockExchangeRates(baseCurrency);
    }
    
    const response = await fetch(
      `https://v6.exchangerate-api.com/v6/${apiKey}/latest/${baseCurrency}`
    );
    
    if (!response.ok) {
      throw new Error(`Exchange rate API error: ${response.statusText}`);
    }
    
    const data = await response.json();
    return data.conversion_rates;
  } catch (error) {
    console.error("Error fetching exchange rates:", error);
    return getMockExchangeRates(baseCurrency);
  }
}

// Mock data for development or when API is not available
function getMockExchangeRates(baseCurrency = "USD") {
  const mockRates: Record<string, Record<string, number>> = {
    "USD": {
      "EUR": 0.91,
      "GBP": 0.78,
      "NGN": 1500,
      "CAD": 1.35,
      "AUD": 1.49,
      "INR": 83.12,
      "JPY": 149.82,
      "CNY": 7.22,
      "ZAR": 18.27,
      "GHS": 14.54,
      "KES": 129.82,
    },
    "NGN": {
      "USD": 0.00067,
      "EUR": 0.00061,
      "GBP": 0.00052,
      "CAD": 0.0009,
      "AUD": 0.00099,
      "INR": 0.055,
      "JPY": 0.1,
      "CNY": 0.0048,
      "ZAR": 0.012,
      "GHS": 0.0097,
      "KES": 0.087,
    }
  };
  
  // Create rates object with all currencies
  const rates: Record<string, number> = {};
  
  // Add rates from mock data or set to 1 for base currency
  Object.keys(SUPPORTED_CURRENCIES).forEach(currency => {
    if (currency === baseCurrency) {
      rates[currency] = 1;
    } else if (mockRates[baseCurrency] && mockRates[baseCurrency][currency]) {
      rates[currency] = mockRates[baseCurrency][currency];
    } else if (mockRates[currency] && mockRates[currency][baseCurrency]) {
      // Inverse rate
      rates[currency] = 1 / mockRates[currency][baseCurrency];
    } else {
      // Fallback value if not found
      rates[currency] = 1;
    }
  });
  
  return rates;
}

// Convert amount from one currency to another
export async function convertCurrency(
  amount: number,
  fromCurrency: string,
  toCurrency: string
) {
  if (fromCurrency === toCurrency) return amount;
  
  const rates = await fetchExchangeRates(fromCurrency);
  
  if (!rates || !rates[toCurrency]) {
    console.error(`Exchange rate not found for ${fromCurrency} to ${toCurrency}`);
    return amount;
  }
  
  return amount * rates[toCurrency];
}

// Get user's currency from their profile/location
export async function getUserCurrency(userId?: string): Promise<string> {
  try {
    if (!userId) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id;
    }
    
    if (!userId) {
      return DEFAULT_CURRENCY;
    }
    
    // Get user's country from profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('country')
      .eq('id', userId)
      .single();
    
    if (error || !profile || !profile.country) {
      return DEFAULT_CURRENCY;
    }
    
    // Look up the currency for the country
    const countryLower = profile.country.toLowerCase();
    return COUNTRY_CURRENCY_MAP[countryLower] || DEFAULT_CURRENCY;
  } catch (error) {
    console.error("Error getting user currency:", error);
    return DEFAULT_CURRENCY;
  }
}

// Format price with appropriate currency symbol
export function formatPrice(
  amount: number, 
  currency = DEFAULT_CURRENCY,
  options = { maximumFractionDigits: 2 }
) {
  // First check localStorage for user preference
  try {
    const userPreference = localStorage.getItem('currency_preference');
    if (userPreference && SUPPORTED_CURRENCIES[userPreference]) {
      currency = userPreference;
    }
  } catch (e) {
    // Ignore localStorage errors and continue with passed currency
  }
  
  // Check for Nigerian indicators as a backup mechanism
  const isNigeria = 
    navigator.languages?.some(lang => lang.includes('NG') || lang.includes('ng')) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Lagos') ||
    window.location.hostname.endsWith('.ng');
  
  // Force NGN if user appears to be in Nigeria and has not explicitly chosen a different currency
  if (isNigeria && !localStorage.getItem('currency_preference')) {
    currency = 'NGN';
  }
  
  const currencyInfo = SUPPORTED_CURRENCIES[currency] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
  
  // For currencies like JPY that don't typically use decimals
  const useDecimals = !["JPY", "KRW"].includes(currency);
  const fractionDigits = useDecimals ? options.maximumFractionDigits : 0;
  
  return `${currencyInfo.symbol}${amount.toLocaleString(undefined, {
    maximumFractionDigits: fractionDigits,
  })}`;
}

// Get currency info by code
export function getCurrencyInfo(currencyCode: string) {
  return SUPPORTED_CURRENCIES[currencyCode] || SUPPORTED_CURRENCIES[DEFAULT_CURRENCY];
}

// Cache exchange rates for 1 hour
const exchangeRatesCache = new Map<string, { rates: Record<string, number>; timestamp: number }>();
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds

// Get exchange rates with caching
export async function getExchangeRates(baseCurrency = DEFAULT_CURRENCY) {
  const now = Date.now();
  const cachedData = exchangeRatesCache.get(baseCurrency);
  
  if (cachedData && now - cachedData.timestamp < CACHE_TTL) {
    return cachedData.rates;
  }
  
  // Fetch fresh rates
  const rates = await fetchExchangeRates(baseCurrency);
  
  // Update cache
  exchangeRatesCache.set(baseCurrency, { rates, timestamp: now });
  
  return rates;
}

// Save user's currency preference
export async function saveUserCurrencyPreference(userId: string, currencyCode: string) {
  try {
    const { error } = await supabase
      .from('profiles')
      .update({ preferred_currency: currencyCode })
      .eq('id', userId);
    
    if (error) throw error;
    
    return true;
  } catch (error) {
    console.error("Error saving currency preference:", error);
    return false;
  }
}

// Get user's currency preference (falls back to location-based currency)
export async function getUserCurrencyPreference(userId?: string): Promise<string> {
  try {
    // Special case for Nigerian users - to fix currency display issues
    // Check if the user appears to be in Nigeria based on browser locale or other hints
    const preferNaira = 
      navigator.languages?.some(lang => lang.includes('NG') || lang.includes('ng')) ||
      Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Lagos') ||
      window.location.hostname.endsWith('.ng');
      
    if (preferNaira) {
      console.log('Nigerian user detected via browser hints - defaulting to NGN');
      return 'NGN';
    }
    
    if (!userId) {
      const { data } = await supabase.auth.getUser();
      userId = data.user?.id;
    }
    
    if (!userId) {
      return DEFAULT_CURRENCY;
    }
    
    // Get user's preferred currency from profile
    const { data: profile, error } = await supabase
      .from('profiles')
      .select('preferred_currency, country')
      .eq('id', userId)
      .single();
    
    if (error) throw error;
    
    // Return preferred currency if set
    if (profile && profile.preferred_currency) {
      return profile.preferred_currency;
    }
    
    // Fall back to country-based currency
    if (profile && profile.country) {
      const countryLower = profile.country.toLowerCase();
      return COUNTRY_CURRENCY_MAP[countryLower] || DEFAULT_CURRENCY;
    }
    
    return DEFAULT_CURRENCY;
  } catch (error) {
    console.error("Error getting user currency preference:", error);
    return DEFAULT_CURRENCY;
  }
} 