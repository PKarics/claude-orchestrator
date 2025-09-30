import { Controller, Get } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

@Controller()
export class AppController {
  constructor(
    @InjectDataSource()
    private dataSource: DataSource,
  ) {}

  @Get('health')
  async getHealth() {
    const dbConnected = this.dataSource.isInitialized;
    return {
      status: 'ok',
      database: dbConnected ? 'connected' : 'disconnected',
    };
  }
}