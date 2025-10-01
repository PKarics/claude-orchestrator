import type { Worker } from '../types';

interface WorkersListProps {
  workers: Worker[];
}

export function WorkersList({ workers }: WorkersListProps) {
  if (workers.length === 0) {
    return (
      <div className="section">
        <h2>Active Workers</h2>
        <div className="empty-state">No active workers</div>
      </div>
    );
  }

  return (
    <div className="section">
      <h2>Active Workers</h2>
      <div className="workers-grid">
        {workers.map((worker) => (
          <div key={worker.id} className="worker-card">
            <div className="worker-info">
              <div className="worker-id">{worker.id.substring(0, 8)}</div>
              <div className="worker-meta">
                Type: {worker.type} • Last heartbeat:{' '}
                {new Date(worker.lastHeartbeat).toLocaleString()}
              </div>
            </div>
            <div className={`worker-status ${worker.status}`}>
              {worker.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
