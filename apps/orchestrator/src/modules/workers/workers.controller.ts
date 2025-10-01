import { Controller, Get } from '@nestjs/common';
import { WorkersService } from './workers.service';

@Controller('workers')
export class WorkersController {
  constructor(private readonly workersService: WorkersService) {}

  @Get()
  async getWorkers() {
    const workers = await this.workersService.getWorkers();
    return { workers };
  }
}
