import { Database } from '@supabase/supabase-js';

declare global {
  type Tables = Database['public']['Tables'];
  
  // Define the base profile type
  type ProfileRow = Tables['profiles']['Row'];
  
  // Extended Tables to include payment_methods
  interface ExtendedTables extends Tables {
    payment_methods: {
      Row: {
        id: string;
        user_id: string;
        payment_method_id: string;
        card_last4: string;
        card_brand: string;
        card_exp_month: number;
        card_exp_year: number;
        is_default: boolean;
        created_at: string;
        updated_at: string | null;
      };
      Insert: {
        id?: string;
        user_id: string;
        payment_method_id: string;
        card_last4: string;
        card_brand: string;
        card_exp_month: number;
        card_exp_year: number;
        is_default?: boolean;
        created_at?: string;
        updated_at?: string | null;
      };
      Update: {
        id?: string;
        user_id?: string;
        payment_method_id?: string;
        card_last4?: string;
        card_brand?: string;
        card_exp_month?: number;
        card_exp_year?: number;
        is_default?: boolean;
        created_at?: string;
        updated_at?: string | null;
      };
    };
  }
  
  // Extended profile types to include missing fields
  interface ExtendedProfile extends ProfileRow {
    user_role?: string;
    kyc_status?: string;
    email_notifications?: boolean;
    push_notifications?: boolean;
    marketing_emails?: boolean;
    profile_visibility?: string;
    activity_visibility?: string;
    business_name?: string;
    about_business?: string;
    bio?: string;
    kyc_verified?: boolean;
    kyc_rejection_reason?: string;
    country?: string;
    country_code?: string;
    preferred_currency?: string;
  }
  
  // Payment method type for easier use in components
  interface PaymentMethod {
    id: string;
    user_id: string;
    payment_method_id: string;
    card_last4: string;
    card_brand: string;
    card_exp_month: number;
    card_exp_year: number;
    is_default: boolean;
    created_at: string;
    updated_at?: string | null;
  }
}

export {}; 