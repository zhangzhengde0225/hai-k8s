import { useEffect, useState } from 'react';
import client from '../api/client';
import type { ClusterNode } from '../types';
import toast from 'react-hot-toast';

export default function AdminCluster() {
  const [nodes, setNodes] = useState<ClusterNode[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    client
      .get('/admin/cluster')
      .then((res) => setNodes(res.data.nodes))
      .catch(() => toast.error('Failed to load cluster info'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-gray-500 dark:text-gray-400">Loading...</p>;

  return (
    <div>
      <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-6">Cluster Overview</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nodes.map((node) => (
          <div
            key={node.name}
            className="bg-white dark:bg-gray-800 rounded-lg shadow p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-gray-900 dark:text-white">{node.name}</h3>
              <span
                className={`text-xs px-2 py-1 rounded-full font-medium ${
                  node.ready
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {node.ready ? 'Ready' : 'Not Ready'}
              </span>
            </div>

            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">CPU Capacity</span>
                <span className="font-medium dark:text-white">{node.cpu_capacity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">CPU Allocatable</span>
                <span className="font-medium dark:text-white">{node.cpu_allocatable}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Memory Capacity</span>
                <span className="font-medium dark:text-white">{node.memory_capacity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">Memory Allocatable</span>
                <span className="font-medium dark:text-white">{node.memory_allocatable}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">GPU Capacity</span>
                <span className="font-medium dark:text-white">{node.gpu_capacity}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500 dark:text-gray-400">GPU Allocatable</span>
                <span className="font-medium dark:text-white">{node.gpu_allocatable}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
