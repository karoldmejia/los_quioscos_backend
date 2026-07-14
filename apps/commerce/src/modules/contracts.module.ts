import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Contract } from '../entities/contract.entity';
import { ContractItem } from '../entities/contract-item.entity';
import { ContractVersion } from '../entities/contract-version.entity';
import { IContractRepository } from '../repositories/icontract.repository';
import { ContractRepository } from '../repositories/impl/contract.repository';
import { IContractItemRepository } from '../repositories/icontract-item.repository';
import { ContractItemRepository } from '../repositories/impl/contract-item.repository';
import { IContractVersionRepository } from '../repositories/icontract-version.repository';
import { ContractVersionRepository } from '../repositories/impl/contract-version.repository';
import { Delivery } from '../entities/delivery.entity';
import { DeliveryRepository } from '../repositories/impl/delivery.repository';
import { IDeliveryRepository } from '../repositories/idelivery.repository';
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
        IContractRepository,
        IContractItemRepository,
        IContractVersionRepository,
        IDeliveryRepository
    ]
})
export class ContractsModule { }