import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { QueueService } from './modules/queue/queue.service';

@Controller()
export class AppController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
    private queueService: QueueService,
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