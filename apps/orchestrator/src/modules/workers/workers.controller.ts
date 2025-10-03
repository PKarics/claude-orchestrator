import { Controller, Get, Post, Delete, Body, Param, HttpCode, HttpStatus } from '@nestjs/common';
import { WorkersService } from './workers.service';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  async getWorkers() {
    const workers = await this.workersService.getWorkers();
    return { workers };
  }

  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  async registerWorker(@Body() body: { workerId: string; workerType: string }) {
    await this.workersService.registerWorker(body.workerId, body.workerType);
    return { message: 'Worker registered successfully', workerId: body.workerId };
  }

  @Delete(':workerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deregisterWorker(@Param('workerId') workerId: string) {
    await this.workersService.deregisterWorker(workerId);
  }
}
