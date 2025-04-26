import { supabase } from "@/integrations/supabase/client";

/**
 * Status options for escrow payments
 */
export enum EscrowStatus {
  PENDING = "pending",        // Initial payment has been made but held in escrow
  RELEASED = "released",      // Payment released to service provider
  REFUNDED = "refunded",      // Payment refunded to customer
  DISPUTED = "disputed",      // Payment is under dispute
  COMPLETED = "completed",    // Service completed and payment finalized
  CANCELED = "canceled"       // Booking canceled before service
}

/**
 * Payment gateway types
 */
export type PaymentGateway = 'stripe' | 'paystack' | 'external';

/**
 * Interface for escrow payment details
 */
export interface EscrowPayment {
  id?: string;
  booking_id: string;
  service_id: string;
  amount: number;
  platform_fee: number;
  total_amount: number;
  customer_id: string;
  provider_id: string;
  status: 'pending' | 'completed' | 'released' | 'refunded' | 'disputed';
  created_at?: string;
  updated_at?: string;
  payment_method?: string;
  payment_id?: string;
  is_external?: boolean;
  payment_gateway?: PaymentGateway;
  reference?: string; // For Paystack reference
}

/**
 * Service class for handling escrow payments
 */
export class EscrowService {
  // Platform fee percentage calculation
  static getPlatformFeePercentage(amount: number): number {
    if (amount >= 1000) return 1; // 1% for bookings >= $1000
    if (amount <= 50) return 8;   // 8% for bookings <= $50
    
    // For amounts between $50 and $1000, calculate a sliding scale
    // From 8% at $50 to 1% at $1000
    const percentage = 8 - ((amount - 50) / (1000 - 50)) * (8 - 1);
    return Math.round(percentage * 10) / 10; // Round to 1 decimal place
  }

  /**
   * Calculate platform fee for a given amount
   */
  static calculatePlatformFee(amount: number): number {
    const feePercentage = this.getPlatformFeePercentage(amount);
    return Math.round((amount * feePercentage / 100) * 100) / 100;
  }

  /**
   * Calculate total amount including platform fee
   */
  static calculateTotalAmount(amount: number): number {
    return Math.round((amount + this.calculatePlatformFee(amount)) * 100) / 100;
  }

  /**
   * Create a new escrow payment for a booking
   */
  static async createPayment(
    bookingId: string,
    amount: number,
    customerId: string,
    providerId: string,
    serviceId: string,
    isExternal: boolean = false,
    payment_id?: string,
    paymentGateway: PaymentGateway = 'stripe',
    reference?: string
  ): Promise<EscrowPayment | null> {
    try {
      const platformFee = this.calculatePlatformFee(amount);
      const totalAmount = this.calculateTotalAmount(amount);

      // Create a payment record
      const paymentData: any = {
        booking_id: bookingId,
        service_id: serviceId,
        amount,
        platform_fee: platformFee,
        total_amount: totalAmount,
        customer_id: customerId,
        provider_id: providerId,
        status: isExternal ? 'completed' : 'pending',
        payment_method: isExternal ? 'external' : 'card',
        is_external: isExternal,
        payment_id: payment_id // Store Stripe session ID if provided
      };
      
      // Only add these fields if they're provided to prevent schema errors
      if (paymentGateway) {
        paymentData.payment_gateway = paymentGateway;
      }
      
      if (reference) {
        paymentData.reference = reference;
      }

      const { data: payment, error } = await supabase
        .from('escrow_payments')
        .insert(paymentData)
        .select()
        .single();

      if (error) {
        console.error('Error creating escrow payment:', error);
        return null;
      }

      // Update booking status based on payment status
      await supabase
        .from('bookings')
        .update({
          payment_status: isExternal ? 'completed' : 'pending',
          status: isExternal ? 'confirmed' : 'pending'
        })
        .eq('id', bookingId);

      return payment;
    } catch (error) {
      console.error('Error in createPayment:', error);
      return null;
    }
  }
  
