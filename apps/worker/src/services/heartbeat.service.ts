import Redis from 'ioredis';

export class HeartbeatService {
  private interval: NodeJS.Timeout | null = null;

  constructor(
    private redis: Redis,
    private workerId: string,
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
      const key = `worker:${this.workerId}:heartbeat`;
      await this.redis.setex(key, 30, new Date().toISOString());
    } catch (error) {
      console.error('Failed to send heartbeat:', error);
    }
  }
}