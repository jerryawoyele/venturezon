import React from 'react';
import { useEffect, useState } from 'react';
import CurrencySwitcher from './CurrencySwitcher';

// This wrapper ensures the CurrencySwitcher only mounts after everything else is ready
const CurrencySwitcherWrapper: React.FC = () => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Small delay to ensure context providers are fully initialized
    const timer = setTimeout(() => {
      setIsReady(true);
    }, 100);

    return () => clearTimeout(timer);
  }, []);

  // Don't render anything until we're ready
  if (!isReady) {
    return null;
  }

  // Now it's safe to use the CurrencySwitcher
  return <CurrencySwitcher />;
};

export default CurrencySwitcherWrapper; 