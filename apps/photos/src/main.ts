// main.ts
import { NestFactory } from '@nestjs/core';
import { MicroserviceOptions, Transport } from '@nestjs/microservices';
import { PhotoModule } from './photo.module';
import { join } from 'path';
import { ConfigService } from '@nestjs/config';

async function bootstrap() {
    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        PhotoModule,
        {
            transport: Transport.GRPC,
            options: {
                package: 'photos',
                protoPath: join(__dirname, '..', 'contracts', 'photos.proto'),
                url: '0.0.0.0:50052',
            },
        },
    );
    await app.listen();
    console.log('Photos microservice is running on gRPC port 50052');
}
bootstrap();