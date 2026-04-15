import { Controller } from '@nestjs/common';
import { MessagePattern, Payload } from '@nestjs/microservices';
import { ContractCancellationService } from '../services/contract-cancellation.service';
import { PenaltyService } from '../services/penalty.service';
import { CancelContractDto, CancellationResultDto, CancelScheduleDto, PauseContractDto, PenaltyCalculationDto, SuspensionResultDto} from '../dtos/contract-cancellation.dto';

@Controller()
export class ContractCancellationController {
    constructor(
        private readonly cancellationService: ContractCancellationService,
        private readonly penaltyService: PenaltyService
    ) { }

    @MessagePattern({ cmd: 'cancel_schedule' })
    async cancelSchedule(@Payload() cancelDto: CancelScheduleDto): Promise<CancellationResultDto> {
        return await this.cancellationService.cancelSchedule(cancelDto);
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

    // penalty operations
    @MessagePattern({ cmd: 'calculate_schedule_penalty' })
    async calculateSchedulePenalty(@Payload() payload: { scheduleId: string; cancellationDate?: Date }): Promise<PenaltyCalculationDto> {
        const { scheduleId, cancellationDate } = payload;
        return await this.penaltyService.calculateScheduleCancellationPenalty(scheduleId, cancellationDate || new Date());
    }

    @MessagePattern({ cmd: 'calculate_contract_penalty' })
    async calculateContractPenalty(@Payload() payload: { contractId: string; cancellationDate?: Date }): Promise<PenaltyCalculationDto> {
        const { contractId, cancellationDate } = payload;
        return await this.penaltyService.calculateContractCancellationPenalty(contractId, cancellationDate || new Date());
    }

    @MessagePattern({ cmd: 'should_suspend_account' })
    async shouldSuspendAccount(@Payload() penalty: PenaltyCalculationDto): Promise<boolean> {
        return this.penaltyService.shouldSuspendAccount(penalty);
    }

    @MessagePattern({ cmd: 'get_suspension_result' })
    async getSuspensionResult(@Payload() penalty: PenaltyCalculationDto): Promise<SuspensionResultDto> {
        return this.penaltyService.getSuspensionResult(penalty);
    }
}