import { NestFactory } from '@nestjs/core';
import { DocumentsModule } from './documents.module';

async function bootstrap() {
  const app = await NestFactory.create(DocumentsModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
