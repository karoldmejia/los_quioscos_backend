import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between } from 'typeorm';
import { IContractScheduleRepository } from '../icontract-schedule.repository';
import { ContractSchedule } from '../../entities/contract-schedule.entity';
import { ContractScheduleStatus } from '../../enums/contract-schedule-status.enum';

@Injectable()
export class ContractScheduleRepository extends IContractScheduleRepository {

    constructor(
        @InjectRepository(ContractSchedule)
        private readonly repo: Repository<ContractSchedule>,
    ) {
        super();
    }

    async create(schedule: Partial<ContractSchedule>): Promise<ContractSchedule> {
        const newSchedule = this.repo.create({
            ...schedule,
            status: ContractScheduleStatus.SCHEDULED
        });
        return await this.repo.save(newSchedule);
    }

    async createMany(schedules: Partial<ContractSchedule>[]): Promise<ContractSchedule[]> {
        const newSchedules = this.repo.create(
            schedules.map(s => ({
                ...s,
                status: ContractScheduleStatus.SCHEDULED
            }))
        );
        return await this.repo.save(newSchedules);
    }

    async findById(scheduleId: string): Promise<ContractSchedule | null> {
        return await this.repo.findOne({
            where: { contract_schedule_id: scheduleId }
        });
    }

    async findByContractId(contractId: string): Promise<ContractSchedule[]> {
        return await this.repo.find({
            where: { contract_id: contractId },
            order: { scheduled_delivery_date: 'ASC' }
        });
    }

    async findSchedulesForDateRange(contractId: string, startDate: Date, endDate: Date): Promise<ContractSchedule[]> {
        return await this.repo.find({
            where: {
                contract_id: contractId,
                scheduled_delivery_date: Between(startDate, endDate)
            },
            order: { scheduled_delivery_date: 'ASC' }
        });
    }

    async findSchedulesByDate(date: Date): Promise<ContractSchedule[]> {
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

    async findSchedulesForOrderGeneration(changeDeadlineDays: number): Promise<ContractSchedule[]> {
        const today = new Date();
        const deadlineDate = new Date();
        deadlineDate.setDate(today.getDate() + changeDeadlineDays);

        return await this.repo.find({
            where: {
                status: ContractScheduleStatus.SCHEDULED,
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

    async updateStatus(scheduleId: string, status: ContractScheduleStatus): Promise<void> {
        await this.repo.update(
            { contract_schedule_id: scheduleId },
            {
                status,
                updated_at: new Date()
            }
        );
    }
}