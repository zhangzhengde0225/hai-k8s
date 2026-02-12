import { useTranslation } from 'react-i18next';
import { useEffect, useState } from 'react';
import client from '../api/client';
import type { Container } from '../types';
import {
  Box,
  Server,
  Cpu,
  HardDrive,
  Activity,
  TrendingUp,
} from 'lucide-react';

interface ResourceStats {
  totalContainers: number;
  runningContainers: number;
  totalCpuUsage: number;
  totalMemoryUsage: number;
  totalStorage: number;
}

export default function Overview() {
  const { t } = useTranslation();
  const [stats, setStats] = useState<ResourceStats>({
    totalContainers: 0,
    runningContainers: 0,
    totalCpuUsage: 0,
    totalMemoryUsage: 0,
    totalStorage: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      const response = await client.get<Container[]>('/containers');
      const containers = response.data;

      const running = containers.filter(c => c.status === 'running').length;
      const totalCpu = containers.reduce((sum, c) => sum + (c.cpu_request || 0), 0);
      const totalMem = containers.reduce((sum, c) => sum + (c.memory_request || 0), 0);

      setStats({
        totalContainers: containers.length,
        runningContainers: running,
        totalCpuUsage: totalCpu,
        totalMemoryUsage: totalMem,
        totalStorage: 0,
      });
    } catch (error) {
      console.error('Failed to load stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const StatCard = ({
    icon: Icon,
    title,
    value,
    unit,
    color
  }: {
    icon: any;
    title: string;
    value: number | string;
    unit?: string;
    color: string;
  }) => (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 border border-gray-200 dark:border-gray-700">
      <div className="flex items-center justify-between">
        <div className="flex-1 min-w-0">
          <p className="text-xs md:text-sm font-medium text-gray-600 dark:text-gray-400 truncate">{title}</p>
          <p className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mt-1 md:mt-2">
            {value} {unit && <span className="text-base md:text-lg text-gray-500">{unit}</span>}
          </p>
        </div>
        <div className={`p-2 md:p-3 rounded-full ${color} flex-shrink-0`}>
          <Icon size={20} className="text-white md:w-6 md:h-6" />
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-4 md:mb-6">
        <h1 className="text-xl md:text-2xl font-bold text-gray-900 dark:text-white mb-1 md:mb-2">
          {t('resourceOverview')}
        </h1>
        <p className="text-sm md:text-base text-gray-600 dark:text-gray-400">
          系统资源使用情况总览
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        <StatCard
          icon={Box}
          title="容器总数"
          value={stats.totalContainers}
          color="bg-blue-500"
        />
        <StatCard
          icon={Activity}
          title="运行中容器"
          value={stats.runningContainers}
          color="bg-green-500"
        />
        <StatCard
          icon={Cpu}
          title="CPU 使用"
          value={stats.totalCpuUsage.toFixed(1)}
          unit="核"
          color="bg-purple-500"
        />
        <StatCard
          icon={HardDrive}
          title="内存使用"
          value={(stats.totalMemoryUsage / 1024).toFixed(1)}
          unit="GB"
          color="bg-orange-500"
        />
        <StatCard
          icon={Server}
          title="存储使用"
          value={stats.totalStorage.toFixed(1)}
          unit="GB"
          color="bg-indigo-500"
        />
        <StatCard
          icon={TrendingUp}
          title="运行率"
          value={stats.totalContainers > 0
            ? ((stats.runningContainers / stats.totalContainers) * 100).toFixed(1)
            : 0
          }
          unit="%"
          color="bg-teal-500"
        />
      </div>

      <div className="mt-6 md:mt-8 bg-white dark:bg-gray-800 rounded-lg shadow p-4 md:p-6 border border-gray-200 dark:border-gray-700">
        <h2 className="text-base md:text-lg font-semibold text-gray-900 dark:text-white mb-3 md:mb-4">
          资源使用趋势
        </h2>
        <div className="text-sm md:text-base text-gray-600 dark:text-gray-400 text-center py-6 md:py-8">
          资源监控图表将在此处显示
        </div>
      </div>
    </div>
  );
}
