interface Props {
  logs: string;
}

export function ContainerLogs({ logs }: Props) {
  return (
    <div className="bg-gray-100 dark:bg-slate-950 text-gray-900 dark:text-slate-300 rounded-lg p-4 font-mono text-xs whitespace-pre-wrap overflow-auto max-h-96 border border-gray-300 dark:border-slate-700/50">
      {logs || '暂无日志'}
    </div>
  );
}
