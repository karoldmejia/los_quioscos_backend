import { Injectable, Logger, Inject } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { CartRepository } from '../repositories/impl/cart.repository';
import { CheckoutSessionRepository } from '../repositories/impl/checkout-session.repository';
import { ProductRepository } from '../repositories/impl/product.repository';
import { OrderService } from './order.service';
import { Cart } from '../entities/cart.entity';
import { CheckoutSession } from '../entities/checkout-session.entity';
import { Order } from '../entities/order.entity';
import { CheckoutSessionStatus } from '../enums/checkout-session-status.enum';
import { OrderStatus } from '../enums/order-status.enum';
import { CartStatus } from '../enums/cart-status.enum';
import { CartToCheckoutDto } from '../dtos/cart-to-checkout.dto';
import { CheckoutSessionResponseDto } from '../dtos/checkout-session-response.dto';

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly SESSION_TIMEOUT_MINUTES = 30;
  private readonly KIOSK_RESPONSE_TIMEOUT_MINUTES = 10;

  constructor(
    private readonly cartRepository: CartRepository,
    private readonly checkoutSessionRepository: CheckoutSessionRepository,
    private readonly productRepository: ProductRepository,
    private readonly orderService: OrderService,
  ) { }

  /**
   * Convert cart to checkout session with orders
   */
  async createCheckoutFromCart(dto: CartToCheckoutDto): Promise<CheckoutSessionResponseDto> {
    this.logger.log(`Creating checkout from cart: ${dto.cartId} for user: ${dto.userId}`);

    // 1. Validate cart and items
    const cart = await this.validateCart(dto.cartId, dto.userId);

    // 2. Group items by kiosk with price snapshots
    const kioskGroups = await this.groupItemsByKioskWithPrices(cart);

    // 3. Create checkout session
    const checkoutSession = await this.createCheckoutSession(cart, dto);

    // 4. Create orders for each kiosk
    const orders = await this.createKioskOrders(checkoutSession, kioskGroups);

    // 5. Update cart status
    await this.updateCartAfterCheckout(cart.id);

    // 6. Calculate and update session total
    await this.calculateAndUpdateSessionTotal(checkoutSession.id);

    // 7. Reload session with total amount updated
    const updatedSession = await this.checkoutSessionRepository.findById(checkoutSession.id);

    this.logger.log(`Checkout session created: ${checkoutSession.id} with ${orders.length} orders`);

    return {
      session: updatedSession,
      orders
    };
  }


  /**
   * Validate cart before checkout
   */
  private async validateCart(cartId: string, userId: string): Promise<Cart> {
    const cart = await this.cartRepository.findByIdWithItems(cartId);

    if (!cart) {
      throw new RpcException('Cart not found');
    }

    if (cart.userId !== userId) {
      throw new RpcException('Cart does not belong to user');
    }

    if (cart.status !== 'ACTIVE') {
      throw new RpcException('Cart is not active');
    }

    if (!cart.items || cart.items.length === 0) {
      throw new RpcException('Cart is empty');
    }

    // Validate stock for all items
    for (const item of cart.items) {


      const product = await this.productRepository.findById(item.productId);
      if (!product || !product.active) {
        throw new RpcException(`Product ${item.productId} is not available`);
      }
    }

    return cart;
  }

  /**
   * Group cart items by kiosk with current prices (snapshots)
   */
  private async groupItemsByKioskWithPrices(cart: Cart): Promise<Map<number, Array<{ productId: string; quantity: number; unitPrice: string; totalPrice: string; productSnapshot: any; }>>> {
    const groups = new Map<number, Array<{ productId: string; quantity: number; unitPrice: string; totalPrice: string; productSnapshot: any; }>>();

    for (const item of cart.items) {
      const product = await this.productRepository.findById(item.productId);
      if (!product) {
        throw new RpcException(`Product ${item.productId} not found`);
      }

      const kioskId = product.kioskUserId;
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * item.quantity;

      const itemData = {
        productId: item.productId,
        quantity: item.quantity,
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
        productSnapshot: {
          name: product.name,
          description: product.description,
          price: product.price,
          kioskUserId: product.kioskUserId,
        }
      };

      if (!groups.has(kioskId)) {
        groups.set(kioskId, []);
      }

      groups.get(kioskId)!.push(itemData);
    }

    return groups;
  }

  /**
   * Create checkout session
   */
  private async createCheckoutSession(cart: Cart, dto: CartToCheckoutDto): Promise<CheckoutSession> {
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.SESSION_TIMEOUT_MINUTES);

    const sessionData = {
      userId: cart.userId,
      cartId: cart.id,
      totalAmount: '0.00', // Will be updated after orders creation
      status: CheckoutSessionStatus.PENDING,
      expiresAt,
    };

    return await this.checkoutSessionRepository.create(sessionData);
  }

  /**
   * Create orders for each kiosk
   */
  private async createKioskOrders(checkoutSession: CheckoutSession, kioskGroups: Map<number, Array<any>>): Promise<Order[]> {
    const orders: Order[] = [];
    for (const [kioskId, items] of kioskGroups) {
      // Calculate subtotal for this kiosk
      const subtotal = items.reduce((sum, item) => sum + parseFloat(item.totalPrice), 0);

      const order = await this.orderService.createOrderWithItemsAndReserveStock({
        orderData: {
          checkoutSessionId: checkoutSession.id,
          userId: checkoutSession.userId,
          kioskUserId: kioskId,
          subtotalProducts: subtotal.toFixed(2),
          status: OrderStatus.PENDING_KIOSK_CONFIRMATION,
          expiresAt: new Date(Date.now() + this.KIOSK_RESPONSE_TIMEOUT_MINUTES * 60000),
        },
        itemsData: items.map(item => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          totalPrice: item.totalPrice,
          productSnapshot: item.productSnapshot,
        })),
        expiresInMinutes: this.SESSION_TIMEOUT_MINUTES,
      });

      orders.push(order);
    }
    return orders;
  }

  /**
   * Update cart after successful checkout creation
   */
  private async updateCartAfterCheckout(cartId: string): Promise<void> {
    await this.cartRepository.updateStatus(cartId, CartStatus.CHECKOUT);
  }

  /**
   * Calculate and update session total from all orders
   */
  private async calculateAndUpdateSessionTotal(sessionId: string): Promise<void> {
    const session = await this.checkoutSessionRepository.findByIdWithOrders(sessionId);
    if (!session || !session.orders) return;

    const total = session.orders.reduce((sum, order) => {
      return sum + parseFloat(order.subtotalProducts || '0');
    }, 0);

    await this.checkoutSessionRepository.updateTotalAmount(sessionId, total.toFixed(2));
  }

  /**
   * Process kiosk response for an order
   */
  async processKioskResponse(orderId: string, kioskUserId: number, accept: boolean): Promise<Order> {
    const order = await this.orderService.getOrderById(orderId);

    if (!order) {
      throw new RpcException('Order not found');
    }
    if (order.kioskUserId !== kioskUserId) {
      throw new RpcException('Order does not belong to kiosk');
    }
    if (accept) {
      return await this.orderService.acceptOrder(orderId);
    } else {
      return await this.orderService.rejectOrder(orderId);
    }
  }

  /**
   * Process payment success for checkout session
   */
  async processPaymentSuccess(checkoutSessionId: string, paymentInfo: any): Promise<CheckoutSession> {
    const session = await this.checkoutSessionRepository.findByIdWithOrders(checkoutSessionId);

    if (!session) {
      throw new RpcException('Checkout session not found');
    }

    // Verify all orders are accepted
    for (const order of session.orders) {
      if (order.status !== OrderStatus.ACCEPTED) {
        throw new RpcException(
          `Order ${order.id} is not accepted. Current status: ${order.status}`
        );
      }

      // Mark each order as paid
      await this.orderService.markOrderAsPaid(order.id, paymentInfo);
    }

    // Update session status
    session.status = CheckoutSessionStatus.COMPLETED;
    session.updatedAt = new Date();

    return await this.checkoutSessionRepository.save(session);
  }

  /**
   * Cancel entire checkout session
   */
  async cancelCheckoutSession(checkoutSessionId: string, reason?: string): Promise<CheckoutSession> {
    const session = await this.checkoutSessionRepository.findByIdWithOrders(checkoutSessionId);

    if (!session) {
      throw new RpcException('Checkout session not found');
    }

    // Cancel all orders in the session
    for (const order of session.orders) {
      if ([
        OrderStatus.PENDING_KIOSK_CONFIRMATION,
        OrderStatus.ACCEPTED,
        OrderStatus.READY_FOR_PAYMENT
      ].includes(order.status)) {
        await this.orderService.cancellationRequested(order.id);
      }
    }

    // Update session status
    session.status = CheckoutSessionStatus.CANCELLED;
    session.updatedAt = new Date();

    this.logger.log(`Checkout session ${checkoutSessionId} cancelled. Reason: ${reason || 'No reason provided'}`);

    return await this.checkoutSessionRepository.save(session);
  }

  /**
   * Get checkout session with complete details
   */
  async getCheckoutSessionDetails(sessionId: string): Promise<CheckoutSession> {
    const session = await this.checkoutSessionRepository.findSessionWithCompleteData(sessionId);

    if (!session) {
      throw new RpcException('Checkout session not found');
    }

    return session;
  }

  /**
   * Process expired sessions
   */
  async processExpiredSessions(): Promise<number> {
    const thresholdDate = new Date();
    const expiredSessions = await this.checkoutSessionRepository.findExpiredSessions(thresholdDate);
    let processedCount = 0;

    for (const session of expiredSessions) {
      try {
        await this.checkoutSessionRepository.executeInTransaction(async () => {
          // Cancel all orders in expired session
          for (const order of session.orders) {
            if (order.status === OrderStatus.PENDING_KIOSK_CONFIRMATION) {
              await this.orderService.autoRejectTimeout(order.id);
            }
          }

          // Mark session as expired
          session.status = CheckoutSessionStatus.EXPIRED;
          session.updatedAt = new Date();
          await this.checkoutSessionRepository.save(session);

          processedCount++;
        });
      } catch (error) {
        this.logger.error(`Error processing expired session ${session.id}:`, error);
      }
    }

    if (processedCount > 0) {
      this.logger.log(`${processedCount} checkout sessions marked as expired`);
    }

    return processedCount;
  }

  /**
   * Get user's active checkout sessions
   */
  async getUserActiveSessions(userId: string): Promise<CheckoutSession[]> {
    const activeStatuses = [
      CheckoutSessionStatus.PENDING,
      CheckoutSessionStatus.PROCESSING
    ];

    const sessions = await this.checkoutSessionRepository.findByUserId(userId);
    return sessions.filter(session => activeStatuses.includes(session.status));
  }

  /**
   * Get user's completed checkout sessions
   */
  async getUserCompletedSessions(userId: string): Promise<CheckoutSession[]> {
    const completedStatuses = [
      CheckoutSessionStatus.COMPLETED,
      CheckoutSessionStatus.CANCELLED,
      CheckoutSessionStatus.EXPIRED,
      CheckoutSessionStatus.FAILED
    ];

    const sessions = await this.checkoutSessionRepository.findByUserId(userId);
    return sessions.filter(session => completedStatuses.includes(session.status));
  }
}