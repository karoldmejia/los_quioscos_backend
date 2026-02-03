import { CheckoutSession } from "../entities/checkout-session.entity";
import { CheckoutSessionStatus } from "../enums/checkout-session-status.enum";
import { Order } from "../entities/order.entity";

export abstract class ICheckoutSessionRepository {
    // basic crud
    abstract create(session: Partial<CheckoutSession>): Promise<CheckoutSession>;
    abstract save(session: CheckoutSession): Promise<CheckoutSession>;
    abstract update(sessionId: string, data: Partial<CheckoutSession>): Promise<void>;
    abstract delete(sessionId: string): Promise<void>;
    
    // search
    abstract findById(sessionId: string): Promise<CheckoutSession | null>;
    abstract findByIdWithOrders(sessionId: string): Promise<CheckoutSession | null>;
    abstract findByUserId(userId: string): Promise<CheckoutSession[]>;
    abstract findByCartId(cartId: string): Promise<CheckoutSession | null>;
    abstract findByStatus(status: CheckoutSessionStatus): Promise<CheckoutSession[]>;
    abstract findExpiredSessions(thresholdDate: Date): Promise<CheckoutSession[]>;
    
    // specific search
    abstract findActiveByUserId(userId: string): Promise<CheckoutSession | null>;
    abstract findPendingByUserId(userId: string): Promise<CheckoutSession[]>;
    abstract findCompletedByUserId(userId: string): Promise<CheckoutSession[]>;
    
    // specific functions
    abstract updateStatus(sessionId: string, status: CheckoutSessionStatus): Promise<CheckoutSession>;
    abstract updateExpiration(sessionId: string, expiresAt: Date): Promise<void>;
    abstract updateTotalAmount(sessionId: string, totalAmount: string): Promise<void>;
    abstract addOrdersToSession(sessionId: string, orders: Order[]): Promise<void>;
    
    // timeout management
    abstract markExpiredSessions(thresholdDate: Date): Promise<number>;
    
    // relations with entities
    abstract findWithOrdersAndItems(sessionId: string): Promise<CheckoutSession | null>;
    abstract findSessionWithCompleteData(sessionId: string): Promise<CheckoutSession | null>;
    
    // count
    abstract countByStatus(status: CheckoutSessionStatus): Promise<number>;
    abstract countByUserId(userId: string): Promise<number>;
    
    // existence
    abstract existsActiveForUser(userId: string): Promise<boolean>;
    abstract existsForCart(cartId: string): Promise<boolean>;
    
    // kiosks methods
    abstract findSessionsByKioskUserId(kioskUserId: number): Promise<CheckoutSession[]>;
    abstract findPendingSessionsByKioskUserId(kioskUserId: number): Promise<CheckoutSession[]>;
}