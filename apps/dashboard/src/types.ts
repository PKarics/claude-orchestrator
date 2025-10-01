export interface Instance {
  name: string;
  url: string;
  port: number;
}

export interface TaskStats {
  database: {
    total: number;
    queued: number;
    running: number;
    completed: number;
    failed: number;
  };
  queue: {
    waiting: number;
    active: number;
  };
}

export interface Task {
  id: string;
  status: 'queued' | 'running' | 'completed' | 'failed' | 'timeout';
  prompt: string;
  code?: string;
  workerId?: string;
  result?: string;
  error?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface Worker {
  id: string;
  type: string;
  status: 'active' | 'idle' | 'busy';
  lastHeartbeat: string;
}

export interface CreateTaskDto {
  code: string;
  prompt: string;
  timeout?: number;
}
