import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Button, InlineLoading, InlineNotification, Modal, Select, SelectItem, Tag, TextArea, Tile } from '@carbon/react';
import { CheckmarkFilled, CircleDash, ErrorFilled, InProgress, Play, StopOutline, TrashCan, Reset, WarningFilled, Time } from '@carbon/icons-react';
import { Card, KeyValues, PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { LogViewer } from '../components/LogViewer';
import { PipelineTwin } from '../components/PipelineTwin';
import { keys, useBob, useExecution, useInvalidate, useMutation, usePrompts, useQse, useRepos, useSettings } from '../hooks/queries';
import { useExecutionStream } from '../hooks/useExecutionStream';
import { useNow } from '../hooks/useElapsed';
import { useNotify } from '../hooks/useNotify';
import { api } from '../services/api';
import { ACTIVE_STATUSES, formatDate, formatDuration } from '../services/format';
import { useWorkspace } from '../stores/workspace';
import type { ExecutionStep, StepStatus } from '../types/api';

const EXAMPLE_PROMPT =
  'Analyze this repository using QSE CLI. Identify cryptographic algorithms, libraries, APIs, and dependencies that may be vulnerable to future quantum computing threats. Generate a detailed quantum-safe assessment, identify potential remediation opportunities, and provide an end-to-end report with findings and recommendations.';

const TEMPLATES: Array<{ id: string; label: string; text: string }> = [
  { id: 'full', label: 'Full quantum-safe assessment', text: EXAMPLE_PROMPT },
  {
    id: 'inventory',
    label: 'Cryptographic inventory only',
    text: 'Use QSE CLI to build an inventory of the cryptographic algorithms, key sizes, libraries and APIs used in this repository. Report each item with the file and line evidence. Do not modify any files.'
  },
  {
    id: 'remediation',
    label: 'Remediation plan',
    text: 'Run a QSE CLI analysis of this repository, then propose a prioritised post-quantum cryptography migration plan. For each finding describe the affected code, the recommended replacement algorithm and the dependency changes required. Do not modify any files.'
  },
  {
    id: 'deps',
    label: 'Dependency review',
    text: 'Review the dependencies and third-party libraries of this repository for cryptographic functionality that may be affected by quantum computing. Use QSE CLI where applicable and list the packages that require upgrading or replacing.'
  }
];

function StepIcon({ status }: { status: StepStatus }) {
  switch (status) {
    case 'completed':
      return <CheckmarkFilled size={20} style={{ fill: 'var(--cds-support-success)' }} aria-label="Completed" />;
    case 'failed':
      return <ErrorFilled size={20} style={{ fill: 'var(--cds-support-error)' }} aria-label="Failed" />;
    case 'running':
      return <InProgress size={20} style={{ fill: 'var(--cds-support-info)' }} aria-label="Running" />;
    case 'cancelled':
    case 'skipped':
      return <WarningFilled size={20} style={{ fill: 'var(--cds-support-warning)' }} aria-label={status} />;
    default:
      return <CircleDash size={20} aria-label="Pending" />;
  }
}

function StepRow({ step }: { step: ExecutionStep }) {
  return (
    <li>
      <StepIcon status={step.status} />
      <div>
        <div>{step.label}</div>
        <div className="step-source">{step.source === 'headless-bob' ? 'Headless Bob' : 'Workbench backend'}</div>
        {step.message && <div className="msg">{step.message}</div>}
      </div>
      <StatusTag status={step.status} size="sm" />
    </li>
  );
}

export function WorkspacePage() {
  const { executionId } = useParams();
  const navigate = useNavigate();
  const notify = useNotify();
  const invalidate = useInvalidate();

  const { data: bob } = useBob();
  const { data: qse } = useQse();
  const { data: repos } = useRepos();
  const { data: settings } = useSettings();
  const { data: promptHistory } = usePrompts();

  const activeRepoId = useWorkspace((s) => s.activeRepositoryId);
  const setActiveRepo = useWorkspace((s) => s.setActiveRepository);
  const activeExecId = useWorkspace((s) => s.activeExecutionId);
  const setActiveExec = useWorkspace((s) => s.setActiveExecution);
  const prompt = useWorkspace((s) => s.promptDraft);
  const setPrompt = useWorkspace((s) => s.setPromptDraft);

  const viewId = executionId ?? activeExecId;
  useEffect(() => {
    if (executionId && executionId !== activeExecId) setActiveExec(executionId);
  }, [executionId, activeExecId, setActiveExec]);

  const cloned = repos?.items.filter((r) => r.status === 'cloned') ?? [];
  const repo = cloned.find((r) => r.id === activeRepoId) ?? cloned[0];

  const { data: fetched } = useExecution(viewId);
  const stream = useExecutionStream(viewId);
  const execution = stream.execution ?? fetched ?? null;
  const [persistedLogs, setPersistedLogs] = useState<typeof stream.logs>([]);
  const isActive = !!execution && ACTIVE_STATUSES.includes(execution.status);

  // When opening a finished execution there may be no live stream data; the SSE endpoint replays
  // persisted logs, but keep a REST fallback so logs are visible even if SSE is blocked.
  useEffect(() => {
    setPersistedLogs([]);
    if (!viewId) return;
    let cancelled = false;
    api.executions
      .logs(viewId)
      .then((r) => !cancelled && setPersistedLogs(r.items))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [viewId, execution?.status]);
  const logs = stream.logs.length >= persistedLogs.length ? stream.logs : persistedLogs;

  const now = useNow(isActive);
  const elapsed = execution?.startedAt ? (execution.finishedAt ? new Date(execution.finishedAt).getTime() : now) - new Date(execution.startedAt).getTime() : null;

  const maxChars = settings?.limits.maxPromptChars ?? 20000;
  const [confirmClear, setConfirmClear] = useState(false);

  const checks = useMemo(
    () => [
      { ok: bob?.state === 'connected', label: 'Headless Bob is connected', fix: '/bob' },
      { ok: !!repo, label: 'Repository is cloned', fix: '/repository' },
      { ok: qse?.status === 'valid' && qse.reachableFromBob, label: 'QSE CLI is validated and reachable from Bob', fix: '/qse' },
      { ok: prompt.trim().length > 0 && prompt.length <= maxChars, label: 'Prompt is provided', fix: undefined }
    ],
    [bob?.state, repo, qse?.status, qse?.reachableFromBob, prompt, maxChars]
  );
  const ready = checks.every((c) => c.ok) && !isActive;

  const start = useMutation({
    mutationFn: () => api.executions.create({ repositoryId: repo!.id, prompt: prompt.trim() }),
    onSuccess: (e) => {
      setActiveRepo(repo!.id);
      setActiveExec(e.id);
      invalidate(['executions'], keys.prompts);
      navigate(`/workspace/${e.id}`, { replace: true });
    },
    onError: (e) => notify.error(e, 'Could not start execution')
  });
  const cancel = useMutation({
    mutationFn: () => api.executions.cancel(execution!.id),
    onSuccess: () => notify.info('Cancellation requested', 'Headless Bob will stop the run if its API allows it.'),
    onError: (e) => notify.error(e, 'Could not cancel')
  });
  const clearRepo = useMutation({
    mutationFn: async () => {
      if (repo) await api.repos.remove(repo.id);
    },
    onSuccess: () => {
      setPrompt('');
      setActiveExec(null);
      setActiveRepo(null);
      setConfirmClear(false);
      invalidate(keys.repos);
      navigate('/workspace', { replace: true });
      notify.info('Workspace cleared', 'Prompt, current view and cloned repository were removed. History is preserved.');
    },
    onError: (e) => {
      setConfirmClear(false);
      notify.error(e, 'Could not clear workspace');
    }
  });

  const plannedSteps = execution?.steps ?? [];
  const backendSteps = plannedSteps.filter((s) => s.source === 'backend');
  const bobSteps = plannedSteps.filter((s) => s.source === 'headless-bob');
  const failedSteps = plannedSteps.filter((s) => s.status === 'failed').length;
  const doneSteps = plannedSteps.filter((s) => s.status === 'completed').length;

  return (
    <div>
      <PageHeader title="Execution Workspace" subtitle="Describe the task, then run it. The backend prepares the context and submits it to Headless Bob; progress below comes from real execution events." />

      <Card title="Execution context">
        <div className="grid-4">
          <KeyValues rows={[['Headless Bob', bob ? <StatusTag key="b" status={bob.state} size="sm" /> : '…'], ['Protocol', bob?.adapter]]} />
          <KeyValues rows={[['Repository', repo ? `${repo.owner}/${repo.name}` : 'None cloned'], ['Branch', repo?.branch], ['Clone status', repo ? <StatusTag key="r" status={repo.status} size="sm" /> : 'Not cloned']]} />
          <KeyValues rows={[['QSE CLI', qse ? <StatusTag key="q" status={qse.status} size="sm" /> : '…'], ['QSE version', qse?.version]]} />
          <div>
            {cloned.length > 1 && (
              <Select id="ws-repo" labelText="Repository" size="sm" value={repo?.id ?? ''} onChange={(e) => setActiveRepo(e.target.value)}>
                {cloned.map((r) => (
                  <SelectItem key={r.id} value={r.id} text={`${r.owner}/${r.name}@${r.branch}`} />
                ))}
              </Select>
            )}
          </div>
        </div>
      </Card>

      <div className="section" />
      <Card
        title="What would you like Headless Bob to do?"
        help="Describe the analysis, implementation or assessment. Repository, branch and QSE CLI references are added automatically."
      >
        <div className="form-stack prompt-area">
          <div className="grid-2">
            <Select
              id="prompt-template"
              labelText="Prompt template"
              size="sm"
              value=""
              onChange={(e) => {
                const t = TEMPLATES.find((x) => x.id === e.target.value);
                if (t) setPrompt(t.text);
              }}
            >
              <SelectItem value="" text="Insert a template…" />
              {TEMPLATES.map((t) => (
                <SelectItem key={t.id} value={t.id} text={t.label} />
              ))}
            </Select>
            <Select
              id="prompt-history"
              labelText="Prompt history"
              size="sm"
              value=""
              disabled={!promptHistory?.items.length}
              onChange={(e) => {
                const h = promptHistory?.items.find((x) => String(x.id) === e.target.value);
                if (h) setPrompt(h.prompt);
              }}
            >
              <SelectItem value="" text={promptHistory?.items.length ? 'Reuse a previous prompt…' : 'No previous prompts'} />
              {promptHistory?.items.map((h) => (
                <SelectItem key={h.id} value={String(h.id)} text={`${formatDate(h.createdAt)} — ${h.prompt.replace(/\s+/g, ' ').slice(0, 70)}`} />
              ))}
            </Select>
          </div>
          <TextArea
            id="prompt"
            labelText="What would you like Headless Bob to do?"
            hideLabel
            rows={10}
            maxCount={maxChars}
            enableCounter
            placeholder="Describe the analysis, implementation, or quantum-safe assessment you want Headless Bob to perform on the cloned repository..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={isActive}
            invalid={prompt.length > maxChars}
            invalidText={`Prompt exceeds the ${maxChars.toLocaleString()} character limit.`}
          />
          <div className="row">
            <Button kind="ghost" size="sm" renderIcon={Reset} onClick={() => setPrompt(EXAMPLE_PROMPT)} disabled={isActive}>
              Reset to example
            </Button>
            <Button kind="ghost" size="sm" onClick={() => setPrompt('')} disabled={isActive || !prompt}>
              Clear
            </Button>
          </div>
        </div>
      </Card>

      <div className="section" />
      <Card title="Execution controls">
        <ul className="step-list" aria-label="Pre-flight checks">
          {checks.map((c) => (
            <li key={c.label}>
              {c.ok ? <CheckmarkFilled size={20} style={{ fill: 'var(--cds-support-success)' }} aria-label="Ready" /> : <CircleDash size={20} aria-label="Not ready" />}
              <div>{c.label}</div>
              {!c.ok && c.fix ? <Link to={c.fix}>Fix</Link> : <span />}
            </li>
          ))}
        </ul>
        <div className="actions">
          <Button renderIcon={Play} disabled={!ready || start.isPending} onClick={() => start.mutate()}>
            {start.isPending ? 'Starting…' : 'Start execution'}
          </Button>
          <Button kind="danger--tertiary" renderIcon={StopOutline} disabled={!isActive || execution?.status === 'cancelling' || cancel.isPending} onClick={() => cancel.mutate()}>
            Cancel execution
          </Button>
          <Button kind="ghost" renderIcon={TrashCan} disabled={isActive || clearRepo.isPending} onClick={() => setConfirmClear(true)}>
            Clear workspace
          </Button>
        </div>
      </Card>

      <div className="section" />
      <Card title="Pipeline digital twin" help="A live model of the execution pipeline and the systems it uses. It updates from real step events and connection status.">
        <PipelineTwin execution={execution} bob={bob} repo={repo} qse={qse} streamMode={settings?.streamMode} />
      </Card>

      {execution && (
        <>
          <div className="section" />
          <Card
            title="Execution monitor"
            icon={<Time size={20} />}
            actions={
              execution.status === 'completed' && execution.reportId ? (
                <Button as={Link} to={`/reports/${execution.id}`} size="sm">
                  View report
                </Button>
              ) : undefined
            }
          >
            <div className="grid-2">
              <KeyValues
                rows={[
                  ['Execution ID', <code key="id">{execution.id}</code>],
                  ['Status', <StatusTag key="s" status={execution.status} />],
                  ['Started', formatDate(execution.startedAt)],
                  ['Elapsed', formatDuration(elapsed)],
                  ['Current activity', execution.currentActivity ?? (isActive ? 'Working…' : '—')],
                  ['Steps', `${doneSteps} of ${plannedSteps.length} completed${failedSteps ? `, ${failedSteps} failed` : ''}`],
                  ['Live updates', isActive ? (stream.connected ? 'Connected' : 'Reconnecting…') : 'Not streaming']
                ]}
              />
              <div>
                {isActive && <InlineLoading description={execution.currentActivity ?? 'Execution in progress'} />}
                {execution.status === 'failed' && execution.error && <InlineNotification kind="error" lowContrast hideCloseButton title="Execution failed" subtitle={execution.error} />}
                {execution.status === 'cancelled' && <InlineNotification kind="warning" lowContrast hideCloseButton title="Execution cancelled" />}
                {execution.warnings.map((w, i) => (
                  <InlineNotification key={i} kind="warning" lowContrast hideCloseButton title="Warning" subtitle={w} />
                ))}
              </div>
            </div>

            <div className="section" />
            <div className="grid-2">
              <div>
                <h4 style={{ marginBottom: '0.5rem' }}>
                  Workbench preparation <Tag size="sm" type="blue">backend</Tag>
                </h4>
                <ol className="step-list">
                  {backendSteps.map((s) => (
                    <StepRow key={s.key} step={s} />
                  ))}
                </ol>
              </div>
              <div>
                <h4 style={{ marginBottom: '0.5rem' }}>
                  Headless Bob execution <Tag size="sm" type="purple">headless-bob</Tag>
                </h4>
                <ol className="step-list">
                  {bobSteps.map((s) => (
                    <StepRow key={s.key} step={s} />
                  ))}
                </ol>
                <p className="step-source" style={{ marginTop: '0.5rem' }}>
                  Headless Bob does not report percentage progress, so none is shown. {execution.bobStreamedChars > 0 && `${execution.bobStreamedChars.toLocaleString()} characters streamed so far.`}
                </p>
              </div>
            </div>

            <div className="section" />
            <h4 style={{ marginBottom: '0.5rem' }}>Execution logs</h4>
            <LogViewer logs={logs} live={isActive && stream.connected} />
          </Card>
        </>
      )}

      {!execution && (
        <>
          <div className="section" />
          <Tile>No execution selected. Start one above, or open a previous one from Execution History.</Tile>
        </>
      )}

      <Modal
        open={confirmClear}
        modalHeading="Clear workspace?"
        modalLabel="Execution Workspace"
        primaryButtonText={clearRepo.isPending ? 'Clearing…' : 'Clear workspace'}
        secondaryButtonText="Keep"
        danger
        primaryButtonDisabled={clearRepo.isPending}
        onRequestClose={() => setConfirmClear(false)}
        onRequestSubmit={() => clearRepo.mutate()}
      >
        <p>This clears the prompt, the current execution view and deletes the cloned repository from the isolated workspace. Execution history and reports are kept.</p>
      </Modal>
    </div>
  );
}
