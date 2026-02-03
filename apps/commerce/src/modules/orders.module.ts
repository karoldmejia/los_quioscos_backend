import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { CartItem } from "../entities/cart-item.entity";
import { Cart } from "../entities/cart.entity";
import { CheckoutSession } from "../entities/checkout-session.entity";
import { BatchReservation } from "../entities/batch-reservation.entity";
import { OrderItem } from "../entities/order-item.entity";
import { Order } from "../entities/order.entity";
import { CartController } from "../controllers/cart.controller";
import { CartRepository } from "../repositories/impl/cart.repository";
import { CartItemRepository } from "../repositories/impl/cart-item.repository";
import { CartService } from "../services/cart.service";
import { ProductsModule } from "./products.module";
import { OrderController } from "../controllers/orders.controller";
import { OrderService } from "../services/order.service";
import { OrderRepository } from "../repositories/impl/order.repository";
import { OrderItemRepository } from "../repositories/impl/order-item.repository";
import { BatchReservationService } from "../services/reservation.service";
import { BatchReservationRepository } from "../repositories/impl/reservation.repository";
import { OrderMaintenanceService } from "../services/order-mainteinance.service";
import { CheckoutSessionRepository } from "../repositories/impl/checkout-session.repository";

@Module({
    imports: [
        TypeOrmModule.forFeature([Cart, CartItem, Order, OrderItem, CheckoutSession, BatchReservation]),
        ProductsModule
    ],
    controllers: [CartController, OrderController],
    providers: [
        CartRepository,
        CartItemRepository,
        CartService,
        OrderService,
        OrderRepository,
        OrderItemRepository,
        BatchReservationService,
        BatchReservationRepository,
        OrderMaintenanceService,
        CheckoutSessionRepository
    ],
    exports: [
        CartRepository,
        CartItemRepository,
        CartService,
        OrderService,
        OrderRepository,
        OrderItemRepository,
        BatchReservationService,
        BatchReservationRepository,
        OrderMaintenanceService
    ],
})
export class OrdersModule {}