import { Task } from '../types';

interface TaskDetailModalProps {
  task: Task | null;
  onClose: () => void;
}

export function TaskDetailModal({ task, onClose }: TaskDetailModalProps) {
  if (!task) return null;

  const getDuration = () => {
    if (!task.startedAt) return '-';
    const start = new Date(task.startedAt).getTime();
    const end = task.completedAt ? new Date(task.completedAt).getTime() : Date.now();
    const duration = Math.round((end - start) / 1000);
    return `${duration}s`;
  };

  const formatDate = (date?: string) => {
    if (!date) return '-';
    return new Date(date).toLocaleString();
  };

  const hasResult = task.result && task.result.trim().length > 0;
  const hasError = task.errorMessage && task.errorMessage.trim().length > 0;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Task Details</h2>
          <button className="close-button" onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="modal-body">
          {/* Status and Metrics */}
          <div className="info-cards">
            <div className="info-card">
              <div className="info-label">Status</div>
              <span className={`status-badge status-badge-lg ${task.status}`}>
                {task.status.toUpperCase()}
              </span>
            </div>

            <div className="info-card">
              <div className="info-label">Duration</div>
              <div className="info-value">{getDuration()}</div>
            </div>

            <div className="info-card">
              <div className="info-label">Timeout</div>
              <div className="info-value">{task.timeout}s</div>
            </div>
          </div>

          {/* IDs */}
          <div className="detail-section">
            <h3>Task ID</h3>
            <div className="id-block">{task.id}</div>
          </div>

          {task.workerId && (
            <div className="detail-section">
              <h3>Worker ID</h3>
              <div className="id-block">{task.workerId}</div>
            </div>
          )}

          {/* Prompt */}
          <div className="detail-section">
            <h3>Prompt</h3>
            <div className="prompt-block">{task.prompt}</div>
          </div>

          {/* Timeline */}
          <div className="detail-section">
            <h3>Timeline</h3>
            <div className="timeline">
              <div className="timeline-item">
                <div className="timeline-label">Created</div>
                <div className="timeline-value">{formatDate(task.createdAt)}</div>
              </div>
              {task.startedAt && (
                <div className="timeline-item">
                  <div className="timeline-label">Started</div>
                  <div className="timeline-value">{formatDate(task.startedAt)}</div>
                </div>
              )}
              {task.completedAt && (
                <div className="timeline-item">
                  <div className="timeline-label">Completed</div>
                  <div className="timeline-value">{formatDate(task.completedAt)}</div>
                </div>
              )}
            </div>
          </div>

          {/* Result */}
          {hasResult ? (
            <div className="detail-section">
              <h3>✓ Result</h3>
              <div className="result-block result-success">{task.result}</div>
            </div>
          ) : hasError ? null : (
            <div className="detail-section">
              <div className="no-result">
                {task.status === 'completed'
                  ? 'Task completed but no result was captured'
                  : task.status === 'running'
                  ? 'Task is still running...'
                  : 'No result available yet'}
              </div>
            </div>
          )}

          {/* Error */}
          {hasError && (
            <div className="detail-section">
              <h3>✗ Error</h3>
              <div className="result-block result-error">{task.errorMessage}</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
