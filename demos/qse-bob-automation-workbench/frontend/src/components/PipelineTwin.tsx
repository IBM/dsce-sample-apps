import type { BobConnection, Execution, ExecutionStep, QseConfig, Repository, StepStatus } from '../types/api';

/**
 * Digital twin of the execution pipeline: a live diagram of the Workbench steps and the external
 * systems they touch (Git repository, QSE CLI, Headless Bob). It is a pure view of data the UI already
 * has (execution steps and the Bob / repository / QSE status). It never invents progress.
 */

type Tone = 'ok' | 'active' | 'error' | 'warn' | 'idle';

const STEP_W = 108;
const STEP_H = 76;
const GAP = 24;
const PAD = 12;
const EXT_Y = 16;
const EXT_H = 60;
const STEP_Y = 150;

const DEFAULT_STEPS: Array<Pick<ExecutionStep, 'key' | 'label' | 'source'>> = [
  { key: 'validate_config', label: 'Validate config', source: 'backend' },
  { key: 'prepare_repo', label: 'Prepare repository', source: 'backend' },
  { key: 'validate_qse', label: 'Validate QSE CLI', source: 'backend' },
  { key: 'prepare_context', label: 'Prepare context', source: 'backend' },
  { key: 'submit_prompt', label: 'Submit prompt', source: 'backend' },
  { key: 'bob_processing', label: 'Bob processing', source: 'headless-bob' },
  { key: 'retrieve_results', label: 'Retrieve results', source: 'backend' },
  { key: 'generate_report', label: 'Generate report', source: 'backend' }
];

// Short two-line labels that fit a node; unknown step keys fall back to the label from the backend.
const SHORT: Record<string, [string, string]> = {
  validate_config: ['Validate', 'config'],
  prepare_repo: ['Prepare', 'repository'],
  validate_qse: ['Validate', 'QSE CLI'],
  prepare_context: ['Prepare', 'context'],
  submit_prompt: ['Submit', 'prompt'],
  bob_processing: ['Bob', 'processing'],
  retrieve_results: ['Retrieve', 'results'],
  generate_report: ['Generate', 'report']
};

const STEP_TONE: Record<StepStatus, Tone> = { pending: 'idle', running: 'active', completed: 'ok', failed: 'error', skipped: 'warn', cancelled: 'warn' };
const STEP_TEXT: Record<StepStatus, string> = { pending: 'Pending', running: 'Running', completed: 'Completed', failed: 'Failed', skipped: 'Skipped', cancelled: 'Cancelled' };

function shortLabel(step: Pick<ExecutionStep, 'key' | 'label'>): [string, string] {
  if (SHORT[step.key]) return SHORT[step.key];
  const words = step.label.split(' ');
  const mid = Math.ceil(words.length / 2);
  return [words.slice(0, mid).join(' ').slice(0, 16), words.slice(mid).join(' ').slice(0, 16)];
}

