'use client';

import { useEffect, useState, useRef } from 'react';

export default function Home() {
  const [status, setStatus] = useState('Disconnected');
  const [delay, setDelay] = useState(2000);
  const [stateData, setStateData] = useState<any>(null);
  const [rejectNote, setRejectNote] = useState<Record<string, string>>({});
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    let ws: WebSocket;
    const connect = () => {
      ws = new WebSocket('ws://localhost:9000');
      wsRef.current = ws;
      ws.onopen = () => { setStatus('Connected'); setDelay(2000); };
      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'STATE_SYNC') setStateData(msg.data);
        } catch (e) {}
      };
      ws.onclose = () => {
        setStatus('Disconnected');
        setTimeout(connect, delay);
        setDelay(d => Math.min(d * 2, 30000));
      };
    };
    connect();
    return () => { if (ws) ws.close(); };
  }, [delay]);

  const approveRfa = (id: string) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({ type: 'APPROVE_RFA', data: { id } }));
    }
  };

  const rejectRfa = (id: string) => {
    if (wsRef.current?.readyState === 1) {
      wsRef.current.send(JSON.stringify({
        type: 'REJECT_RFA',
        data: { id, resolution_note: rejectNote[id] || '' }
      }));
      setRejectNote(prev => { const n = {...prev}; delete n[id]; return n; });
    }
  };

  const budgetPct = stateData?.project
    ? Math.min(100, Math.round((stateData.project.budget_used_usd / stateData.project.budget_cap_usd) * 100))
    : 0;

  const budgetBarColor = budgetPct >= 90 ? 'bg-red-500' : budgetPct >= 50 ? 'bg-yellow-500' : 'bg-green-500';
  const budgetTextColor = budgetPct >= 90 ? 'text-red-400' : budgetPct >= 50 ? 'text-yellow-400' : 'text-green-400';

  const formatUptime = (s: number) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    return h > 0 ? h + 'h ' + m + 'm' : m + 'm ' + (s % 60) + 's';
  };

  const taskStatusClass = (s: string) => {
    if (s === 'COMPLETED') return 'bg-green-900/50 text-green-400';
    if (s === 'RUNNING') return 'bg-blue-900/50 text-blue-400';
    if (s === 'FAILED') return 'bg-red-900/50 text-red-400';
    return 'bg-zinc-800 text-zinc-400';
  };

  const healthStatusColor = (s: string) => {
    if (s === 'WARNING') return 'text-yellow-400';
    if (s === 'CRITICAL') return 'text-red-400';
    return 'text-green-400';
  };

  return (
    <div className="flex min-h-screen flex-col items-center p-8 bg-zinc-950 text-white font-sans">
      <div className="w-full max-w-7xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-4xl font-bold">SPARK OS Dashboard</h1>
          <div className="flex items-center gap-4">
            {stateData?.hibernated && (
              <span className="px-3 py-1 bg-purple-900/50 text-purple-400 rounded text-sm font-bold">HIBERNATED</span>
            )}
            <div className="text-lg font-mono p-3 rounded bg-zinc-900 border border-zinc-800">{status}</div>
          </div>
        </div>

        {stateData && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
              <div className="p-4 bg-zinc-900 rounded border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-400 mb-2">BUDGET</h3>
                <div className="flex justify-between mb-1 text-sm">
                  <span>{'$'}{stateData.project?.budget_used_usd?.toFixed(2) || '0.00'} / {'$'}{stateData.project?.budget_cap_usd?.toFixed(2) || '0.00'}</span>
                  <span className={budgetTextColor}>{budgetPct}%</span>
                </div>
                <div className="w-full bg-zinc-800 rounded-full h-3">
                  <div className={budgetBarColor + ' h-3 rounded-full transition-all'} style={{ width: budgetPct + '%' }}></div>
                </div>
              </div>

              <div className="p-4 bg-zinc-900 rounded border border-zinc-800">
                <h3 className="text-sm font-bold text-zinc-400 mb-2">HEALTH</h3>
                <div className="grid grid-cols-4 gap-2 text-sm">
                  <div>
                    <span className="text-zinc-500">RSS</span>
                    <div className={'font-bold ' + healthStatusColor(stateData.health?.status || 'OK')}>
                      {stateData.health?.rss_mb || 0}MB
                    </div>
                  </div>
                  <div>
                    <span className="text-zinc-500">CPU</span>
                    <div className="font-bold">{stateData.health?.cpu_count || 0}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Tasks</span>
                    <div className="font-bold">{stateData.health?.active_tasks || 0}/{stateData.health?.max_concurrent_tasks || 0}</div>
                  </div>
                  <div>
                    <span className="text-zinc-500">Uptime</span>
                    <div className="font-bold">{formatUptime(stateData.uptime || 0)}</div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-1">
                <h2 className="text-2xl font-bold mb-4 border-b border-zinc-800 pb-2">Project Tasks</h2>
                {stateData.tasks.length === 0 ? (
                  <p className="text-zinc-500">No tasks</p>
                ) : (
                  <ul className="space-y-2">
                    {stateData.tasks.map((t: any) => (
                      <li key={t.id} className="p-3 bg-zinc-900 rounded border border-zinc-800">
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="font-bold mr-2 text-zinc-300">[{t.phase}]</span>
                            <span>{t.title}</span>
                          </div>
                          <span className={'text-xs px-2 py-1 rounded ' + taskStatusClass(t.status)}>
                            {t.status}
                          </span>
                        </div>
                        {t.token_cost_usd > 0 && (
                          <div className="text-xs text-zinc-500 mt-1">{'$'}{t.token_cost_usd.toFixed(4)}</div>
                        )}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div className="md:col-span-1">
                <h2 className="text-2xl font-bold mb-4 border-b border-zinc-800 pb-2">RFA Queue</h2>
                {stateData.rfas.length === 0 ? (
                  <p className="text-zinc-500">No pending RFAs</p>
                ) : (
                  <ul className="space-y-2">
                    {stateData.rfas.map((r: any) => (
                      <li key={r.id} className="p-3 bg-orange-900/20 rounded border border-orange-900/50">
                        <div className="text-orange-400 mb-2">{r.type}</div>
                        <div className="text-xs text-zinc-500 mb-2">ID: {r.id.substring(0, 8)}</div>
                        <input
                          type="text"
                          placeholder="Resolution note..."
                          className="w-full mb-2 px-2 py-1 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                          value={rejectNote[r.id] || ''}
                          onChange={(e) => setRejectNote(prev => ({...prev, [r.id]: e.target.value}))}
                        />
                        <div className="flex gap-2">
                          <button onClick={() => approveRfa(r.id)} className="px-3 py-1 bg-green-700 hover:bg-green-600 rounded text-sm font-bold transition-colors">Approve</button>
                          <button onClick={() => rejectRfa(r.id)} className="px-3 py-1 bg-red-700 hover:bg-red-600 rounded text-sm font-bold transition-colors">Reject</button>
                        </div>
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
                      let payload: any = {};
                      try { payload = JSON.parse(e.payload); } catch {}
                      return (
                        <li key={e.id} className="p-3 bg-zinc-900 rounded border border-zinc-800 text-sm">
                          <div className="font-bold text-zinc-300 mb-1">{e.type}</div>
                          {e.type === 'GIT_COMMIT' ? (
                            <div>
                              <span className="text-zinc-500 mr-2">{payload.hash?.substring(0, 7)}</span>
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

                {stateData.auditStats && (
                  <div className="mt-6 p-3 bg-zinc-900 rounded border border-zinc-800">
                    <h3 className="text-sm font-bold text-zinc-400 mb-1">AUDIT LOGS</h3>
                    <div className="text-sm text-zinc-500">
                      {stateData.auditStats.fileCount} files, {(stateData.auditStats.totalSizeBytes / 1024).toFixed(1)} KB
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        {stateData && stateData.rfas && stateData.rfas.length > 0 && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50">
            <div className="bg-zinc-900 border border-orange-900 p-6 rounded-lg w-[600px] max-w-full max-h-[80vh] overflow-y-auto shadow-2xl">
              <h3 className="text-2xl font-bold text-orange-400 mb-4">Request for Approval</h3>
              <div className="space-y-4">
                {stateData.rfas.map((rfa: any) => {
                  let payloadObj: any = {};
                  try { payloadObj = JSON.parse(rfa.payload); } catch (e) {}
                  return (
                    <div key={rfa.id} className="p-4 bg-black rounded border border-zinc-800">
                      <div className="font-bold mb-2">Task ID: <span className="font-mono text-sm">{rfa.task_id.substring(0, 8)}</span></div>
                      <div className="text-sm text-zinc-400 mb-2">Type: {rfa.type}</div>
                      <pre className="text-xs text-green-400 overflow-auto p-3 bg-zinc-950 rounded border border-zinc-800 whitespace-pre-wrap">
                        {JSON.stringify(payloadObj, null, 2)}
                      </pre>
                      <input
                        type="text"
                        placeholder="Resolution note..."
                        className="w-full mt-3 px-3 py-2 bg-zinc-900 border border-zinc-700 rounded text-sm text-white"
                        value={rejectNote[rfa.id] || ''}
                        onChange={(e) => setRejectNote(prev => ({...prev, [rfa.id]: e.target.value}))}
                      />
                      <div className="mt-3 flex gap-3">
                        <button onClick={() => approveRfa(rfa.id)} className="px-4 py-2 bg-green-600 hover:bg-green-500 rounded font-bold text-white shadow-lg transition-colors">Approve</button>
                        <button onClick={() => rejectRfa(rfa.id)} className="px-4 py-2 bg-red-600 hover:bg-red-500 rounded font-bold text-white shadow-lg transition-colors">Reject</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
