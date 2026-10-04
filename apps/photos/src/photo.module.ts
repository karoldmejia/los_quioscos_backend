import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PhotoController } from './photo.controller';
import { LocalStorageService } from './services/localStorage.service';
import { Photo } from './photo.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env',
      isGlobal: true,
    }),
    
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get('DB_HOST', 'localhost'),
        port: configService.get('DB_PORT', 5432),
        username: configService.get('DB_USERNAME', 'postgres'),
        password: configService.get('DB_PASSWORD', 'postgres'),
        database: configService.get('DB_DATABASE', 'photos'),
        entities: [Photo],
        synchronize: true,
        logging: true,
        extra: {
          connectionTimeoutMillis: 5000,
        },
      }),
      inject: [ConfigService],
    }),
    
    TypeOrmModule.forFeature([Photo]),
  ],
  controllers: [PhotoController],
  providers: [LocalStorageService],
  exports: [LocalStorageService],
})
export class PhotoModule {}