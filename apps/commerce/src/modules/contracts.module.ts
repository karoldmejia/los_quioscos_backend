import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../entities/contract.entity';
import { ContractItem } from '../entities/contract-item.entity';
import { ContractVersion } from '../entities/contract-version.entity';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';
import { Delivery } from '../entities/delivery.entity';
import { DeliveryRepository } from '../repositories/impl/delivery.repository';
@Module({
    imports: [
        TypeOrmModule.forFeature([
            Contract,
            ContractItem,
            ContractVersion,
            Delivery,
            ContractVersion,
            ContractItem
        ])
    ],
    providers: [
        ContractRepository,
        ContractItemRepository,
        ContractVersionRepository,
        DeliveryRepository,
        ContractVersionRepository,
        ContractItemRepository
    ],
    exports: [
        ContractRepository,
        ContractItemRepository,
        ContractVersionRepository,
        DeliveryRepository
    ]
})
export class ContractsModule { }