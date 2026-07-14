import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContractCancellationService } from '../services/contract-cancellation.service';
import { CancelContractDto, CancelDeliveryDto, CancellationResultDto, PauseContractDto, SuspensionResultDto} from '../dtos/contract-cancellation.dto';

@Controller()
export class ContractCancellationController {
    constructor(
        private readonly cancellationService: ContractCancellationService,
    ) { }

    @MessagePattern({ cmd: 'cancel_schedule' })
    async cancelDelivery(@Payload() cancelDto: CancelDeliveryDto): Promise<CancellationResultDto> {
        return await this.cancellationService.cancelDelivery(cancelDto);
    }

    @MessagePattern({ cmd: 'pause_contract' })
    async pauseContract(@Payload() pauseDto: PauseContractDto): Promise<CancellationResultDto> {
        return await this.cancellationService.pauseContract(pauseDto);
    }

    @MessagePattern({ cmd: 'resume_contract' })
    async resumeContract(@Payload() contractId: string): Promise<CancellationResultDto> {
        return await this.cancellationService.resumeContract(contractId);
    }

    @MessagePattern({ cmd: 'cancel_contract' })
    async cancelContract(@Payload() cancelDto: CancelContractDto): Promise<CancellationResultDto> {
        return await this.cancellationService.cancelContract(cancelDto);
    }
}