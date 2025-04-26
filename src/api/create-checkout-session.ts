import { supabase } from "@/integrations/supabase/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

export async function POST(req: Request) {
  try {
    const data = await req.json();
    
    // Extract parameters
    const {
      booking_id,
      service_id,
      customer_id,
      provider_id,
      amount,
      success_url,
      cancel_url
    } = data;

    // Validate required parameters
    if (!booking_id || !service_id || !customer_id || !provider_id || !amount) {
      return new Response(
        JSON.stringify({ error: "Missing required parameters" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Get booking and service details
    const { data: booking } = await supabase
      .from("bookings")
      .select("*")
      .eq("id", booking_id)
      .single();

    const { data: service } = await supabase
      .from("services")
      .select("title")
      .eq("id", service_id)
      .single();

    if (!booking || !service) {
      return new Response(
        JSON.stringify({ error: "Booking or service not found" }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Check if the customer has a Stripe customer ID
    const { data: stripeCustomer } = await supabase
      .from("stripe_customers")
      .select("stripe_customer_id")
      .eq("user_id", customer_id)
      .single();

    let stripeCustomerId;
    
    if (stripeCustomer) {
      stripeCustomerId = stripeCustomer.stripe_customer_id;
    } else {
      // Get user email
      const { data: user } = await supabase
        .from("profiles")
        .select("email")
        .eq("id", customer_id)
        .single();

      // Create a new Stripe customer
      const newCustomer = await stripe.customers.create({
        email: user?.email || "",
        metadata: {
          supabase_id: customer_id
        }
      });

      stripeCustomerId = newCustomer.id;

      // Save the Stripe customer ID to database
      await supabase
        .from("stripe_customers")
        .insert({
          user_id: customer_id,
          stripe_customer_id: stripeCustomerId,
          email: user?.email || ""
        });
    }

    // Calculate amounts
    const amountInCents = Math.round(parseFloat(amount) * 100);

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      customer: stripeCustomerId,
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: {
              name: service.title,
              description: `Booking ID: ${booking_id}`,
            },
            unit_amount: amountInCents,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: success_url || `${process.env.SITE_URL}/payment/${booking_id}?payment_status=success`,
      cancel_url: cancel_url || `${process.env.SITE_URL}/payment/${booking_id}?payment_status=canceled`,
      metadata: {
        booking_id,
        service_id,
        customer_id,
        provider_id,
      },
    });

    // Return session data for client-side redirection
    return new Response(
      JSON.stringify({
        sessionId: session.id,
        url: session.url,
      }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error creating checkout session:", error);
    return new Response(
      JSON.stringify({ error: "Failed to create checkout session" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
} 