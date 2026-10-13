import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

import { CheckCoverageRequest, CheckCoverageResponse, LogisticsServiceClient } from 'src/protos/logistics';

@Injectable()
export class LogisticsClient implements OnModuleInit {
    private logisticsService: LogisticsServiceClient;

    constructor(
        @Inject('LOGISTICS_PACKAGE')
        private readonly client: ClientGrpc,
    ) { }

    onModuleInit() {
        this.logisticsService = this.client.getService<LogisticsServiceClient>('LogisticsService');
    }

    async checkCoverage(pickupId: string, deliveryId: string): Promise<CheckCoverageResponse> {
        const request: CheckCoverageRequest = { pickupId, deliveryId };

        const response = await firstValueFrom(
            this.logisticsService.checkCoverage(request)
        );

        return {
            covered: response.covered,
            reason: response.reason
        };
    }
}