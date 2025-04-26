-- Create the stripe_customers table
CREATE TABLE IF NOT EXISTS stripe_customers (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id uuid REFERENCES auth.users(id) NOT NULL,
  stripe_customer_id text NOT NULL,
  email text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies
ALTER TABLE stripe_customers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own stripe customer data."
  ON stripe_customers FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Only system can insert stripe customer data."
  ON stripe_customers FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Add payments table if it doesn't exist
CREATE TABLE IF NOT EXISTS payments (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  booking_id uuid NOT NULL,
  service_id uuid NOT NULL,
  customer_id uuid REFERENCES auth.users(id) NOT NULL,
  provider_id uuid REFERENCES auth.users(id) NOT NULL,
  payment_provider text NOT NULL,
  payment_id text NOT NULL,
  status text NOT NULL,
  amount decimal(10, 2) NOT NULL,
  currency text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Add RLS policies for payments
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own payments as customer or provider."
  ON payments FOR SELECT
  USING (auth.uid() = customer_id OR auth.uid() = provider_id);

CREATE POLICY "System can insert payment data."
  ON payments FOR INSERT
  WITH CHECK (auth.uid() = customer_id OR auth.uid() = provider_id); 