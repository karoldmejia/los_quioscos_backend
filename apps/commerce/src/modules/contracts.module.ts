import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../entities/contract.entity';
import { ContractItem } from '../entities/contract-item.entity';
import { ContractVersion } from '../entities/contract-version.entity';
import { ContractSchedule } from '../entities/contract-schedule.entity';
import { ContractScheduleVersion } from '../entities/contract-schedule-version.entity';
import { ContractScheduleItem } from '../entities/contract-schedule-item.entity';
import { IContractRepository } from '../repositories/icontract.repository';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { IContractItemRepository } from '../repositories/icontract-item.repository';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { IContractVersionRepository } from '../repositories/icontract-version.repository';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';
import { IContractScheduleRepository } from '../repositories/icontract-schedule.repository';
import { ContractScheduleRepository } from '../repositories/impl/contract-schedule.repository';
import { IContractScheduleVersionRepository } from '../repositories/icontract-schedule-version.repository';
import { ContractScheduleVersionRepository } from '../repositories/impl/contract-schedule-version.repository';
import { IContractScheduleItemRepository } from '../repositories/icontract-schedule-item.repository';
import { ContractScheduleItemRepository } from '../repositories/impl/contract-schedule-item.repository';

@Module({
    imports: [
        TypeOrmModule.forFeature([
            Contract,
            ContractItem,
            ContractVersion,
            ContractSchedule,
            ContractScheduleVersion,
            ContractScheduleItem
        ])
    ],
    providers: [
        ContractRepository,
        ContractItemRepository,
        ContractVersionRepository,
        ContractScheduleRepository,
        ContractScheduleVersionRepository,
        ContractScheduleItemRepository
    ],
    exports: [
        IContractRepository,
        IContractItemRepository,
        IContractVersionRepository,
        IContractScheduleRepository,
        IContractScheduleVersionRepository,
        IContractScheduleItemRepository
    ]
})
export class ContractsModule { }