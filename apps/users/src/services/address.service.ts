import { InjectRepository } from "@nestjs/typeorm";
import { CreateAddressDto } from "../dtos/address.dto";
import { Address } from "../entities/address.entity";
import { Injectable } from "@nestjs/common";
import { DataSource, DeepPartial, Not, Repository } from "typeorm";
import { UsersService } from "./users.service";
import { DomainException } from "@/common/exceptions/domain.exception";

@Injectable()
export class AddressService {

    constructor(
        @InjectRepository(Address)
        private readonly repo: Repository<Address>,
        private readonly usersService: UsersService,
        private readonly dataSource: DataSource,
    ) { }

    async addAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
        // validar existencia del id del usuario
        const user = await this.usersService.findUserById(userId)

        if (!user) {
            throw new DomainException('User id not found')
        }
        // validar el tipo de usuario y limite de direcciones
        const addressCount = await this.repo.count({ where: { user } })
        if (user.kioskProfile !== null || user.carrierProfile !== null) {
            if (addressCount >= 1) {
                throw new DomainException('Only can have one address')
            }
        } else if (addressCount > 10) {
            throw new DomainException('Users cannot have more than 10 addresses registered')

        }
        // validar alias no duplicado

        if (dto.alias) {
            const existingAlias = await this.repo.findOne({ where: { user: user, alias: dto.alias } });
            if (existingAlias) {
                throw new DomainException('Alias already exists for this user')
            }
        }

        // validar que isDefault, si es la primera dirección, isDefault sea true
        // si no es la primera y viene como isDefault, desactivar el resto

        const isDefault = dto.isDefault || addressCount === 0;
        return this.dataSource.transaction(async (manager) => {
            if (isDefault) {
                await manager.update(
                    Address,
                    { user: { user_id: user.user_id } },
                    { isDefault: false }
                );
            }

            const addressData = this.buildAddressData(dto)
            const address = await manager.create(Address, addressData);

            return manager.save(address);
        });
    }

    async updateAddress(userId: string, addressId: string, dto: CreateAddressDto): Promise<Address> {
        // validar existencia del id del usuario
        const user = await this.usersService.findUserById(userId)

        if (!user) {
            throw new DomainException('User id not found')
        }

        const existingAddress = await this.repo.findOne({ where: { id: addressId, user: user } })
        if (!existingAddress) {
            throw new DomainException('Address not found');

        }
        // validar alias no duplicado

        if (dto.alias) {
            const existingAlias = await this.repo.findOne({ where: { user: user, alias: dto.alias, id: Not(addressId), } });
            if (existingAlias) {
                throw new DomainException('Alias already exists for this user')
            }
        }

        return this.dataSource.transaction(async (manager) => {
            if (dto.isDefault === true && !existingAddress.isDefault) {
                await manager.update(
                    Address,
                    { user: { user_id: user.user_id } },
                    { isDefault: false }
                );
            }

            const addressData = this.buildAddressData(dto)
            await manager.update(Address, addressId, addressData);

            return manager.findOneOrFail(Address, { where: { id: addressId } });
        });
    }

    async deleteAddress(userId: string, addressId: string): Promise<void> {
        const user = await this.usersService.findUserById(userId);
        if (!user) {
            throw new DomainException('User id not found');
        }

        return this.dataSource.transaction(async (manager) => {
            const existingAddress = await manager.findOne(Address, {
                where: { id: addressId, user: { user_id: userId } },
            });
            if (!existingAddress) {
                throw new DomainException('Address not found');
            }

            await manager.delete(Address, addressId);

            // Si borramos la default, promover otra
            if (existingAddress.isDefault) {
                const nextAddress = await manager.findOne(Address, {
                    where: { user: { user_id: userId } },
                    order: { createdAt: 'ASC' },
                });

                if (nextAddress) {
                    await manager.update(Address, nextAddress.id, { isDefault: true });
                }
            }
        });
    }

    async getDefaultAddress(userId: string): Promise<Address | null> {
        const user = await this.usersService.findUserById(userId);
        if (!user) {
            throw new DomainException('User id not found');
        }

        return this.repo.findOne({
            where: {
                user: { user_id: userId },
                isDefault: true,
            },
        });
    }

    // helpers

    private buildAddressData(dto: Partial<CreateAddressDto>): DeepPartial<Address> {
        const data: DeepPartial<Address> = {};

        if (dto.alias !== undefined) data.alias = dto.alias || undefined;
        if (dto.reference !== undefined) data.reference = dto.reference || undefined;
        if (dto.isDefault !== undefined) data.isDefault = dto.isDefault;
        if (dto.addressLine !== undefined) data.addressLine = dto.addressLine || undefined;
        if (dto.municipality !== undefined) data.municipality = dto.municipality;
        if (dto.department !== undefined) data.department = dto.department;
        if (dto.neighborhood !== undefined) data.neighborhood = dto.neighborhood || undefined;
        if (dto.country !== undefined) data.country = dto.country;
        if (dto.latitude !== undefined) data.latitude = dto.latitude;
        if (dto.longitude !== undefined) data.longitude = dto.longitude;
        if (dto.mapboxId !== undefined) data.mapboxId = dto.mapboxId || undefined;

        return data;
    }

}