-- Add currency_created_in field to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS currency_created_in VARCHAR(10) DEFAULT 'NGN';

-- Update existing services to set them to NGN since they were created in Nigeria
UPDATE services
SET currency_created_in = 'NGN'
WHERE currency_created_in IS NULL; 