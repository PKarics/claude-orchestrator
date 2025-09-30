import 'dotenv/config';
import * as crypto from 'crypto';
// Make crypto available globally for @nestjs/typeorm
(global as any).crypto = crypto;

import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT || 3000;
  const instanceName = process.env.INSTANCE_NAME || 'default';

  const app = await NestFactory.create(AppModule);

  // Enable validation globally
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  await app.listen(port);
  console.log(`[${instanceName}] Orchestrator running on http://localhost:${port}`);
}
bootstrap();