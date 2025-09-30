import { Module } from '@nestjs/common';
import { QueueService } from './queue.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [TasksModule],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}