  /**
   * Process payment for an existing escrow record
   */
  static async processPayment(
    paymentId: string,
    paymentGateway?: PaymentGateway,
    transactionReference?: string
  ): Promise<boolean> {
    try {
      // Get current payment
      const { data: payment, error: fetchError } = await supabase
        .from('escrow_payments')
        .select('*, bookings(*)')
        .eq('id', paymentId)
        .single();

      if (fetchError || !payment) {
        console.error('Error fetching payment:', fetchError);
        return false;
      }

      // Update payment details
      const updateData: any = { 
        status: 'completed',
        updated_at: new Date().toISOString()
      };
      
      // Add payment gateway info if provided
      if (paymentGateway) {
        updateData.payment_gateway = paymentGateway;
      }
      
      // Add transaction reference if provided (for Paystack)
      if (transactionReference) {
        updateData.reference = transactionReference;
      }

      // Update payment status to completed
      const { error: updateError } = await supabase
        .from('escrow_payments')
        .update(updateData)
        .eq('id', paymentId);

      if (updateError) {
        console.error('Error updating payment status:', updateError);
        return false;
      }

      // Update booking payment status
      await supabase
        .from('bookings')
        .update({ payment_status: 'completed' })
        .eq('id', payment.booking_id);

      return true;
    } catch (error) {
      console.error('Error in processPayment:', error);
      return false;
    }
  }
  
  /**
   * Verify Paystack payment using reference
   */
  static async verifyPaystackPayment(reference: string): Promise<boolean> {
    try {
      // This would typically make a request to your backend, which would verify with Paystack API
      // For demo purposes, we'll just return true
      console.log(`Verifying Paystack payment with reference: ${reference}`);
      
      // In a real implementation, you would make an API call to verify the payment
      // const response = await fetch('/api/verify-paystack-payment', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify({ reference })
      // });
      // const result = await response.json();
      // return result.success;
      
      return true;
    } catch (error) {
      console.error('Error verifying Paystack payment:', error);
      return false;
    }
  }
  
