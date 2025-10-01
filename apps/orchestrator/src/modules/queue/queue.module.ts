import { Module, forwardRef } from '@nestjs/common';
import { QueueService } from './queue.service';
import { TasksModule } from '../tasks/tasks.module';

@Module({
  imports: [forwardRef(() => TasksModule)],
  providers: [QueueService],
  exports: [QueueService],
})
export class QueueModule {}