I'm ready to implement the real payment APi endpoints, how do i put it in my backend.
Also, I'm still getting the state persistence issu for navigation, where I'm seeing bookings before services as a business owner, and I'm still seeing the login before the logout tab comes on, once i log in, it is meant to be saved that i'm logged in, also i dont want to see the login modal when i'm already signed in


create table stripe_customers (
  id uuid default uuid_generate_v4() primary key,
  user_id uuid references auth.users(id) not null,
  stripe_customer_id text not null,
  email text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Add RLS policies
alter table stripe_customers enable row level security;

create policy "Users can view their own stripe customer data."
  on stripe_customers for select
  using (auth.uid() = user_id);

create policy "Only system can insert stripe customer data."
  on stripe_customers for insert
  with check (auth.uid() = user_id);