  /**
   * Release payment to service provider after service completion
   */
  static async releasePayment(paymentId: string): Promise<boolean> {
    try {
      // Get current payment
      const { data: payment, error: fetchError } = await supabase
        .from('escrow_payments')
        .select('*, bookings(*)')
        .eq('id', paymentId)
        .single();

      if (fetchError || !payment) {
        console.error('Error fetching payment:', fetchError);
        return false;
      }

      // Only completed payments can be released
      if (payment.status !== 'completed') {
        console.error('Payment is not in completed status');
        return false;
      }

      // Update payment status to released
      const { error: updateError } = await supabase
        .from('escrow_payments')
        .update({ 
          status: 'released',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (updateError) {
        console.error('Error releasing payment:', updateError);
        return false;
      }

      // Update booking status to completed
      await supabase
        .from('bookings')
        .update({ 
          status: 'completed',
          payment_status: 'released'
        })
        .eq('id', payment.booking_id);

      // Notify the service provider
      await supabase
        .from('notifications')
        .insert({
          user_id: payment.provider_id,
          type: 'payment',
          title: 'Payment Released',
          message: 'Your payment has been released to your account.',
          is_read: false,
          data: JSON.stringify({
            payment_id: payment.id,
            booking_id: payment.booking_id,
            amount: payment.amount
          })
        });

      return true;
    } catch (error) {
      console.error('Error in releasePayment:', error);
      return false;
    }
  }
  
  /**
   * Refund payment to customer (e.g., if service provider cancels)
   */
  static async refundPayment(paymentId: string, reason: string): Promise<boolean> {
    try {
      // Get current payment
      const { data: payment, error: fetchError } = await supabase
        .from('escrow_payments')
        .select('*, bookings(*)')
        .eq('id', paymentId)
        .single();

      if (fetchError || !payment) {
        console.error('Error fetching payment:', fetchError);
        return false;
      }

      // Can only refund completed or pending payments
      if (payment.status !== 'completed' && payment.status !== 'pending') {
        console.error('Payment cannot be refunded in current status');
        return false;
      }

      // Update payment status to refunded
      const { error: updateError } = await supabase
        .from('escrow_payments')
        .update({ 
          status: 'refunded',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (updateError) {
        console.error('Error refunding payment:', updateError);
        return false;
      }

      // Update booking status to cancelled
      await supabase
        .from('bookings')
        .update({ 
          status: 'cancelled',
          payment_status: 'refunded',
          cancellation_reason: reason
        })
        .eq('id', payment.booking_id);

      // Notify the customer
      await supabase
        .from('notifications')
        .insert({
          user_id: payment.customer_id,
          type: 'payment',
          title: 'Payment Refunded',
          message: 'Your payment has been refunded.',
          is_read: false,
          data: JSON.stringify({
            payment_id: payment.id,
            booking_id: payment.booking_id,
            amount: payment.amount,
            reason: reason
          })
        });

      return true;
    } catch (error) {
      console.error('Error in refundPayment:', error);
      return false;
    }
  }
  
  /**
   * Create a dispute for a payment
   */
  static async createDispute(
    paymentId: string, 
    reason: string, 
    description: string,
    userId: string
  ): Promise<boolean> {
    try {
      // Get current payment
      const { data: payment, error: fetchError } = await supabase
        .from('escrow_payments')
        .select('*, bookings(*)')
        .eq('id', paymentId)
        .single();

      if (fetchError || !payment) {
        console.error('Error fetching payment:', fetchError);
        return false;
      }

      // Can only dispute completed payments
      if (payment.status !== 'completed') {
        console.error('Payment must be completed to dispute');
        return false;
      }

      // Update payment status to disputed
      const { error: updateError } = await supabase
        .from('escrow_payments')
        .update({ 
          status: 'disputed',
          updated_at: new Date().toISOString()
        })
        .eq('id', paymentId);

      if (updateError) {
        console.error('Error updating payment status to disputed:', updateError);
        return false;
      }

      // Create a dispute record
      const { error: disputeError } = await supabase
        .from('payment_disputes')
        .insert({
          payment_id: paymentId,
          booking_id: payment.booking_id,
          created_by: userId,
          reason,
          description,
          status: 'open',
          customer_id: payment.customer_id,
          provider_id: payment.provider_id
        });

      if (disputeError) {
        console.error('Error creating dispute record:', disputeError);
        return false;
      }

      // Update booking status to disputed
      await supabase
        .from('bookings')
        .update({ 
          status: 'disputed',
          payment_status: 'disputed'
        })
        .eq('id', payment.booking_id);

      // Notify the other party and admin
      const notifyUserId = userId === payment.customer_id 
        ? payment.provider_id 
        : payment.customer_id;

      await supabase
        .from('notifications')
        .insert([
          {
            user_id: notifyUserId,
            type: 'dispute',
            title: 'Payment Disputed',
            message: 'A dispute has been opened for a booking.',
            is_read: false,
            data: JSON.stringify({
              payment_id: payment.id,
              booking_id: payment.booking_id,
              dispute_reason: reason
            })
          },
          // Admin notification (assuming admin user ID or role-based notification)
          {
            user_id: 'admin', // Update with actual admin user ID or role
            type: 'dispute',
            title: 'New Payment Dispute',
            message: `A dispute has been opened for booking #${payment.booking_id}`,
            is_read: false,
            data: JSON.stringify({
              payment_id: payment.id,
              booking_id: payment.booking_id,
              customer_id: payment.customer_id,
              provider_id: payment.provider_id,
              dispute_reason: reason
            })
          }
        ]);

      return true;
    } catch (error) {
      console.error('Error in createDispute:', error);
      return false;
    }
  }
  
  /**
   * Get escrow payment details
   */
  static async getPaymentDetails(paymentId: string): Promise<EscrowPayment | null> {
    try {
      const { data, error } = await supabase
        .from('escrow_payments')
        .select('*')
        .eq('id', paymentId)
        .single();
      
      if (error) {
        console.error("Error fetching escrow payment:", error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error("Error in getPaymentDetails:", error);
      return null;
    }
  }
  
  /**
   * Get all escrow payments for a booking
   */
  static async getPaymentsByBooking(bookingId: string): Promise<EscrowPayment[] | null> {
    try {
      const { data, error } = await supabase
        .from('escrow_payments')
        .select('*')
        .eq('booking_id', bookingId);
      
      if (error) {
        console.error("Error fetching escrow payments:", error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error("Error in getPaymentsByBooking:", error);
      return null;
    }
  }
}

/**
 * SQL to create escrow_payments table:
 * 
 * CREATE TABLE IF NOT EXISTS escrow_payments (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
 *   amount DECIMAL(10, 2) NOT NULL,
 *   status VARCHAR(20) NOT NULL,
 *   customer_id UUID REFERENCES auth.users(id),
 *   provider_id UUID REFERENCES auth.users(id),
 *   service_id UUID REFERENCES services(id),
 *   transaction_id VARCHAR(100),
 *   release_date TIMESTAMP WITH TIME ZONE,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 * 
 * CREATE TABLE IF NOT EXISTS payment_disputes (
 *   id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
 *   payment_id UUID REFERENCES escrow_payments(id) ON DELETE CASCADE,
 *   booking_id UUID REFERENCES bookings(id) ON DELETE CASCADE,
 *   reason TEXT NOT NULL,
 *   evidence_url TEXT,
 *   status VARCHAR(20) NOT NULL,
 *   resolution TEXT,
 *   resolved_by UUID REFERENCES auth.users(id),
 *   resolved_at TIMESTAMP WITH TIME ZONE,
 *   created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
 *   updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
 * );
 */ 