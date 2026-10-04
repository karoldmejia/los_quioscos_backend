import { Controller, UseFilters } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";
import { SchedulesService } from "@/services/schedules.service";
import { RpcDomainExceptionFilter } from "@/common/exceptions/rpc-domain-exception.filter";

import { KiosksAvailabilityRequest, KiosksAvailabilityResponse, KioskAvailability } from '../../protos/users';

@Controller()
@UseFilters(RpcDomainExceptionFilter)
export class ScheduleGrpcController {
    constructor(private readonly scheduleService: SchedulesService) {}

    @GrpcMethod('UsersService', 'GetKiosksAvailability')
    async getKiosksAvailability(
        data: KiosksAvailabilityRequest
    ): Promise<KiosksAvailabilityResponse> {
        const result = await this.scheduleService.getKiosksAvailability(data.kioskIds);
        
        return { 
            items: result.map(r => ({
                kioskId: r.kioskId,
                isAvailable: r.isAvailable,
                reason: r.reason || '',
            }))
        };
    }
}