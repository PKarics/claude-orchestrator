import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { getRedisConfig } from '../../config/redis.config';

export interface Worker {
  id: string;
  type: string;
  status: 'active' | 'idle' | 'busy';
  lastHeartbeat: string;
}

@Injectable()
export class WorkersService {
  private readonly logger = new Logger(WorkersService.name);
  private redis: Redis;

  constructor(private readonly configService: ConfigService) {
    const redisConfig = getRedisConfig(this.configService);
    this.redis = new Redis(redisConfig.connection);
  }

  async getWorkers(): Promise<Worker[]> {
    try {
      // Get all worker heartbeat keys
      const keys = await this.redis.keys('worker:*:heartbeat');

      if (keys.length === 0) {
        return [];
      }

      const workers: Worker[] = [];
      const now = Date.now();

      for (const key of keys) {
        const lastHeartbeat = await this.redis.get(key);

        if (!lastHeartbeat) continue;

        // Extract worker ID from key (worker:{id}:heartbeat)
        const workerId = key.split(':')[1];

        // Calculate time since last heartbeat
        const heartbeatTime = new Date(lastHeartbeat).getTime();
        const timeSinceHeartbeat = now - heartbeatTime;

        // Determine worker status based on heartbeat age
        let status: 'active' | 'idle' | 'busy';
        if (timeSinceHeartbeat < 15000) { // Less than 15 seconds
          status = 'active';
        } else if (timeSinceHeartbeat < 30000) { // 15-30 seconds
          status = 'idle';
        } else {
          // Skip workers that haven't sent heartbeat in 30+ seconds
          continue;
        }

        workers.push({
          id: workerId,
          type: workerId.includes('cloud') ? 'cloud' : 'local',
          status,
          lastHeartbeat,
        });
      }

      return workers;
    } catch (error) {
      this.logger.error(`Failed to get workers: ${error.message}`);
      throw error;
    }
  }

  async onModuleDestroy() {
    await this.redis?.quit();
  }
}
