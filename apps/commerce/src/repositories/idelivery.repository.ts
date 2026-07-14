import { DeliveryStatus } from "../enums/delivery-status.enum";
import { Delivery } from "../entities/delivery.entity";

export abstract class IDeliveryRepository {

    abstract create(schedule: Partial<Delivery>): Promise<Delivery>;
    abstract createMany(schedules: Partial<Delivery>[]): Promise<Delivery[]>;

    abstract findById(deliveryId: string): Promise<Delivery | null>;
    abstract findByContractId(contractId: string): Promise<Delivery[]>;

    abstract findDeliveriesByDate(date: Date): Promise<Delivery[]>;

    abstract findDeliveriesForDateRange(contractId: string, startDate: Date, endDate: Date): Promise<Delivery[]>;

    abstract findDeliveriesForOrderGeneration(changeDeadlineDays: number): Promise<Delivery[]>;

    abstract updateStatus(deliveryId: string, status: DeliveryStatus): Promise<void>;
}