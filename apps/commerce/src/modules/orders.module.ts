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

@Module({
    imports: [
        TypeOrmModule.forFeature([Cart, CartItem, Order, OrderItem, CheckoutSession, BatchReservation]),
        ProductsModule
    ],
    controllers: [CartController],
    providers: [
        CartRepository,
        CartItemRepository,
        CartService,
    ],
    exports: [
        CartRepository,
        CartItemRepository,
        CartService,
    ],
})
export class OrdersModule {}