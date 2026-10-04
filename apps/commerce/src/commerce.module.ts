import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProductsModule } from './modules/products.module';
import { ScheduleModule } from '@nestjs/schedule';
import { OrdersModule } from './modules/orders.module';
import { ClientsModule, Transport } from '@nestjs/microservices';
import { UsersClient } from './clients/users.client';
import { join } from 'path';
import { ContractsModule } from './modules/contracts.module';

@Module({
  imports: [
    ClientsModule.register([
      {
        name: 'USERS_PACKAGE',
        transport: Transport.GRPC,
        options: {
          package: 'users',
          protoPath: join(__dirname, '..', 'contracts', 'users.proto'),
          url: process.env.USERS_GRPC_URL || 'localhost:50051',
        },
      },
    ]),
    ClientsModule.register([
      {
        name: 'KAFKA_SERVICE',
        transport: Transport.KAFKA,
        options: {
          client: {
            brokers: ['localhost:9092']
          },
          producer: {
          },
        },
      },
    ]),
    ScheduleModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: Number(process.env.DB_PORT),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      autoLoadEntities: true,
      synchronize: true,
    }),
    ProductsModule,
    OrdersModule,
    ContractsModule,
  ],
  providers: [UsersClient],
  exports: [UsersClient],
})
export class CommerceModule { }