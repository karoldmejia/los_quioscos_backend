import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { DeliveryStatus } from '../../enums/delivery-status.enum';
import { IDeliveryRepository } from '../idelivery.repository';
import { Delivery } from '../../entities/delivery.entity';

@Injectable()
export class DeliveryRepository extends IDeliveryRepository {

    constructor(
        @InjectRepository(Delivery)
        private readonly repo: Repository<Delivery>,
    ) {
        super();
    }

    async create(delivery: Partial<Delivery>): Promise<Delivery> {
        const newDelivery = this.repo.create({
            ...delivery,
            status: DeliveryStatus.SCHEDULED
        });
        return await this.repo.save(newDelivery);
    }

    async createMany(schedules: Partial<Delivery>[]): Promise<Delivery[]> {
        const newDeliveries = this.repo.create(
            schedules.map(s => ({
                ...s,
                status: DeliveryStatus.SCHEDULED
            }))
        );
        return await this.repo.save(newDeliveries);
    }

    async findById(deliveryId: string): Promise<Delivery | null> {
        return await this.repo.findOne({
            where: { delivery_id: deliveryId }
        });
    }

    async findByContractId(contractId: string): Promise<Delivery[]> {
        return await this.repo.find({
            where: { contract_id: contractId },
            order: { scheduled_delivery_date: 'ASC' }
        });
    }

    async findDeliveriesForDateRange(contractId: string, startDate: Date, endDate: Date): Promise<Delivery[]> {
        return await this.repo.find({
            where: {
                contract_id: contractId,
                scheduled_delivery_date: Between(startDate, endDate)
            },
            order: { scheduled_delivery_date: 'ASC' }
        });
    }

    async findDeliveriesByDate(date: Date): Promise<Delivery[]> {
        const startOfDay = new Date(date);
        startOfDay.setHours(0, 0, 0, 0);

        const endOfDay = new Date(date);
        endOfDay.setHours(23, 59, 59, 999);

        return await this.repo.find({
            where: {
                scheduled_delivery_date: Between(startOfDay, endOfDay)
            },
            relations: ['contract']
        });
    }

    async findDeliveriesForOrderGeneration(changeDeadlineDays: number): Promise<Delivery[]> {
        const today = new Date();
        const deadlineDate = new Date();
        deadlineDate.setDate(today.getDate() + changeDeadlineDays);

        return await this.repo.find({
            where: {
                status: DeliveryStatus.SCHEDULED,
                scheduled_delivery_date: Between(today, deadlineDate)
            },
            relations: [
                'contract',
                'contract.contractItems',
                'contract.contractItems.product',
                'versions',
                'versions.items'
            ]
        });
    }

    async updateStatus(deliveryId: string, status: DeliveryStatus): Promise<void> {
        await this.repo.update(
            { delivery_id: deliveryId },
            {
                status,
                updated_at: new Date()
            }
        );
    }
}