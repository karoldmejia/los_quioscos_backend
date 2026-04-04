import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContractVersionResponseDto, ProposeVersionDto, VersionComparisonDto, VersionHistoryResponseDto } from '../dtos/contract-version.dto';
import { ContractVersionService } from '../services/contract-version.service';

@Controller()
export class ContractVersionController {
    constructor(private readonly contractVersionService: ContractVersionService) { }


    @MessagePattern({ cmd: 'propose_contract_version' })
    async proposeVersion(@Payload() proposeDto: ProposeVersionDto): Promise<ContractVersionResponseDto> {
        return await this.contractVersionService.proposeVersion(proposeDto);
    }

    @MessagePattern({ cmd: 'accept_contract_version' })
    async acceptVersion(@Payload() payload: { contractId: string; versionNumber: number }): Promise<ContractVersionResponseDto> {
        const { contractId, versionNumber } = payload;
        return await this.contractVersionService.acceptVersion(contractId, versionNumber);
    }

    @MessagePattern({ cmd: 'reject_contract_version' })
    async rejectVersion(
        @Payload() payload: { contractId: string; versionNumber: number }): Promise<ContractVersionResponseDto> {
        const { contractId, versionNumber } = payload;
        return await this.contractVersionService.rejectVersion(contractId, versionNumber);
    }

    @MessagePattern({ cmd: 'get_contract_version_history' })
    async getVersionHistory(@Payload() contractId: string): Promise<VersionHistoryResponseDto> {
        return await this.contractVersionService.getVersionHistory(contractId);
    }

    @MessagePattern({ cmd: 'compare_contract_versions' })
    async compareVersions(@Payload() payload: { contractId: string; versionA: number; versionB: number }): Promise<VersionComparisonDto> {
        const { contractId, versionA, versionB } = payload;
        return await this.contractVersionService.compareVersions(contractId, versionA, versionB);
    }
}