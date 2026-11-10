import { useState } from 'react';
import { Button, InlineLoading, InlineNotification, RadioButton, RadioButtonGroup, StructuredListBody, StructuredListCell, StructuredListHead, StructuredListRow, StructuredListWrapper, Tag, TextInput, Tile } from '@carbon/react';
import { Chip, Renew, Search } from '@carbon/icons-react';
import { useQuery } from '@tanstack/react-query';
import { Card, KeyValues, PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { keys, useInvalidate, useMutation, useQse } from '../hooks/queries';
import { useNotify } from '../hooks/useNotify';
import { api } from '../services/api';
import { formatDate } from '../services/format';

export function QsePage() {
  const { data: qse, isLoading } = useQse();
  const invalidate = useInvalidate();
  const notify = useNotify();
  const [mode, setMode] = useState<'auto' | 'manual'>('auto');
  const [manualPath, setManualPath] = useState('');
  const [selected, setSelected] = useState<string | null>(null);

  const discovery = useQuery({ queryKey: keys.qseDiscover, queryFn: api.qse.discover, enabled: mode === 'auto' });

  const configure = useMutation({
    mutationFn: () => api.qse.configure(mode === 'manual' ? { mode, path: manualPath.trim() } : { mode, ...(selected ? { path: selected } : {}) }),
    onSuccess: (r) => {
      invalidate(keys.qse);
      if (r.status === 'valid') notify.success('QSE CLI validated', r.version ? `Version ${r.version}` : undefined);
      else notify.error(new Error(r.message ?? 'Validation failed'), 'QSE CLI is not usable');
    },
    onError: (e) => notify.error(e, 'Could not configure QSE CLI')
  });
  const validate = useMutation({
    mutationFn: api.qse.validate,
    onSuccess: (r) => {
      invalidate(keys.qse);
      if (r.status === 'valid') notify.success('QSE CLI revalidated', r.version ? `Version ${r.version}` : undefined);
      else notify.error(new Error(r.message ?? 'Validation failed'), 'QSE CLI is not usable');
    },
    onError: (e) => notify.error(e, 'Validation failed')
  });

  const busy = configure.isPending || validate.isPending;
  const candidates = discovery.data?.candidates ?? [];

  return (
    <div>
      <PageHeader title="QSE Configuration" subtitle="Locate and validate the QSE CLI. It must be reachable from the container where Headless Bob executes, so it is exposed through the shared CLI volume." />
      <div className="grid-2">
        <Card title="Locate QSE CLI" icon={<Chip size={20} />}>
          <div className="form-stack">
            <RadioButtonGroup legendText="Configuration method" name="qse-mode" valueSelected={mode} onChange={(v) => setMode(v as 'auto' | 'manual')}>
              <RadioButton id="qse-auto" labelText="Automatic discovery (QSE_CLI_PATH, PATH, configured directories)" value="auto" />
              <RadioButton id="qse-manual" labelText="Manual — absolute path to the executable" value="manual" />
            </RadioButtonGroup>

            {mode === 'manual' ? (
              <TextInput
                id="qse-path"
                labelText="QSE CLI executable path"
                placeholder="/opt/qse-cli/qse-cli"
                helperText="Must be an absolute path to an allowed executable (default names: qse-cli, cli.sh)."
                value={manualPath}
                onChange={(e) => setManualPath(e.target.value)}
              />
            ) : (
              <div>
                <div className="row" style={{ marginBottom: '0.5rem' }}>
                  <strong>Discovered candidates</strong>
                  <span className="spacer" />
                  <Button kind="ghost" size="sm" renderIcon={Search} onClick={() => void discovery.refetch()} disabled={discovery.isFetching}>
                    Run discovery
                  </Button>
                </div>
                {discovery.isFetching && <InlineLoading description="Searching" />}
                {!discovery.isFetching && candidates.length === 0 && (
                  <Tile>
                    No QSE CLI found{discovery.data?.searched.envPath ? ` (QSE_CLI_PATH=${discovery.data.searched.envPath})` : ''}. Install it into the shared CLI volume or use manual configuration.
                  </Tile>
                )}
                {candidates.length > 0 && (
                  <StructuredListWrapper selection aria-label="Discovered QSE CLI candidates">
                    <StructuredListHead>
                      <StructuredListRow head>
                        <StructuredListCell head>Path</StructuredListCell>
                        <StructuredListCell head>Source</StructuredListCell>
                        <StructuredListCell head>Usable</StructuredListCell>
                      </StructuredListRow>
                    </StructuredListHead>
                    <StructuredListBody>
                      {candidates.map((c, i) => {
                        const usable = c.allowed && c.executable;
                        return (
                          <StructuredListRow key={c.path} onClick={() => usable && setSelected(c.path)}>
                            <StructuredListCell>
                              <input
                                type="radio"
                                name="qse-candidate"
                                id={`cand-${i}`}
                                aria-label={c.path}
                                disabled={!usable}
                                checked={(selected ?? candidates.find((x) => x.allowed && x.executable)?.path) === c.path}
                                onChange={() => setSelected(c.path)}
                              />{' '}
                              <code>{c.path}</code>
                            </StructuredListCell>
                            <StructuredListCell>{c.source}</StructuredListCell>
                            <StructuredListCell>{usable ? <Tag type="green">Executable</Tag> : <Tag type="gray">{c.allowed ? 'Not executable' : 'Name not allowed'}</Tag>}</StructuredListCell>
                          </StructuredListRow>
                        );
                      })}
                    </StructuredListBody>
                  </StructuredListWrapper>
                )}
              </div>
            )}

            <div className="actions">
              <Button onClick={() => configure.mutate()} disabled={busy || (mode === 'manual' ? !manualPath.trim() : candidates.filter((c) => c.allowed && c.executable).length === 0)}>
                {configure.isPending ? 'Validating…' : mode === 'manual' ? 'Save and validate' : 'Use selected and validate'}
              </Button>
              <Button kind="secondary" renderIcon={Renew} onClick={() => validate.mutate()} disabled={busy || !qse?.executablePath}>
                {qse?.status === 'valid' ? 'Revalidate' : 'Validate QSE CLI'}
              </Button>
            </div>
          </div>
        </Card>

        <Card title="QSE CLI status">
          {isLoading || !qse ? (
            <InlineLoading description="Loading" />
          ) : (
            <div className="form-stack">
              <div className="row">
                <StatusTag status={validate.isPending || configure.isPending ? 'validating' : qse.status} />
              </div>
              {qse.status === 'invalid' && qse.message && <InlineNotification kind="error" lowContrast hideCloseButton title="Validation failed" subtitle={qse.message} />}
              {qse.status === 'valid' && !qse.reachableFromBob && (
                <InlineNotification
                  kind="warning"
                  lowContrast
                  hideCloseButton
                  title="Not reachable from Headless Bob"
                  subtitle="This path is outside the shared CLI volume, so Headless Bob cannot execute it. Place the CLI under the shared mount."
                />
              )}
              {qse.status === 'valid' && qse.message && <p className="step-source">{qse.message}</p>}
              <KeyValues
                rows={[
                  ['Executable path', qse.executablePath && <code>{qse.executablePath}</code>],
                  ['Path in Bob container', qse.bobVisiblePath && <code>{qse.bobVisiblePath}</code>],
                  ['Detected version', qse.version],
                  ['Version command', <code key="v">{qse.versionArgs.join(' ')}</code>],
                  ['Method', qse.mode],
                  ['Validated', formatDate(qse.validatedAt)],
                  ['Execution strategy', qse.strategy]
                ]}
              />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
