import { RpcDomainExceptionFilter } from "@/common/exceptions/rpc-domain-exception.filter";
import { GetKioskServiceRadiusRequest, GetKioskServiceRadiusResponse, GetUserAddressRequest, GetUserAddressResponse } from "@/protos/users";
import { AddressService } from "@/services/address.service";
import { KioskProfileService } from "@/services/kioskprofile.service";
import { Controller, UseFilters } from "@nestjs/common";
import { GrpcMethod } from "@nestjs/microservices";

@Controller()
@UseFilters(RpcDomainExceptionFilter)
export class AddressGrpcController {
    constructor(
        private readonly addressService: AddressService,
    private readonly kioskService: KioskProfileService) { }

    @GrpcMethod('UsersService', 'GetUserAddress')
    async getUserAddress(data: GetUserAddressRequest): Promise<GetUserAddressResponse> {
        const result = await this.addressService.getDefaultAddress(data.userId);

        return {
            userId: result.user.user_id,
            latitude: Number(result.latitude),
            longitude: Number(result.longitude),
            addressLine: result.addressLine,
        };
    }

    @GrpcMethod('UsersService', 'GetKioskServiceRadius')
    async getKioskServiceRadius(data: GetKioskServiceRadiusRequest): Promise<GetKioskServiceRadiusResponse> {
        const result = await this.kioskService.getKioskServiceRadius(data.userId);

        return {
            serviceRadiusKm: result,
        };
    }
}