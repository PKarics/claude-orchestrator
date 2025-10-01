import type { TaskStats } from '../types';

interface StatsCardsProps {
  stats: TaskStats | null;
}

export function StatsCards({ stats }: StatsCardsProps) {
  if (!stats) {
    return (
      <div className="stats-grid">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="stat-card">
            <div className="stat-label">Loading...</div>
            <div className="stat-value">-</div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="stats-grid">
      <div className="stat-card">
        <div className="stat-label">Total Tasks</div>
        <div className="stat-value">{stats.database.total}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Queued</div>
        <div className="stat-value">{stats.database.queued}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Running</div>
        <div className="stat-value">{stats.database.running}</div>
      </div>
      <div className="stat-card">
        <div className="stat-label">Completed</div>
        <div className="stat-value">{stats.database.completed}</div>
      </div>
    </div>
  );
}
