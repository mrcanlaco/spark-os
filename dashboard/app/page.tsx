'use client';

import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [status, setStatus] = useState('🔴 Disconnected');
  const [delay, setDelay] = useState(2000);
  const [stateData, setStateData] = useState<any>(null);
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    
    const connect = () => {
      ws = new WebSocket('ws://localhost:9000');
      wsRef.current = ws;
      
      ws.onopen = () => {
        setStatus('🟢 Connected to SPARK Daemon');
        setDelay(2000);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_SYNC') {
            setStateData(msg.data);
          }
        } catch (e) {}
      };

      ws.onclose = () => {
        setStatus('🔴 Disconnected');
        setTimeout(connect, delay);
        setDelay(d => Math.min(d * 2, 30000));
      };
    };

    connect();
    
    return () => {
      if (ws) ws.close();
    };
  }, [delay]);

  const approveRfa = (id: string) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'APPROVE_RFA', data: { id } }));
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-zinc-950 text-white font-sans">
      <h1 className="text-4xl font-bold mb-4">SPARK OS Dashboard</h1>
      <div className="text-xl font-mono p-4 rounded bg-zinc-900 border border-zinc-800 mb-8">{status}</div>
      
      {stateData && (
        <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <h2 className="text-2xl font-bold mb-4 border-b border-zinc-800 pb-2">Project Tasks</h2>
            {stateData.tasks.length === 0 ? (
              <p className="text-zinc-500">No tasks</p>
            ) : (
              <ul className="space-y-2">
                {stateData.tasks.map((t: any) => (
                  <li key={t.id} className="p-3 bg-zinc-900 rounded border border-zinc-800 flex justify-between items-center">
                    <div>
                      <span className="font-bold mr-2 text-zinc-300">[{t.phase}]</span>
                      <span>{t.title}</span>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${
                      t.status === 'COMPLETED' ? 'bg-green-900/50 text-green-400' :
                      t.status === 'RUNNING' ? 'bg-blue-900/50 text-blue-400' :
                      t.status === 'FAILED' ? 'bg-red-900/50 text-red-400' :
                      'bg-zinc-800 text-zinc-400'
                    }`}>
                      {t.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="md:col-span-1">
            <h2 className="text-2xl font-bold mb-4 border-b border-zinc-800 pb-2">RFA Queue (Pending)</h2>
            {stateData.rfas.length === 0 ? (
              <p className="text-zinc-500">No pending RFAs</p>
            ) : (
              <ul className="space-y-2">
                {stateData.rfas.map((r: any) => (
                  <li key={r.id} className="p-3 bg-orange-900/20 rounded border border-orange-900/50 text-orange-400">
                    ⚠️ {r.type} (ID: {r.id})
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="md:col-span-1">
            <h2 className="text-2xl font-bold mb-4 border-b border-zinc-800 pb-2">Recent Events</h2>
            {!stateData.events || stateData.events.length === 0 ? (
              <p className="text-zinc-500">No events</p>
            ) : (
              <ul className="space-y-2">
                {stateData.events.map((e: any) => {
                  const payload = JSON.parse(e.payload);
                  return (
                    <li key={e.id} className="p-3 bg-zinc-900 rounded border border-zinc-800 text-sm">
                      <div className="font-bold text-zinc-300 mb-1">{e.type}</div>
                      {e.type === 'GIT_COMMIT' ? (
                        <div>
                          <span className="text-zinc-500 mr-2">{payload.hash.substring(0, 7)}</span>
                          <span>{payload.message}</span>
                        </div>
                      ) : (
                        <div className="text-zinc-500 break-words">{e.payload}</div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* RFA Popup */}
      {stateData && stateData.rfas && stateData.rfas.length > 0 && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
          <div className="bg-zinc-900 border border-orange-900 p-6 rounded-lg w-[600px] max-w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <h3 className="text-2xl font-bold text-orange-400 mb-4">⚠️ Request for Approval</h3>
            <div className="space-y-4">
              {stateData.rfas.map((rfa: any) => {
                let payloadObj = {};
                try { payloadObj = JSON.parse(rfa.payload); } catch (e) {}
                return (
                  <div key={rfa.id} className="p-4 bg-black rounded border border-zinc-800">
                    <div className="font-bold mb-2">Task ID: <span className="font-mono text-sm">{rfa.task_id.substring(0, 8)}</span></div>
                    <div className="text-sm text-zinc-400 mb-2">Type: {rfa.type}</div>
                    <pre className="text-xs text-green-400 overflow-auto p-3 bg-zinc-950 rounded border border-zinc-800 whitespace-pre-wrap">
                      {JSON.stringify(payloadObj, null, 2)}
                    </pre>
                    {/* Approve logic is in Cycle 4b, just UI for now */}
                    <div className="mt-4 flex gap-3">
                      <button onClick={() => approveRfa(rfa.id)} className="px-4 py-2 bg-orange-600 hover:bg-orange-500 rounded font-bold text-white shadow-lg transition-colors">Approve</button>
                      <button className="px-4 py-2 bg-zinc-800 hover:bg-zinc-700 rounded text-zinc-300 transition-colors">Reject</button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
