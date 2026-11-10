import type { ReactNode } from 'react';

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div>
        <h1 className="page-title">{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      <div className="spacer" />
      {actions}
    </div>
  );
}

export function Card({ title, icon, help, children, actions }: { title?: string; icon?: ReactNode; help?: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <section className="card">
      {title && (
        <div className="card-title">
          {icon}
          <span>{title}</span>
          <span className="spacer" />
          {actions}
        </div>
      )}
      {help && <p className="card-help">{help}</p>}
      {children}
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'ok' | 'bad' | 'warn' | 'info' }) {
  return (
    <div className={`stat ${tone ?? ''}`}>
      <div className="label">{label}</div>
      <div className="value">{value}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}

export function KeyValues({ rows }: { rows: Array<[string, ReactNode]> }) {
  return (
    <dl className="kv">
      {rows.map(([k, v]) => (
        <div key={k} style={{ display: 'contents' }}>
          <dt>{k}</dt>
          <dd>{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  );
}
