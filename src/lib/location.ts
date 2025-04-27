import { supabase } from "@/integrations/supabase/client";

/**
 * Detect the user's country code from their IP address
 * 
 * @returns Promise resolving to country code or null if detection fails
 */
export async function getCountryFromIP(): Promise<string | null> {
  try {
    console.log('Attempting to detect country from IP...');
    
    // Try ipinfo.io first
    try {
      const ipinfoResponse = await fetch('https://ipinfo.io/json');
      
      if (ipinfoResponse.ok) {
        const ipinfoData = await ipinfoResponse.json();
        if (ipinfoData.country) {
          console.log('Country detected via ipinfo.io:', ipinfoData.country);
          return ipinfoData.country;
        }
      }
    } catch (ipinfoError) {
      console.error('ipinfo.io detection failed:', ipinfoError);
    }
    
    // Fallback to ipapi.co
    try {
      const ipapiResponse = await fetch('https://ipapi.co/json/');
      
      if (ipapiResponse.ok) {
        const ipapiData = await ipapiResponse.json();
        if (ipapiData.country_code) {
          console.log('Country detected via ipapi.co:', ipapiData.country_code);
          return ipapiData.country_code;
        }
      }
    } catch (ipapiError) {
      console.error('ipapi.co detection failed:', ipapiError);
    }
    
    // Last resort fallback to a third service
    try {
      const geoResponse = await fetch('https://geolocation-db.com/json/');
      
      if (geoResponse.ok) {
        const geoData = await geoResponse.json();
        if (geoData.country_code) {
          console.log('Country detected via geolocation-db:', geoData.country_code);
          return geoData.country_code;
        }
      }
    } catch (geoError) {
      console.error('geolocation-db detection failed:', geoError);
    }
    
    // If all services fail, return US as default with a clear message
    console.warn('IP geolocation failed with all services. Defaulting to US');
    return 'US';
  } catch (error) {
    console.error('Error detecting country from IP:', error);
    return 'US';
  }
}

/**
 * Save the detected country code for a user
 * 
 * @param userId The user ID
 * @param countryCode The country code to save
 * @returns True if saved successfully, false otherwise
 */
export async function saveUserCountry(userId: string, countryCode: string): Promise<boolean> {
  try {
    if (!userId || !countryCode) return false;
    
    // Update both country_code for API use and country for the currency mapping
    const countryName = getCountryNameFromCode(countryCode.toUpperCase());
    
    const { error } = await supabase
      .from('profiles')
      .update({ 
        country_code: countryCode.toUpperCase(),
        country: countryName?.toLowerCase() || null,
        location_updated_at: new Date().toISOString()
      })
      .eq('id', userId);
      
    if (error) {
      console.error('Error saving user country:', error);
      return false;
    }
    
    return true;
  } catch (error) {
    console.error('Exception saving user country:', error);
    return false;
  }
}

/**
 * Get the saved country code for a user
 * 
 * @param userId The user ID
 * @returns Promise resolving to country code or null if not found
 */
export async function getUserCountry(userId: string): Promise<string | null> {
  try {
    if (!userId) return null;
    
    const { data, error } = await supabase
      .from('profiles')
      .select('country_code')
      .eq('id', userId)
      .single();
      
    if (error || !data) {
      console.error('Error fetching user country:', error);
      return null;
    }
    
    return data.country_code || null;
  } catch (error) {
    console.error('Exception fetching user country:', error);
    return null;
  }
}

/**
 * Convert a country code to its full name
 * 
 * @param countryCode The ISO country code
 * @returns The full country name or null if not found
 */
function getCountryNameFromCode(countryCode: string): string | null {
  const countryMap: Record<string, string> = {
    'US': 'united states',
    'GB': 'united kingdom',
    'CA': 'canada',
    'AU': 'australia',
    'DE': 'germany',
    'FR': 'france',
    'IT': 'italy',
    'ES': 'spain',
    'JP': 'japan',
    'CN': 'china',
    'IN': 'india',
    'NG': 'nigeria',
    'GH': 'ghana',
    'ZA': 'south africa',
    'KE': 'kenya',
    'MX': 'mexico',
    'NL': 'netherlands',
    'BE': 'belgium',
    'PT': 'portugal',
    'IE': 'ireland',
    'GR': 'greece',
    'SE': 'sweden',
    'DK': 'denmark',
    'FI': 'finland',
    'NO': 'norway',
    'CH': 'switzerland',
    'AT': 'austria',
    'EG': 'egypt',
    'MA': 'morocco',
    'TZ': 'tanzania',
    'ET': 'ethiopia',
    'KR': 'south korea',
    'SG': 'singapore',
    'MY': 'malaysia',
    'ID': 'indonesia',
    'TH': 'thailand',
    'VN': 'vietnam',
    'PH': 'philippines',
    'NZ': 'new zealand',
  };
  
  return countryMap[countryCode] || null;
} 