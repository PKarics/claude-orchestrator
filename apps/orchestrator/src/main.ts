import 'dotenv/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const port = process.env.PORT || 3000;
  const instanceName = process.env.INSTANCE_NAME || 'default';

  const app = await NestFactory.create(AppModule);
  await app.listen(port);
  console.log(`[${instanceName}] Orchestrator running on http://localhost:${port}`);
}
bootstrap();