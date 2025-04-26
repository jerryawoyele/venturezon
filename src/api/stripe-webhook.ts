import { supabase } from "@/integrations/supabase/client";
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || "", {
  apiVersion: "2023-10-16",
});

// This is needed to access raw request body for Stripe webhook verification
async function readBuffer(readable: ReadableStream): Promise<Buffer> {
  const chunks: Uint8Array[] = [];
  const reader = readable.getReader();
  
  let done = false;
  while (!done) {
    const { value, done: isDone } = await reader.read();
    if (value) chunks.push(value);
    done = isDone;
  }
  
  return Buffer.concat(chunks);
}

export async function POST(req: Request) {
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { "Content-Type": "application/json" } }
    );
  }

  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    return new Response(
      JSON.stringify({ error: "Stripe webhook secret is not configured" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }

  try {
    // Get the raw body as a buffer
    const buf = await readBuffer(req.body!);
    const signature = req.headers.get("stripe-signature") as string;

    let event: Stripe.Event;
    
    // Verify the webhook signature
    try {
      event = stripe.webhooks.constructEvent(buf.toString(), signature, webhookSecret);
    } catch (err: any) {
      console.error(`Webhook signature verification failed: ${err.message}`);
      return new Response(
        JSON.stringify({ error: `Webhook Error: ${err.message}` }),
        { status: 400, headers: { "Content-Type": "application/json" } }
      );
    }

    // Handle the event
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        await handleCheckoutSessionCompleted(session);
        break;
      }
      case "payment_intent.succeeded": {
        const paymentIntent = event.data.object as Stripe.PaymentIntent;
        await handlePaymentIntentSucceeded(paymentIntent);
        break;
      }
      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return new Response(
      JSON.stringify({ received: true }),
      { status: 200, headers: { "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error processing webhook:", error);
    return new Response(
      JSON.stringify({ error: "Failed to process webhook" }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
}

async function handleCheckoutSessionCompleted(session: Stripe.Checkout.Session) {
  // Extract metadata from the session
  const { booking_id, service_id, customer_id, provider_id } = session.metadata || {};

  if (!booking_id || !service_id || !customer_id || !provider_id) {
    console.error("Missing required metadata in session:", session.id);
    return;
  }

  try {
    // Update booking status
    await supabase
      .from("bookings")
      .update({
        status: "pending",
        payment_status: "completed",
        payment_id: session.id,
        payment_provider: "stripe",
        updated_at: new Date().toISOString()
      })
      .eq("id", booking_id);

    // Create payment record
    await supabase
      .from("payments")
      .insert({
        booking_id,
        service_id,
        customer_id,
        provider_id,
        payment_provider: "stripe",
        payment_id: session.id,
        status: "completed",
        amount: session.amount_total ? session.amount_total / 100 : 0,
        currency: session.currency || "usd",
        created_at: new Date().toISOString()
      });

    console.log("Successfully processed checkout session:", session.id);
  } catch (error) {
    console.error("Error processing checkout session:", error);
  }
}

async function handlePaymentIntentSucceeded(paymentIntent: Stripe.PaymentIntent) {
  // This function can be used to handle payment_intent.succeeded events
  // if you need additional processing beyond the checkout.session.completed event
  
  console.log("Payment intent succeeded:", paymentIntent.id);
} 