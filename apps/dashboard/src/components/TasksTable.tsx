import { useState } from 'react';
import type { Task } from '../types';
import { TaskDetailModal } from './TaskDetailModal';

interface TasksTableProps {
  tasks: Task[];
}

export function TasksTable({ tasks }: TasksTableProps) {
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  if (tasks.length === 0) {
    return (
      <div className="section">
        <h2>Recent Tasks</h2>
        <div className="empty-state">No tasks yet</div>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>Recent Tasks</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Status</th>
            <th>Prompt</th>
            <th>Worker</th>
            <th>Duration</th>
            <th>Result/Error</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => {
            const getDuration = () => {
              if (!task.startedAt) return '-';
              const start = new Date(task.startedAt).getTime();
              const end = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
              const duration = Math.round((end - start) / 1000);
              return `${duration}s`;
            };

            return (
              <tr key={task.id} onClick={() => setSelectedTask(task)} style={{ cursor: 'pointer' }}>
                <td title={task.id}>{task.id.substring(0, 8)}</td>
                <td>
                  <span className={`status-badge ${task.status}`}>
                    {task.status}
                  </span>
                </td>
                <td title={task.prompt}>
                  {task.prompt.length > 50
                    ? `${task.prompt.substring(0, 50)}...`
                    : task.prompt}
                </td>
                <td>
                  {task.workerId ? task.workerId.substring(0, 8) : '-'}
                </td>
                <td>{getDuration()}</td>
                <td>
                  {task.errorMessage ? (
                    <span className="error-text" title={task.errorMessage}>
                      {task.errorMessage.length > 30
                        ? `${task.errorMessage.substring(0, 30)}...`
                        : task.errorMessage}
                    </span>
                  ) : task.result ? (
                    <span className="success-text" title={task.result}>
                      {task.result.length > 30
                        ? `${task.result.substring(0, 30)}...`
                        : task.result}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <TaskDetailModal task={selectedTask} onClose={() => setSelectedTask(null)} />
    </div>
  );
}
