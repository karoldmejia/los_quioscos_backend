import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { CheckoutService } from '../services/checkout-session.service';
import { CartToCheckoutDto } from '../dtos/cart-to-checkout.dto';
import { CheckoutSessionResponseDto } from '../dtos/checkout-session-response.dto';
import { CheckoutSession } from '../entities/checkout-session.entity';
import { Order } from '../entities/order.entity';

@Controller()
export class CheckoutController {
  constructor(private readonly checkoutService: CheckoutService) {}

  /**
   * Convert cart to checkout session with orders
   */
  @MessagePattern({ cmd: 'create_checkout_from_cart' })
  async createCheckoutFromCart(@Payload() dto: CartToCheckoutDto): Promise<CheckoutSessionResponseDto> {
    return await this.checkoutService.createCheckoutFromCart(dto);
  }

  /**
   * Process kiosk response for an order (accept/reject)
   */
  @MessagePattern({ cmd: 'process_kiosk_response' })
  async processKioskResponse(@Payload() payload: {orderId: string; kioskUserId: number; accept: boolean;}): Promise<Order> {
    const { orderId, kioskUserId, accept } = payload;
    return await this.checkoutService.processKioskResponse(orderId, kioskUserId, accept);
  }

  /**
   * Process payment success for checkout session
   */
  @MessagePattern({ cmd: 'process_payment_success' })
  async processPaymentSuccess(@Payload()payload: {checkoutSessionId: string;paymentInfo?: any;}): Promise<CheckoutSession> {
    const { checkoutSessionId, paymentInfo } = payload;
    return await this.checkoutService.processPaymentSuccess(checkoutSessionId, paymentInfo);
  }

  /**
   * Cancel entire checkout session
   */
  @MessagePattern({ cmd: 'cancel_checkout_session' })
  async cancelCheckoutSession(@Payload()payload: {checkoutSessionId: string;reason?: string;}): Promise<CheckoutSession> {
    const { checkoutSessionId, reason } = payload;
    return await this.checkoutService.cancelCheckoutSession(checkoutSessionId, reason);
  }

  /**
   * Get checkout session with complete details
   */
  @MessagePattern({ cmd: 'get_checkout_session_details' })
  async getCheckoutSessionDetails(@Payload() sessionId: string): Promise<CheckoutSession> {
    return await this.checkoutService.getCheckoutSessionDetails(sessionId);
  }

  /**
   * Get user's active checkout sessions
   */
  @MessagePattern({ cmd: 'get_user_active_sessions' })
  async getUserActiveSessions(@Payload() userId: string): Promise<CheckoutSession[]> {
    return await this.checkoutService.getUserActiveSessions(userId);
  }

  /**
   * Get user's completed checkout sessions
   */
  @MessagePattern({ cmd: 'get_user_completed_sessions' })
  async getUserCompletedSessions(@Payload() userId: string): Promise<CheckoutSession[]> {
    return await this.checkoutService.getUserCompletedSessions(userId);
  }

  /**
   * Process expired sessions (cron job endpoint)
   */
  @MessagePattern({ cmd: 'process_expired_sessions' })
  async processExpiredSessions(): Promise<{ processedCount: number }> {
    const processedCount = await this.checkoutService.processExpiredSessions();
    return { processedCount };
  }

  /**
   * Validate cart before checkout (pre-check endpoint)
   */
  @MessagePattern({ cmd: 'validate_cart_for_checkout' })
  async validateCartForCheckout(@Payload()payload: {cartId: string; userId: string;}): Promise<{ valid: boolean; errors?: string[] }> {
    try {
      const { cartId, userId } = payload;
      
      // Try to validate the cart
      await this.checkoutService['validateCart'](cartId, userId);
      
      // Additional validations can be added here
      
      return { valid: true };
    } catch (error: any) {
      return { 
        valid: false, 
        errors: [error.message || 'Validation failed'] 
      };
    }
  }

  /**
   * Get session status summary
   */
  @MessagePattern({ cmd: 'get_session_status_summary' })
  async getSessionStatusSummary(@Payload() sessionId: string): Promise<{sessionId: string; status: string; totalAmount: string; ordersCount: number; ordersByStatus: Record<string, number>;}> {
    const session = await this.checkoutService.getCheckoutSessionDetails(sessionId);
    
    const ordersByStatus: Record<string, number> = {};
    session.orders?.forEach(order => {
      const status = order.status;
      ordersByStatus[status] = (ordersByStatus[status] || 0) + 1;
    });
    
    return {
      sessionId: session.id,
      status: session.status,
      totalAmount: session.totalAmount || '0.00',
      ordersCount: session.orders?.length || 0,
      ordersByStatus
    };
  }

}