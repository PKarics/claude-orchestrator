import { Controller, Get } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { QueueService } from './modules/queue/queue.service';

@Controller()
export class AppController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly queueService: QueueService,
  ) {}

  @Get('health')
  async getHealth() {
    let redisConnected = false;
    try {
      redisConnected = await this.queueService.healthCheck();
    } catch (error) {
      redisConnected = false;
    }

    const dbConnected = this.dataSource.isInitialized;
    const isHealthy = dbConnected && redisConnected;

    return {
      status: isHealthy ? 'healthy' : 'unhealthy',
      database: { connected: dbConnected },
      redis: { connected: redisConnected },
    };
  }
}