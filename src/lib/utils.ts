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
