import Redis from 'ioredis';

export class HeartbeatService {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private redis: Redis,
    private workerId: string,
    private workerType: string = 'local',
    private intervalSeconds: number = 10,
  ) {}

  start() {
    this.sendHeartbeat();
    this.interval = setInterval(() => this.sendHeartbeat(), this.intervalSeconds * 1000);
  }

  stop() {
    if (this.interval) {
      clearInterval(this.interval);
      this.interval = null;
    }
  }

  private async sendHeartbeat() {
    try {
      const heartbeatKey = `worker:${this.workerId}:heartbeat`;
      const typeKey = `worker:${this.workerId}:type`;

      // Store heartbeat timestamp with TTL
      await this.redis.setex(heartbeatKey, 30, new Date().toISOString());

      // Store worker type with TTL
      await this.redis.setex(typeKey, 30, this.workerType);
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }

  async cleanup() {
    try {
      const heartbeatKey = `worker:${this.workerId}:heartbeat`;
      const typeKey = `worker:${this.workerId}:type`;

      // Remove worker data from Redis on shutdown
      await this.redis.del(heartbeatKey, typeKey);
    } catch (error) {
      console.error('Failed to cleanup worker data:', error);
    }
  }
}