import React, { useEffect } from 'react';
import { useCurrency } from "@/contexts/CurrencyContext";
import { DollarSign } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const CurrencySwitcher = () => {
  const { currency, setCurrency, symbol, forceOverride } = useCurrency();
  
  // List of common currencies for quick switching
  const quickCurrencies = [
    { code: 'NGN', name: 'Nigerian Naira', symbol: '₦' },
    { code: 'USD', name: 'US Dollar', symbol: '$' },
    { code: 'GBP', name: 'British Pound', symbol: '£' },
    { code: 'EUR', name: 'Euro', symbol: '€' },
  ];

  // Force Nigerian currency if we detect we're in Nigeria or user has previously chosen NGN
  useEffect(() => {
    const userPreference = localStorage.getItem('currency_preference');
    
    // If user has explicitly chosen NGN before, or we detect Nigeria, set to NGN
    if (userPreference === 'NGN' || 
        window.location.hostname.includes('ng') || 
        navigator.language.includes('NG') || 
        navigator.language.includes('ng')) {
      
      console.log('Nigeria detected - forcing Naira currency');
      setCurrency('NGN' as any);
    }
  }, [setCurrency]);
  
  return (
    <div className="fixed right-4 bottom-4 z-50">
      <Popover>
        <PopoverTrigger asChild>
          <Button 
            size="sm" 
            variant="outline"
            className="h-9 rounded-full shadow-md border-primary/20 bg-background/80 backdrop-blur-sm"
            aria-label="Change currency"
          >
            <span className="mr-1">{symbol}</span>
            <DollarSign className="h-3.5 w-3.5 text-primary" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[200px] p-2" align="end">
          <div className="space-y-1">
            <h3 className="font-medium text-sm mb-2">Quick Currency Switch</h3>
            {quickCurrencies.map((curr) => (
              <Button
                key={curr.code}
                variant={currency === curr.code ? "default" : "ghost"}
                size="sm" 
                className="w-full justify-start"
                onClick={() => {
                  setCurrency(curr.code as any);
                  localStorage.setItem('currency_preference', curr.code);
                  
                  // If this is NGN, also try to force override location
                  if (curr.code === 'NGN') {
                    try {
                      forceOverride?.('NG');
                    } catch (e) {
                      console.error('Failed to override to Nigeria', e);
                    }
                  }
                }}
              >
                <span className="mr-2">{curr.symbol}</span>
                {curr.name}
              </Button>
            ))}
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
};

export default CurrencySwitcher; 