import { useEffect, useMemo, useRef, useState } from 'react';
import { Checkbox, Dropdown } from '@carbon/react';
import type { ExecutionLog } from '../types/api';
import { formatTime } from '../services/format';

const SOURCES = [
  { id: 'all', label: 'All sources' },
  { id: 'backend', label: 'Workbench backend' },
  { id: 'headless-bob', label: 'Headless Bob' },
  { id: 'system', label: 'System' }
];

export function LogViewer({ logs, live }: { logs: ExecutionLog[]; live: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [follow, setFollow] = useState(true);
  const [source, setSource] = useState('all');
  const visible = useMemo(() => (source === 'all' ? logs : logs.filter((l) => l.source === source)), [logs, source]);

  useEffect(() => {
    if (follow && ref.current) ref.current.scrollTop = ref.current.scrollHeight;
  }, [visible.length, follow]);

  return (
    <div>
      <div className="row" style={{ marginBottom: '0.75rem' }}>
        <div style={{ minWidth: '14rem' }}>
          <Dropdown
            id="log-source"
            titleText=""
            label="Source"
            size="sm"
            items={SOURCES}
            itemToString={(i: { label: string } | null) => i?.label ?? ''}
            selectedItem={SOURCES.find((s) => s.id === source)}
            onChange={({ selectedItem }) => setSource(SOURCES.find((s) => s.label === selectedItem?.label)?.id ?? "all")}
          />
        </div>
        <Checkbox id="log-follow" labelText="Follow" checked={follow} onChange={(_, { checked }) => setFollow(checked)} />
        <span className="spacer" />
        <span className="step-source">{visible.length} lines{live ? ' · live' : ''}</span>
      </div>
      <div className="log-view" ref={ref} role="log" aria-live="off" tabIndex={0} aria-label="Execution logs">
        {visible.length === 0 && <div className="step-source">No log output yet.</div>}
        {visible.map((l) => (
          <div key={l.id} className={`log-line ${l.level}`}>
            <span className="ts">{formatTime(l.ts)}</span>
            <span className={`src-${l.source}`}>{l.source === 'headless-bob' ? 'bob' : l.source}</span>
            <span className="msg">{l.message}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
