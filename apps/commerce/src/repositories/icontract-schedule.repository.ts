import { ContractScheduleStatus } from "../enums/contract-schedule-status.enum";
import { ContractSchedule } from "../entities/contract-schedule.entity";

export abstract class IContractScheduleRepository {

    abstract create(schedule: Partial<ContractSchedule>): Promise<ContractSchedule>;
    abstract createMany(schedules: Partial<ContractSchedule>[]): Promise<ContractSchedule[]>;

    abstract findById(scheduleId: string): Promise<ContractSchedule | null>;
    abstract findByContractId(contractId: string): Promise<ContractSchedule[]>;

    abstract findSchedulesByDate(date: Date): Promise<ContractSchedule[]>;

    abstract findSchedulesForDateRange(contractId: string, startDate: Date, endDate: Date): Promise<ContractSchedule[]>;

    abstract findSchedulesForOrderGeneration(changeDeadlineDays: number): Promise<ContractSchedule[]>;

    abstract updateStatus(scheduleId: string, status: ContractScheduleStatus): Promise<void>;
}