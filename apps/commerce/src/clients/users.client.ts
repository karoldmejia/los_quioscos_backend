import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import type { ClientGrpc } from '@nestjs/microservices';
import { firstValueFrom, Observable } from 'rxjs';

import { UsersServiceClient, KiosksAvailabilityRequest, UserProfile, KioskAvailability,} from '../protos/users';

@Injectable()
export class UsersClient implements OnModuleInit {
    private usersService: UsersServiceClient;

    constructor(
        @Inject('USERS_PACKAGE')
        private readonly client: ClientGrpc,
    ) {}

    onModuleInit() {
        this.usersService = this.client.getService<UsersServiceClient>('UsersService');
    }

    async getKiosksAvailability(kioskIds: string[]): Promise<KioskAvailability[]> {
        const request: KiosksAvailabilityRequest = { kioskIds };
        
        const response = await firstValueFrom(
            this.usersService.getKiosksAvailability(request)
        );
        
        return response.items;
    }

    async getUserProfile(userId: string): Promise<UserProfile> {
        return await firstValueFrom(
            this.usersService.getUserProfile({ userId })
        );
    }
}