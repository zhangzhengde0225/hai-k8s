import { useEffect, useRef } from 'react';
import { Terminal as XTerm } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import '@xterm/xterm/css/xterm.css';

interface Props {
  containerId: number;
  token: string;
}

export default function Terminal({ containerId, token }: Props) {
  const termRef = useRef<HTMLDivElement>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const xtermRef = useRef<XTerm | null>(null);

  useEffect(() => {
    if (!termRef.current) return;

    const term = new XTerm({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: 'Menlo, Monaco, "Courier New", monospace',
      theme: {
        background: '#1e1e1e',
        foreground: '#d4d4d4',
      },
    });
    const fitAddon = new FitAddon();
    term.loadAddon(fitAddon);
    term.open(termRef.current);
    fitAddon.fit();
    xtermRef.current = term;

    // WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/containers/${containerId}/terminal?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      // Send initial resize
      const dims = fitAddon.proposeDimensions();
      if (dims) {
        ws.send(JSON.stringify({ type: 'resize', rows: dims.rows, cols: dims.cols }));
      }
    };

    ws.onmessage = (event) => {
      term.write(event.data);
    };

    ws.onclose = () => {
      term.write('\r\n[Connection closed]\r\n');
    };

    ws.onerror = () => {
      term.write('\r\n[Connection error]\r\n');
    };

    // Forward terminal input to WebSocket
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });

    // Handle resize
    const handleResize = () => {
      fitAddon.fit();
      const dims = fitAddon.proposeDimensions();
      if (dims && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', rows: dims.rows, cols: dims.cols }));
      }
    };
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      ws.close();
      term.dispose();
    };
  }, [containerId, token]);

  return (
    <div
      ref={termRef}
      className="w-full h-[500px] rounded-lg overflow-hidden border border-gray-700"
    />
  );
}
