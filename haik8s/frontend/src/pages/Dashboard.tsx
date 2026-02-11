import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import client from '../api/client';
import type { Container } from '../types';
import { PlusCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const statusColors: Record<string, string> = {
  running: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300',
  creating: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300',
  stopped: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300',
  failed: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300',
};

const statusLabels: Record<string, string> = {
  running: 'Running',
  creating: 'Starting...',
  pending: 'Starting...',
  stopped: 'Stopped',
  failed: 'Failed',
};

export default function Dashboard() {
  const { t } = useTranslation('container');
  const [containers, setContainers] = useState<Container[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchContainers = () => {
    client
      .get('/containers')
      .then((res) => setContainers(res.data))
      .catch(() => toast.error('Failed to load containers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchContainers();
  }, []);

  if (loading) {
    return <p className="text-gray-500 dark:text-gray-400">Loading...</p>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-white">{t('myContainers')}</h2>
        <Link
          to="/containers/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm font-medium"
        >
          <PlusCircle size={16} />
          {t('newContainer', { ns: 'common' })}
        </Link>
      </div>

      {containers.length === 0 ? (
        <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg shadow">
          <p className="text-gray-500 dark:text-gray-400 mb-4">{t('noContainers')}</p>
          <Link
            to="/containers/new"
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {t('createFirst')}
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {containers.map((c) => (
            <Link
              key={c.id}
              to={`/containers/${c.id}`}
              className="block bg-white dark:bg-gray-800 rounded-lg shadow hover:shadow-md transition-shadow p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-gray-900 dark:text-white truncate">
                  {c.name}
                </h3>
                <span
                  className={`text-xs px-2 py-1 rounded-full font-medium ${
                    statusColors[c.status] || 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-300'
                  }`}
                >
                  {statusLabels[c.status] || c.status}
                </span>
              </div>
              <p className="text-sm text-gray-500 dark:text-gray-400 truncate mb-2">
                {c.image_name || c.image_registry_url}
              </p>
              <div className="flex gap-3 text-xs text-gray-400 dark:text-gray-500">
                <span>CPU: {c.cpu_request}</span>
                <span>Mem: {c.memory_request}G</span>
                {c.gpu_request > 0 && <span>GPU: {c.gpu_request}</span>}
              </div>
              {c.ssh_enabled && c.ssh_node_port && (
                <div className="mt-2 text-xs text-blue-500 dark:text-blue-400">
                  SSH: port {c.ssh_node_port}
                </div>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
