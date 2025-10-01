import { useState, useEffect, useCallback } from 'react';
import { InstanceSelector } from './components/InstanceSelector';
import { StatsCards } from './components/StatsCards';
import { WorkersList } from './components/WorkersList';
import { TasksTable } from './components/TasksTable';
import { CreateTaskForm } from './components/CreateTaskForm';
import { ApiService } from './services/api';
import type { Instance, TaskStats, Task, Worker } from './types';
import './App.css';

const REFRESH_INTERVAL = 5000;
const DEFAULT_INSTANCES: Instance[] = [
  { name: 'Default', url: 'http://localhost:3002', port: 3002 },
];

function App() {
  const [instances, setInstances] = useState<Instance[]>(() => {
    const saved = localStorage.getItem('instances');
    return saved ? JSON.parse(saved) : DEFAULT_INSTANCES;
  });

  const [currentInstance, setCurrentInstance] = useState<Instance | null>(
    () => instances[0] || null
  );

  const [stats, setStats] = useState<TaskStats | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [api, setApi] = useState<ApiService | null>(null);

  // Update API service when instance changes
  useEffect(() => {
    if (currentInstance) {
      setApi(new ApiService(currentInstance.url));
    }
  }, [currentInstance]);

  // Load data from API
  const loadData = useCallback(async () => {
    if (!api) return;

    try {
      // Load stats and tasks (required endpoints)
      const [statsData, tasksData] = await Promise.all([
        api.getStats(),
        api.getTasks(10),
      ]);

      setStats(statsData);
      setTasks(tasksData.tasks);

      // Try to load workers (optional endpoint, may not be implemented yet)
      try {
        const workersData = await api.getWorkers();
        setWorkers(workersData.workers);
      } catch (workersErr) {
        // Workers endpoint not available yet, use empty array
        setWorkers([]);
      }

      setError(null);
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Failed to connect to orchestrator'
      );
      console.error('Failed to load data:', err);
    }
  }, [api]);

  // Initial load and auto-refresh
  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [loadData]);

  // Save instances to localStorage
  useEffect(() => {
    localStorage.setItem('instances', JSON.stringify(instances));
  }, [instances]);

  const handleInstanceChange = (instance: Instance) => {
    setCurrentInstance(instance);
    setStats(null);
    setTasks([]);
    setWorkers([]);
    setError(null);
  };

  const handleAddInstance = (instance: Instance) => {
    // Check if instance already exists
    const exists = instances.some((i) => i.url === instance.url);
    if (exists) {
      alert('Instance already exists');
      return;
    }

    const newInstances = [...instances, instance];
    setInstances(newInstances);
    setCurrentInstance(instance);
  };

  const handleCreateTask = async (taskData: {
    code: string;
    prompt: string;
    timeout?: number;
  }) => {
    if (!api) throw new Error('No instance selected');
    await api.createTask(taskData);
    // Reload data after creating task
    await loadData();
  };

  return (
    <div className="app">
      <header className="header">
        <h1>Claude Orchestrator Dashboard</h1>
        <InstanceSelector
          instances={instances}
          currentInstance={currentInstance}
          onInstanceChange={handleInstanceChange}
          onAddInstance={handleAddInstance}
        />
      </header>

      <div className="container">
        {error && <div className="error-message">{error}</div>}

        {currentInstance ? (
          <>
            <StatsCards stats={stats} />
            <WorkersList workers={workers} />
            <TasksTable tasks={tasks} />
            <CreateTaskForm onSubmit={handleCreateTask} />
          </>
        ) : (
          <div className="empty-state">
            <h2>No instance selected</h2>
            <p>Please add an instance to get started</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
