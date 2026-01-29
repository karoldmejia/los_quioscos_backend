import { NestFactory } from '@nestjs/core';
import { CommerceModule } from './commerce.module';

async function bootstrap() {
  const app = await NestFactory.create(CommerceModule);
  await app.listen(process.env.port ?? 3000);
}
bootstrap();
