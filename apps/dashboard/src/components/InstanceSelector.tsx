import { useState } from 'react';
import type { Instance } from '../types';

interface InstanceSelectorProps {
  instances: Instance[];
  currentInstance: Instance | null;
  onInstanceChange: (instance: Instance) => void;
  onAddInstance: (instance: Instance) => void;
}

export function InstanceSelector({
  instances,
  currentInstance,
  onInstanceChange,
  onAddInstance,
}: InstanceSelectorProps) {
  const [showAddForm, setShowAddForm] = useState(false);
  const [newInstancePort, setNewInstancePort] = useState('3000');

  const handleAdd = () => {
    const port = parseInt(newInstancePort);
    if (port && port > 0 && port < 65536) {
      const newInstance: Instance = {
        name: `Instance :${port}`,
        url: `http://localhost:${port}`,
        port,
      };
      onAddInstance(newInstance);
      setShowAddForm(false);
      setNewInstancePort('3000');
    }
  };

  return (
    <div className="instance-selector">
      <label>Instance:</label>
      <select
        value={currentInstance?.url || ''}
        onChange={(e) => {
          const instance = instances.find((i) => i.url === e.target.value);
          if (instance) onInstanceChange(instance);
        }}
      >
        {instances.length === 0 && (
          <option value="">No instances</option>
        )}
        {instances.map((instance) => (
          <option key={instance.url} value={instance.url}>
            {instance.name} ({instance.url})
          </option>
        ))}
      </select>

      <div className="instance-actions">
        {!showAddForm ? (
          <button className="btn btn-sm" onClick={() => setShowAddForm(true)}>
            + Add
          </button>
        ) : (
          <>
            <input
              type="number"
              value={newInstancePort}
              onChange={(e) => setNewInstancePort(e.target.value)}
              placeholder="Port"
              style={{ width: '80px', padding: '0.25rem 0.5rem' }}
              min="1"
              max="65535"
            />
            <button className="btn btn-sm btn-primary" onClick={handleAdd}>
              Add
            </button>
            <button className="btn btn-sm" onClick={() => setShowAddForm(false)}>
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}
