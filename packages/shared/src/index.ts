export enum TaskStatus {
  QUEUED = 'queued',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
}

export interface Task {
  id: string;
  status: TaskStatus;
  code: string;
  prompt: string;
  timeout: number;
  createdAt: Date;
  workerId?: string;
  result?: TaskResult;
}

export interface TaskResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

// DTOs
export { CreateTaskDto } from './dto/create-task.dto';
export { UpdateTaskDto } from './dto/update-task.dto';