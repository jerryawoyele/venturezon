import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Formats a price value to a currency string
 * @param price - The price to format
 * @param currency - The currency code (default: USD)
 * @returns Formatted price string
 */
export function formatPrice(price: number, currency: string = 'USD'): string {
  // Check for Nigerian indicators as a backup mechanism
  const isNigeria = 
    navigator.languages?.some(lang => lang.includes('NG') || lang.includes('ng')) ||
    Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Lagos') ||
    window.location.hostname.endsWith('.ng');
  
  // Force NGN if user appears to be in Nigeria and has not explicitly chosen a different currency
  if (isNigeria && !localStorage.getItem('currency_preference')) {
    currency = 'NGN';
  }
  
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(price)
}

export function formatCurrency(amount: number, currency: string = "USD"): string {
  if (!amount && amount !== 0) return "N/A";
  
  const currencyFormatters: Record<string, (value: number) => string> = {
    USD: (value) => `$${value.toFixed(2)}`,
    NGN: (value) => `₦${value.toLocaleString("en-NG")}`,
    GBP: (value) => `£${value.toFixed(2)}`,
    EUR: (value) => `€${value.toFixed(2)}`,
  };

  // Use the appropriate formatter or fallback to a generic one
  const formatter = currencyFormatters[currency] || ((value) => `${value.toFixed(2)} ${currency}`);
  return formatter(amount);
}

// Currency conversion rates (as of your implementation date)
const conversionRates: Record<string, Record<string, number>> = {
  USD: {
    NGN: 1500, // 1 USD = 1500 NGN
    GBP: 0.78, // 1 USD = 0.78 GBP
    EUR: 0.92, // 1 USD = 0.92 EUR
    USD: 1,    // 1 USD = 1 USD (identity)
  },
  NGN: {
    USD: 1/1500, // 1 NGN = 0.00067 USD
    GBP: 0.00052, // 1 NGN = 0.00052 GBP
    EUR: 0.00061, // 1 NGN = 0.00061 EUR
    NGN: 1,      // 1 NGN = 1 NGN (identity)
  },
  GBP: {
    USD: 1.28,   // 1 GBP = 1.28 USD
    NGN: 1925,   // 1 GBP = 1925 NGN
    EUR: 1.18,   // 1 GBP = 1.18 EUR
    GBP: 1,      // 1 GBP = 1 GBP (identity)
  },
  EUR: {
    USD: 1.09,   // 1 EUR = 1.09 USD
    NGN: 1630,   // 1 EUR = 1630 NGN
    GBP: 0.85,   // 1 EUR = 0.85 GBP
    EUR: 1,      // 1 EUR = 1 EUR (identity)
  },
};

/**
 * Converts an amount from one currency to another
 * @param amount The amount to convert
 * @param fromCurrency The source currency code
 * @param toCurrency The target currency code
 * @returns The converted amount
 */
export function convertCurrency(
  amount: number, 
  fromCurrency: string = "USD", 
  toCurrency: string = "NGN"
): number {
  // If currencies are the same, no conversion needed
  if (fromCurrency === toCurrency) {
    return amount;
  }
  
  // Check if we have conversion rates for these currencies
  if (
    !conversionRates[fromCurrency] || 
    !conversionRates[fromCurrency][toCurrency]
  ) {
    console.warn(`No conversion rate found for ${fromCurrency} to ${toCurrency}`);
    return amount; // Return original amount if no conversion available
  }
  
  // Perform the conversion
  return amount * conversionRates[fromCurrency][toCurrency];
}
