// 网页终端Tab组件，提供基于WebSocket的浏览器内SSH终端功能
// Author: Zhengde Zhang (zhangzhengde0225@gmail.com)
import TtyTerminal from '../../../../../../components/Terminal';

interface Props {
  containerId: number;
  token: string;
  status: string;
}

export function WebTerminal({ containerId, token, status }: Props) {
  if (status !== 'running') {
    return (
      <div className="bg-gray-100 dark:bg-slate-950 rounded-lg p-8 text-center text-gray-600 dark:text-slate-400 text-sm">
        容器运行中才能打开终端
      </div>
    );
  }
  return <TtyTerminal containerId={containerId} token={token} />;
}
