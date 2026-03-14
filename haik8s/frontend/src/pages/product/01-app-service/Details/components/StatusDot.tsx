import { getMeta } from '../constants';

export function StatusDot({ status }: { status: string }) {
  const { dot } = getMeta(status);
  return <span className={`inline-block w-2.5 h-2.5 rounded-full flex-shrink-0 ${dot}`} />;
}
