import React, { useEffect } from 'react';
import { SUPPORTED_CURRENCIES } from '@/utils/currency-helper';

// Default to Naira for users in Nigeria
const CurrencyDisplayWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  useEffect(() => {
    // Run this only once on initial page load
    try {
      // Set NGN as preferred currency in localStorage if:
      // 1. User is likely in Nigeria
      // 2. User hasn't already set a currency preference
      const isNigeria = 
        navigator.languages?.some(lang => lang.includes('NG') || lang.includes('ng')) ||
        Intl.DateTimeFormat().resolvedOptions().timeZone?.includes('Lagos') ||
        window.location.hostname.endsWith('.ng');
        
      const userPreference = localStorage.getItem('currency_preference');
      
      if (isNigeria && !userPreference) {
        console.log('Nigerian user detected, setting default currency to NGN');
        localStorage.setItem('currency_preference', 'NGN');
        
        // Force browser to reload to apply the setting
        if (!userPreference) {
          window.location.reload();
        }
      }
    } catch (e) {
      console.error('Error detecting region for currency', e);
    }
  }, []);

  return <>{children}</>;
};

export default CurrencyDisplayWrapper; 