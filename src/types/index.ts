export interface Profile {
  id: string;
  username: string | null;
  avatar_url: string | null;
  bio: string | null;
  updated_at: string | null;
  user_role?: 'business' | 'customer' | null;
  about_business?: string | null;
  business_name?: string | null;
  kyc_verified?: boolean;
  kyc_status?: string;
  followers_count?: number;
  following_count?: number;
  posts_count?: number;
  reviews_count?: number;
  reviews_rating?: number;
  country?: string;
  country_code?: string;
  preferred_currency?: string;
}

export interface Post {
  id: string;
  caption: string | null;
  image_url: string;
  created_at: string | null;
  updated_at: string | null;
  user_id: string | null;
  profiles?: Profile;
}

export interface PromotedPost {
  id: string;
  post_id: string;
  user_id: string;
  promotion_level: 'basic' | 'premium' | 'featured';
  starts_at: string;
  ends_at: string;
  target_audience?: string | null;
  budget?: number | null;
  impressions?: number;
  clicks?: number;
  created_at: string;
  post?: Post;
}

export interface Comment {
  id: string;
  content: string;
  created_at: string | null;
  post_id: string | null;
  user_id: string | null;
  profiles?: Profile;
}

export interface Like {
  id: string;
  post_id: string | null;
  user_id: string | null;
  created_at: string | null;
}

export interface ServiceType {
  id: string;
  owner_id: string;
  title: string;
  description: string;
  category: string;
  image: string;
  business?: string | null;
  price?: string | null;
  features?: string[] | null;
  created_at?: string | null;
  updated_at?: string | null;
}
