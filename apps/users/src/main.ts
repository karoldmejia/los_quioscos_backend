import { NestFactory } from '@nestjs/core';
import { Transport, MicroserviceOptions } from '@nestjs/microservices';
import { AppModule } from './app.module';
import { join } from 'path';
import * as protoLoader from '@grpc/proto-loader';
import { ReflectionService } from '@grpc/reflection';

async function bootstrap() {
        const protoPath = join(__dirname, '..', 'contracts', 'users.proto');

    const app = await NestFactory.createMicroservice<MicroserviceOptions>(
        
        AppModule,
        {
            transport: Transport.GRPC,
            options: {
                package: 'users',
                protoPath,
                url: '0.0.0.0:50051',
                onLoadPackageDefinition: (pkg, server) => {
                    const packageDefinition = protoLoader.loadSync(protoPath, {
                        keepCase: true,
                        longs: String,
                        enums: String,
                        defaults: true,
                        oneofs: true,
                    });
                    const reflection = new ReflectionService(packageDefinition);
                    reflection.addToServer(server);
                },
            },
        },
    );

    await app.listen();
    console.log('Users gRPC service running on 50051');
}

bootstrap();