import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContractActionDto } from '../dtos/contract-action.dto';
import { ContractFilterDto } from '../dtos/contract-filter.dto';
import { ContractResponseDto, CreateContractDto } from '../dtos/contract.dto';
import { ContractService } from '../services/contract.service';

@Controller()
export class ContractController {
    constructor(private readonly contractService: ContractService) { }


    @MessagePattern({ cmd: 'create_contract' })
    async createContract(@Payload() createContractDto: CreateContractDto): Promise<ContractResponseDto> {
        return await this.contractService.createContract(createContractDto);
    }

    @MessagePattern({ cmd: 'get_contract' })
    async getContract(@Payload() contractId: string): Promise<ContractResponseDto> {
        return await this.contractService.getContract(contractId);
    }

    @MessagePattern({ cmd: 'get_contracts' })
    async getContracts(@Payload() filterDto: ContractFilterDto): Promise<ContractResponseDto[]> {
        return await this.contractService.getContracts(filterDto);
    }

    @MessagePattern({ cmd: 'activate_contract' })
    async activateContract(
        @Payload() payload: { contractId: string; activateDto: ContractActionDto }
    ): Promise<ContractResponseDto> {
        const { contractId, activateDto } = payload;
        return await this.contractService.activateContract(contractId, activateDto);
    }

    @MessagePattern({ cmd: 'expire_contract' })
    async expireContract(@Payload() contractId: string): Promise<ContractResponseDto> {
        return await this.contractService.expireContract(contractId);
    }

    @MessagePattern({ cmd: 'expire_all_contracts' })
    async expireAllContracts(): Promise<{ expiredCount: number }> {
        const expiredCount = await this.contractService.expireContracts();
        return { expiredCount };
    }
}