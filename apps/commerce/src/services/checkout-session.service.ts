/*
import { Injectable, Logger, Inject } from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { CartRepository } from '../repositories/impl/cart.repository';
import { CheckoutSessionRepository } from '../repositories/impl/checkout-session.repository';
import { ProductRepository } from '../repositories/impl/product.repository';
import { OrderRepository } from '../repositories/impl/order.repository';
import { BatchRepository } from '../repositories/impl/batch.repository';
import { Cart } from '../entities/cart.entity';
import { CheckoutSession } from '../entities/checkout-session.entity';
import { Order } from '../entities/order.entity';
import { OrderItem } from '../entities/order-item.entity';
import { CheckoutSessionStatus } from '../enums/checkout-session-status.enum';
import { OrderStatus } from '../enums/order-status.enum';
import { ReservationStatus } from '../enums/reservation-status.enum';
import { CartItem } from 'src/entities/cart-item.entity';

interface CartToCheckoutDto {
  userId: string;
  cartId: string;
  shippingInfo?: any;
  paymentMethod?: string;
}

@Injectable()
export class CheckoutService {
  private readonly logger = new Logger(CheckoutService.name);
  private readonly RESERVATION_TIMEOUT_MINUTES = 15;
  private readonly KIOSK_RESPONSE_TIMEOUT_MINUTES = 10;
  private readonly PAYMENT_TIMEOUT_MINUTES = 20;

  constructor(
    private readonly cartRepository: CartRepository,
    private readonly checkoutSessionRepository: CheckoutSessionRepository,
    private readonly orderRepository: OrderRepository,
    private readonly orderItemService: OrderService,
    private readonly productRepository: ProductRepository,
    private readonly batchRepository: BatchRepository,
    private readonly batchReservationRepository: BatchReservationRepository,
  ) {}

  // conversion from cart to checkout

  async createCheckoutFromCart(dto: CartToCheckoutDto): Promise<CheckoutSession> {
    this.logger.log(`Creating checkout from cart: ${dto.cartId} for user: ${dto.userId}`);

    // validate and obtain cart
    const cart = await this.validateCart(dto.cartId, dto.userId);
    
    // group items by kiosk
    const itemsByKiosk = await this.groupItemsByKiosk(cart);
    
    // create checkout session
    const checkoutSession = await this.createCheckoutSession(cart, dto);
    
    // create kiosks orders and reserve stock
    await this.createOrdersAndReserveStock(checkoutSession, itemsByKiosk);
    
    // update cart after checko
    await this.updateCartAfterCheckout(cart.id);
    
¿    // calculate and update checkout total
    await this.calculateAndUpdateTotal(checkoutSession.id);
    
    // notify kiosks
    // await this.notifyKiosks(checkoutSession.id);
    
    this.logger.log(`Checkout succesfully created: ${checkoutSession.id}`);
    return checkoutSession;
  }

  private async validateCart(cartId: string, userId: string): Promise<Cart> {
    // verify that the cart exists and belongs to user
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
    
    // validate stock for all items
    for (const item of cart.items) {
      const availableStock = await this.getProductAvailableStock(item.productId);
      if (item.quantity > availableStock) {
        throw new RpcException(
          `Insufficient stock for product ${item.productId}. Available: ${availableStock}, Requested: ${item.quantity}`
        );
      }
      
      // 3. Verificar que el producto esté activo
      const product = await this.productRepository.findById(item.productId);
      if (!product || !product.active) {
        throw new RpcException(`Product ${item.productId} is not available`);
      }
    }
    
    return cart;
  }

  // group products by kiosk
  private async groupItemsByKiosk(cart: Cart): Promise<Map<number, CartItem[]>> {
    const itemsByKiosk = new Map<number, CartItem[]>();
    
    for (const item of cart.items) {
      const product = await this.productRepository.findById(item.productId);
      if (!product) {
        throw new RpcException(`Product ${item.productId} not found`);
      }
      
      const kioskId = product.kioskUserId;
      if (!itemsByKiosk.has(kioskId)) {
        itemsByKiosk.set(kioskId, []);
      }
      
      itemsByKiosk.get(kioskId)!.push(item);
    }
    
    return itemsByKiosk;
  }

  private async createCheckoutSession(
    cart: Cart,
    dto: CartToCheckoutDto
  ): Promise<CheckoutSession> {
    // Calcular fecha de expiración (15 minutos para reserva inicial)
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + this.RESERVATION_TIMEOUT_MINUTES);
    
    const sessionData = {
      userId: cart.userId,
      cartId: cart.id,
      totalAmount: '0.00', // Se actualizará después
      status: CheckoutSessionStatus.PENDING,
      expiresAt,
    };
    
    return await this.checkoutSessionRepository.create(sessionData);
  }

  private async createOrdersAndReserveStock(
    checkoutSession: CheckoutSession,
    itemsByKiosk: Map<number, CartItem[]>
  ): Promise<void> {
    // Usar transacción para asegurar consistencia
    await this.checkoutSessionRepository.executeInTransaction(async () => {
      for (const [kioskId, items] of itemsByKiosk) {
        // Crear orden para este quiosco
        const order = await this.createOrderForKiosk(
          checkoutSession,
          kioskId,
          items
        );
        
        // Crear items de la orden y reservar stock
        await this.createOrderItemsAndReservations(order, items);
      }
    });
  }

  private async createOrderForKiosk(
    checkoutSession: CheckoutSession,
    kioskId: number,
    items: CartItem[]
  ): Promise<Order> {
    // Calcular subtotal para esta orden
    let subtotal = 0;
    for (const item of items) {
      const product = await this.productRepository.findById(item.productId);
      if (product) {
        subtotal += parseFloat(product.price) * item.quantity;
      }
    }
    
    // Calcular fecha de expiración para respuesta del quiosco
    const kioskExpiresAt = new Date();
    kioskExpiresAt.setMinutes(
      kioskExpiresAt.getMinutes() + this.KIOSK_RESPONSE_TIMEOUT_MINUTES
    );
    
    const orderData = {
      checkoutSessionId: checkoutSession.id,
      userId: checkoutSession.userId,
      kioskUserId: kioskId,
      status: OrderStatus.PENDING_KIOSK_CONFIRMATION,
      subtotalProducts: subtotal.toFixed(2),
      expiresAt: kioskExpiresAt,
    };
    
    return await this.orderRepository.create(orderData);
  }

  private async createOrderItemsAndReservations(
    order: Order,
    cartItems: CartItem[]
  ): Promise<void> {
    const reservationExpiresAt = new Date();
    reservationExpiresAt.setMinutes(
      reservationExpiresAt.getMinutes() + this.RESERVATION_TIMEOUT_MINUTES
    );
    
    for (const cartItem of cartItems) {
      const product = await this.productRepository.findById(cartItem.productId);
      if (!product) continue;
      
      // Crear OrderItem
      const unitPrice = parseFloat(product.price);
      const totalPrice = unitPrice * cartItem.quantity;
      
      const orderItem = await this.orderItemRepository.create({
        orderId: order.id,
        productId: cartItem.productId,
        quantity: cartItem.quantity,
        unitPrice: unitPrice.toFixed(2),
        totalPrice: totalPrice.toFixed(2),
      });
      
      // Reservar stock para este OrderItem
      await this.reserveStockForOrderItem(
        orderItem,
        product,
        reservationExpiresAt
      );
    }
  }

  private async reserveStockForOrderItem(
    orderItem: OrderItem,
    product: any, // Product entity
    expiresAt: Date
  ): Promise<void> {
    let remainingQuantity = orderItem.quantity;
    
    // Obtener lotes activos ordenados por fecha de expiración (FEFO)
    const batches = await this.batchRepository.findActiveByProductId(product.id);
    
    for (const batch of batches) {
      if (remainingQuantity <= 0) break;
      
      // Calcular cantidad disponible en este lote
      const availableInBatch = batch.currentQuantity - batch.reservedQuantity;
      
      if (availableInBatch <= 0) continue;
      
      // Cantidad a reservar de este lote
      const quantityToReserve = Math.min(remainingQuantity, availableInBatch);
      
      // Crear reserva
      await this.batchReservationRepository.create({
        batchId: batch.id,
        productId: product.id,
        orderId: orderItem.orderId,
        orderItemId: orderItem.id,
        kioskUserId: product.kioskUserId,
        quantity: quantityToReserve,
        status: ReservationStatus.ACTIVE,
        expiresAt,
      });
      
      // Actualizar cantidad reservada en el lote
      await this.batchRepository.updateReservedQuantity(
        batch.id,
        batch.reservedQuantity + quantityToReserve
      );
      
      remainingQuantity -= quantityToReserve;
    }
    
    // Si no se pudo reservar todo el stock
    if (remainingQuantity > 0) {
      throw new RpcException(
        `Insufficient stock for product ${product.id}. Could only reserve ${orderItem.quantity - remainingQuantity} of ${orderItem.quantity}`
      );
    }
  }

  private async updateCartAfterCheckout(cartId: string): Promise<void> {
    await this.cartRepository.updateStatus(cartId, 'CONVERTED_TO_CHECKOUT');
  }

  private async calculateAndUpdateTotal(checkoutSessionId: string): Promise<void> {
    const orders = await this.orderRepository.findByCheckoutSessionId(checkoutSessionId);
    
    let total = 0;
    for (const order of orders) {
      total += parseFloat(order.subtotalProducts);
    }
    
    await this.checkoutSessionRepository.updateTotalAmount(
      checkoutSessionId,
      total.toFixed(2)
    );
  }


  // get real stock from whole stock
  private async getProductAvailableStock(productId: string): Promise<number> {
    const batches = await this.batchRepository.findActiveByProductId(productId);
    return batches.reduce((total, batch) => {
      return total + (batch.currentQuantity - batch.reservedQuantity);
    }, 0);
  }

  // ==================== GESTIÓN DE RESPUESTAS DE QUIOSCO ====================

  async kioskAcceptOrder(orderId: string, kioskUserId: number): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order) {
      throw new RpcException('Order not found');
    }
    
    if (order.kioskUserId !== kioskUserId) {
      throw new RpcException('Order does not belong to this kiosk');
    }
    
    if (order.status !== OrderStatus.PENDING_KIOSK_CONFIRMATION) {
      throw new RpcException(`Order cannot be accepted in status: ${order.status}`);
    }
    
    // Actualizar fecha de expiración de las reservas (15 minutos más)
    const newExpiration = new Date();
    newExpiration.setMinutes(
      newExpiration.getMinutes() + this.PAYMENT_TIMEOUT_MINUTES
    );
    
    await this.batchReservationRepository.extendReservationsForOrder(
      orderId,
      newExpiration
    );
    
    // Actualizar estado de la orden
    order.status = OrderStatus.ACCEPTED;
    order.acceptedAt = new Date();
    order.expiresAt = newExpiration;
    
    return await this.orderRepository.save(order);
  }


  async kioskRejectOrder(orderId: string, kioskUserId: number): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order) {
      throw new RpcException('Order not found');
    }
    
    if (order.kioskUserId !== kioskUserId) {
      throw new RpcException('Order does not belong to this kiosk');
    }
    
    if (order.status !== OrderStatus.PENDING_KIOSK_CONFIRMATION) {
      throw new RpcException(`Order cannot be rejected in status: ${order.status}`);
    }
    
    // Liberar reservas
    await this.releaseOrderReservations(orderId);
    
    // Actualizar estado de la orden
    order.status = OrderStatus.REJECTED;
    order.rejectedAt = new Date();
    
    return await this.orderRepository.save(order);
  }

  private async releaseOrderReservations(orderId: string): Promise<void> {
    await this.batchReservationRepository.releaseReservationsForOrder(orderId);
  }

  // ==================== GESTIÓN DE PAGOS ====================

  async processPaymentSuccess(checkoutSessionId: string, paymentInfo: any): Promise<CheckoutSession> {
    const session = await this.checkoutSessionRepository.findByIdWithOrders(checkoutSessionId);
    
    if (!session) {
      throw new RpcException('Checkout session not found');
    }
    
    // Verificar que todas las órdenes están aceptadas
    for (const order of session.orders) {
      if (order.status !== OrderStatus.ACCEPTED) {
        throw new RpcException(
          `Order ${order.id} is not accepted. Current status: ${order.status}`
        );
      }
    }
    
    // Consumir reservas (convertir reservas en ventas reales)
    await this.consumeReservationsForSession(checkoutSessionId);
    
    // Actualizar estado de órdenes y sesión
    for (const order of session.orders) {
      order.status = OrderStatus.PAID;
      order.paidAt = new Date();
      order.paymentInfo = paymentInfo;
      await this.orderRepository.save(order);
    }
    
    session.status = CheckoutSessionStatus.COMPLETED;
    session.updatedAt = new Date();
    
    return await this.checkoutSessionRepository.save(session);
  }


  private async consumeReservationsForSession(checkoutSessionId: string): Promise<void> {
    const session = await this.checkoutSessionRepository.findByIdWithOrders(checkoutSessionId);
    if (!session) return;
    
    for (const order of session.orders) {
      await this.consumeReservationsForOrder(order.id);
    }
  }

  private async consumeReservationsForOrder(orderId: string): Promise<void> {
    const reservations = await this.batchReservationRepository.findActiveByOrderId(orderId);
    
    for (const reservation of reservations) {
      // Obtener el lote
      const batch = await this.batchRepository.findById(reservation.batchId);
      if (!batch) continue;
      
      // Actualizar cantidades del lote
      batch.currentQuantity -= reservation.quantity;
      batch.reservedQuantity -= reservation.quantity;
      await this.batchRepository.save(batch);
      
      // Marcar reserva como consumida
      reservation.status = ReservationStatus.CONSUMED;
      await this.batchReservationRepository.save(reservation);
    }
  }

  // ==================== GESTIÓN DE TIMEOUTS ====================
  async processExpiredOrders(): Promise<number> {
    const expiredOrders = await this.orderRepository.findExpiredPendingOrders();
    let processedCount = 0;
    
    for (const order of expiredOrders) {
      try {
        await this.orderRepository.executeInTransaction(async () => {
          // Liberar reservas
          await this.releaseOrderReservations(order.id);
          
          // Marcar orden como expirada
          order.status = OrderStatus.AUTO_REJECTED_TIMEOUT;
          order.updatedAt = new Date();
          await this.orderRepository.save(order);
          
          processedCount++;
        });
      } catch (error) {
        this.logger.error(`Error procesando orden expirada ${order.id}:`, error);
      }
    }
    
    if (processedCount > 0) {
      this.logger.log(`${processedCount} órdenes marcadas como expiradas por timeout`);
    }
    
    return processedCount;
  }

  async processExpiredReservations(): Promise<number> {
    const expiredReservations = await this.batchReservationRepository.findExpiredActiveReservations();
    let processedCount = 0;
    
    for (const reservation of expiredReservations) {
      try {
        // Liberar reserva
        reservation.status = ReservationStatus.EXPIRED;
        await this.batchReservationRepository.save(reservation);
        
        // Actualizar cantidad reservada en el lote
        const batch = await this.batchRepository.findById(reservation.batchId);
        if (batch) {
          batch.reservedQuantity -= reservation.quantity;
          await this.batchRepository.save(batch);
        }
        
        processedCount++;
      } catch (error) {
        this.logger.error(`Error procesando reserva expirada ${reservation.id}:`, error);
      }
    }
    
    if (processedCount > 0) {
      this.logger.log(`${processedCount} reservas marcadas como expiradas`);
    }
    
    return processedCount;
  }

  // ==================== CANCELACIONES ====================
  async cancelCheckoutSession(checkoutSessionId: string, reason?: string): Promise<CheckoutSession> {
    const session = await this.checkoutSessionRepository.findByIdWithOrders(checkoutSessionId);
    
    if (!session) {
      throw new RpcException('Checkout session not found');
    }
    
    // Liberar todas las reservas
    for (const order of session.orders) {
      await this.releaseOrderReservations(order.id);
    }
    
    // Actualizar estado de órdenes
    for (const order of session.orders) {
      if (order.status === OrderStatus.PAID) {
        order.status = OrderStatus.CANCELLED;
      } else {
        order.status = OrderStatus.CANCELLED;
      }
      await this.orderRepository.save(order);
    }
    
    // Actualizar estado de la sesión
    session.status = CheckoutSessionStatus.CANCELLED;
    session.updatedAt = new Date();
    
    this.logger.log(`Checkout session ${checkoutSessionId} cancelled. Reason: ${reason || 'No reason provided'}`);
    
    return await this.checkoutSessionRepository.save(session);
  }

  async requestOrderCancellation(orderId: string, reason: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    
    if (!order) {
      throw new RpcException('Order not found');
    }
    
    if (order.status !== OrderStatus.PAID) {
      throw new RpcException('Only paid orders can be cancelled');
    }
    
    // Marcar como solicitada cancelación
    // En un sistema real, esto iniciaría un flujo de aprobación
    order.status = OrderStatus.CANCEL_REQUESTED;
    order.updatedAt = new Date();
    
    this.logger.log(`Cancellation requested for order ${orderId}. Reason: ${reason}`);
    
    return await this.orderRepository.save(order);
  }
}
*/