-- Add preferred_currency column to profiles table
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS preferred_currency TEXT;

-- Add country column if it doesn't exist
ALTER TABLE IF EXISTS public.profiles 
ADD COLUMN IF NOT EXISTS country TEXT;

-- Create comment for the preferred_currency column
COMMENT ON COLUMN public.profiles.preferred_currency IS 'The user''s preferred currency for displaying prices. Defaults to USD or based on location.';

-- Create comment for the country column
COMMENT ON COLUMN public.profiles.country IS 'The user''s country in lowercase format (e.g., "united states", "nigeria").'; 