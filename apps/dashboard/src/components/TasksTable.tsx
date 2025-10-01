import type { Task } from '../types';

interface TasksTableProps {
  tasks: Task[];
}

export function TasksTable({ tasks }: TasksTableProps) {
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
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id}>
              <td>{task.id.substring(0, 8)}</td>
              <td>
                <span className={`status-badge ${task.status}`}>
                  {task.status}
                </span>
              </td>
              <td>{task.prompt}</td>
              <td>
                {task.workerId ? task.workerId.substring(0, 8) : '-'}
              </td>
              <td>{new Date(task.createdAt).toLocaleString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
