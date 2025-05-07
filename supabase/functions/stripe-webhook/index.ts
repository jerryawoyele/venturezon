import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';
import { Stripe } from 'https://esm.sh/stripe@12.1.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://venturezon.com http://localhost:8080',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') || '', {
      apiVersion: '2023-10-16',
    });

    // Get the signature from the headers
    const signature = req.headers.get('stripe-signature');
    if (!signature) {
      return new Response(
        JSON.stringify({ error: 'Webhook signature missing' }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get the request body as text
    const body = await req.text();

    // Verify the webhook signature
    const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET') || '';
    let event;
    
    try {
      event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
    } catch (err) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(
        JSON.stringify({ error: `Webhook signature verification failed: ${err.message}` }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') || '';
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Handle the event
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      
      // Check if this is a promotion payment
      if (session.metadata?.postId && session.metadata?.userId && session.metadata?.promotionLevel) {
        // Extract promotion details from session metadata
        const {
          postId,
          userId,
          promotionLevel,
          startDate,
          endDate,
        } = session.metadata;

        // Insert the promotion into the database
        const { data: promotion, error } = await supabase
          .from('promoted_posts')
          .insert({
            post_id: postId,
            user_id: userId,
            promotion_level: promotionLevel,
            starts_at: startDate,
            ends_at: endDate,
            budget: session.amount_total ? session.amount_total / 100 : null,
            payment_id: session.payment_intent,
            created_at: new Date().toISOString(),
          })
          .select()
          .single();

        if (error) {
          console.error('Error creating promotion:', error);
          return new Response(
            JSON.stringify({ error: 'Failed to create promotion' }),
            {
              status: 500,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            }
          );
        }

        console.log('Promotion created successfully:', promotion);
        
        // Create a notification for the user
        await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            type: 'promotion_success',
            message: `Your ${promotionLevel} promotion for your post has been activated.`,
            is_read: false,
            created_at: new Date().toISOString(),
          });
      }
    }

    return new Response(
      JSON.stringify({ received: true }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  } catch (error) {
    console.error('Error processing webhook:', error);
    
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
}); 