function stepDuration(step: ExecutionStep | undefined): string {
  if (!step?.startedAt || !step.finishedAt) return '';
  const ms = new Date(step.finishedAt).getTime() - new Date(step.startedAt).getTime();
  if (!Number.isFinite(ms) || ms < 0) return '';
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(1)} s`;
}

interface External {
  id: string;
  title: string;
  detail: string;
  tone: Tone;
  state: string;
  /** Step keys this system is connected to. */
  steps: string[];
  width: number;
}

export interface PipelineTwinProps {
  execution: Execution | null;
  bob?: BobConnection;
  repo?: Repository;
  qse?: QseConfig;
  streamMode?: 'mock' | 'realtime';
}

export function buildExternals(p: Pick<PipelineTwinProps, 'bob' | 'repo' | 'qse' | 'streamMode'>): External[] {
  const demo = p.streamMode === 'mock';
  const git: External = {
    id: 'git',
    title: 'Git repository',
    detail: p.repo ? `${p.repo.owner}/${p.repo.name}` : 'none cloned',
    tone: p.repo?.status === 'cloned' ? 'ok' : p.repo?.status === 'failed' ? 'error' : 'idle',
    state: p.repo ? (p.repo.status === 'cloned' ? 'Cloned' : p.repo.status === 'failed' ? 'Failed' : 'Not ready') : 'Not cloned',
    steps: ['prepare_repo'],
    width: 112
  };
  const cli: External = {
    id: 'qse',
    title: 'QSE CLI',
    detail: p.qse?.version ?? (demo ? 'recorded' : 'not validated'),
    tone: p.qse?.status === 'valid' ? 'ok' : p.qse?.status === 'invalid' ? 'error' : 'idle',
    state: p.qse?.status === 'valid' ? 'Valid' : p.qse?.status === 'invalid' ? 'Invalid' : 'Not validated',
    steps: ['validate_qse'],
    width: 112
  };
  const bobTone: Tone = p.bob?.state === 'connected' ? 'ok' : p.bob?.state === 'auth_failed' || p.bob?.state === 'connection_failed' ? 'error' : 'idle';
  const bob: External = {
    id: 'bob',
    title: 'Headless Bob',
    detail: p.bob?.mock ? 'recorded (demo)' : (p.bob?.adapter ?? 'not configured'),
    tone: bobTone,
    state: p.bob?.state === 'connected' ? 'Connected' : p.bob?.state === 'auth_failed' ? 'Auth failed' : p.bob?.state === 'connection_failed' ? 'Unreachable' : 'Not connected',
    steps: ['submit_prompt', 'bob_processing'],
    width: 172
  };
  return [git, cli, bob];
}

export function PipelineTwin({ execution, bob, repo, qse, streamMode }: PipelineTwinProps) {
  const planned = execution?.steps?.length ? execution.steps : DEFAULT_STEPS.map((s) => ({ ...s, status: 'pending' as StepStatus, startedAt: null, finishedAt: null, message: null }));
  const n = planned.length;
  const width = PAD * 2 + n * STEP_W + (n - 1) * GAP;
  const stepX = (i: number) => PAD + i * (STEP_W + GAP);
  const indexOf = (key: string) => planned.findIndex((s) => s.key === key);
  const externals = buildExternals({ bob, repo, qse, streamMode });

  const running = planned.find((s) => s.status === 'running');
  const summary = `Pipeline digital twin. ${planned.map((s) => `${shortLabel(s).join(' ')}: ${STEP_TEXT[s.status]}`).join('; ')}. ${externals.map((e) => `${e.title}: ${e.state}`).join('; ')}.`;

  return (
    <div className="twin" data-testid="pipeline-twin">
      <svg viewBox={`0 0 ${width} 252`} role="img" aria-label={summary} className="twin-svg">
        <title>{summary}</title>
        <defs>
          <marker id="twin-arrow" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="6" markerHeight="6" orient="auto">
            <path d="M0 0 L8 4 L0 8 z" className="twin-arrowhead" />
          </marker>
        </defs>

        {/* flow between steps */}
        {planned.slice(0, -1).map((s, i) => {
          const done = s.status === 'completed';
          return <line key={`f-${s.key}`} x1={stepX(i) + STEP_W} y1={STEP_Y + STEP_H / 2} x2={stepX(i + 1) - 1} y2={STEP_Y + STEP_H / 2} className={`twin-flow${done ? ' twin-flow--done' : ''}`} markerEnd="url(#twin-arrow)" />;
        })}

        {/* external systems and their links to steps */}
        {externals.map((ext) => {
          const idx = ext.steps.map(indexOf).filter((i) => i >= 0);
          if (!idx.length) return null;
          const cx = idx.reduce((sum, i) => sum + stepX(i) + STEP_W / 2, 0) / idx.length;
          const x = cx - ext.width / 2;
          return (
            <g key={ext.id} className={`twin-node twin-node--${ext.tone}`} data-testid={`twin-ext-${ext.id}`}>
              {idx.map((i) => {
                const linked = planned[i];
                const live = linked.status === 'running';
                return <line key={`${ext.id}-${linked.key}`} x1={cx} y1={EXT_Y + EXT_H} x2={stepX(i) + STEP_W / 2} y2={STEP_Y} className={`twin-link${live ? ' twin-link--live' : ''}`} />;
              })}
              <rect x={x} y={EXT_Y} width={ext.width} height={EXT_H} rx={2} className="twin-rect twin-rect--ext" />
              <text x={cx} y={EXT_Y + 20} textAnchor="middle" className="twin-title">{ext.title}</text>
              <text x={cx} y={EXT_Y + 37} textAnchor="middle" className="twin-sub">{ext.detail.slice(0, 26)}</text>
              <text x={cx} y={EXT_Y + 53} textAnchor="middle" className="twin-state">{ext.state}</text>
            </g>
          );
        })}

        {/* pipeline steps */}
        {planned.map((s, i) => {
          const [l1, l2] = shortLabel(s);
          const x = stepX(i);
          const dur = stepDuration(s as ExecutionStep);
          return (
            <g key={s.key} className={`twin-node twin-node--${STEP_TONE[s.status]}`} data-testid={`twin-step-${s.key}`}>
              <rect x={x} y={STEP_Y} width={STEP_W} height={STEP_H} rx={2} className="twin-rect" />
              <rect x={x} y={STEP_Y} width={4} height={STEP_H} className="twin-bar" />
              <text x={x + STEP_W / 2 + 2} y={STEP_Y + 22} textAnchor="middle" className="twin-title">{l1}</text>
              <text x={x + STEP_W / 2 + 2} y={STEP_Y + 38} textAnchor="middle" className="twin-title">{l2}</text>
              <text x={x + STEP_W / 2 + 2} y={STEP_Y + 56} textAnchor="middle" className="twin-state">{STEP_TEXT[s.status]}</text>
              {dur && <text x={x + STEP_W / 2 + 2} y={STEP_Y + 69} textAnchor="middle" className="twin-sub">{dur}</text>}
              <text x={x + STEP_W / 2} y={STEP_Y + STEP_H + 16} textAnchor="middle" className="twin-src">{s.source === 'headless-bob' ? 'headless-bob' : 'backend'}</text>
            </g>
          );
        })}
      </svg>
      <p className="step-source twin-note">
        {running ? `Now: ${running.label}. ` : ''}
        Built only from real step events and connection status; no percentage is shown because Headless Bob does not report one.
        {(execution?.mock || streamMode === 'mock') && ' DEMO: this twin replays a recorded run.'}
      </p>
    </div>
  );
}
