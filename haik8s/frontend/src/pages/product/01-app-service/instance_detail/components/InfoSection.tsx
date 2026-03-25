export function InfoSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-50 dark:bg-slate-950/60 border border-gray-200 dark:border-slate-700/40 rounded-lg p-4">
      <h4 className="text-xs font-semibold text-gray-600 dark:text-slate-400 uppercase tracking-wide mb-3">
        {title}
      </h4>
      <div className="space-y-2">{children}</div>
    </div>
  );
}

export function InfoRow({
  label,
  value,
  mono = false,
}: {
  label: string | React.ReactNode;
  value: string | React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2">
      <span className="text-xs text-gray-500 dark:text-slate-500 w-24 flex-shrink-0 pt-0.5">
        {label}
      </span>
      {typeof value === 'string' ? (
        <span className={`text-xs text-gray-900 dark:text-slate-200 break-all ${mono ? 'font-mono' : ''}`}>
          {value}
        </span>
      ) : (
        <div className="text-xs text-gray-900 dark:text-slate-200 break-all">{value}</div>
      )}
    </div>
  );
}
