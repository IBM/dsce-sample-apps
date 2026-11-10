import { useEffect, useState } from 'react';
import { Button, InlineLoading, InlineNotification, PasswordInput, TextInput, Tile } from '@carbon/react';
import { LogoGithub, Renew, Checkmark, TrashCan, Download } from '@carbon/icons-react';
import { Card, KeyValues, PageHeader } from '../components/PageHeader';
import { StatusTag } from '../components/StatusTag';
import { keys, useInvalidate, useMutation, useRepos } from '../hooks/queries';
import { useNotify } from '../hooks/useNotify';
import { api } from '../services/api';
import { formatDate } from '../services/format';
import { useWorkspace } from '../stores/workspace';
import type { RepoValidation } from '../types/api';

export function RepositoryPage() {
  const { data: repos } = useRepos();
  const invalidate = useInvalidate();
  const notify = useNotify();
  const activeId = useWorkspace((s) => s.activeRepositoryId);
  const setActive = useWorkspace((s) => s.setActiveRepository);

  const [url, setUrl] = useState('');
  const [branch, setBranch] = useState('main');
  const [token, setToken] = useState('');
  const [validation, setValidation] = useState<RepoValidation | null>(null);

  const items = repos?.items ?? [];
  const repo = items.find((r) => r.id === activeId) ?? items.find((r) => r.status === 'cloned') ?? items[0];

  // Reflect an existing repository in the form on first load only.
  const [seeded, setSeeded] = useState(false);
  useEffect(() => {
    if (!seeded && repo) {
      setUrl(repo.url);
      setBranch(repo.branch);
      setSeeded(true);
    }
  }, [repo, seeded]);

  const input = () => ({ url: url.trim(), branch: branch.trim() || 'main', ...(token ? { token } : {}) });

  const validate = useMutation({
    mutationFn: () => api.repos.validate(input()),
    onSuccess: (r) => {
      setValidation(r);
      notify.success('Repository is reachable', `${r.owner}/${r.name}@${r.branch}`);
    },
    onError: (e) => {
      setValidation(null);
      notify.error(e, 'Repository validation failed');
    }
  });
  const clone = useMutation({
    mutationFn: () => api.repos.clone(input()),
    onSuccess: (r) => {
      setToken('');
      setActive(r.id);
      invalidate(keys.repos);
      notify.info('Clone started', `${r.owner}/${r.name}`);
    },
    onError: (e) => notify.error(e, 'Could not start clone')
  });
  const reclone = useMutation({
    mutationFn: () => api.repos.reclone(repo!.id, { branch: branch.trim() || undefined, ...(token ? { token } : {}) }),
    onSuccess: (r) => {
      setToken('');
      setActive(r.id);
      invalidate(keys.repos);
      notify.info('Re-clone started', `${r.owner}/${r.name}`);
    },
    onError: (e) => notify.error(e, 'Could not start re-clone')
  });
  const remove = useMutation({
    mutationFn: () => api.repos.remove(repo!.id),
    onSuccess: () => {
      if (repo && repo.id === activeId) setActive(null);
      setValidation(null);
      invalidate(keys.repos);
      notify.info('Workspace cleared', 'The cloned repository was removed.');
    },
    onError: (e) => notify.error(e, 'Could not remove repository')
  });

  const cloning = repo?.status === 'cloning' || repo?.status === 'validating';
  const busy = validate.isPending || clone.isPending || reclone.isPending || remove.isPending || cloning;
  const hasUrl = url.trim().length > 0;

  return (
    <div>
      <PageHeader title="Repository Configuration" subtitle="Connect a GitHub repository. It is cloned by the backend into an isolated workspace; repository scripts are never executed." />
      <div className="grid-2">
        <Card title="GitHub repository" icon={<LogoGithub size={20} />}>
          <div className="form-stack">
            <TextInput id="repo-url" labelText="GitHub repository URL" placeholder="https://github.com/owner/repository" value={url} onChange={(e) => { setUrl(e.target.value); setValidation(null); }} />
            <TextInput id="repo-branch" labelText="Branch name" value={branch} onChange={(e) => setBranch(e.target.value)} />
            <PasswordInput
              id="repo-token"
              labelText="GitHub personal access token (optional)"
              autoComplete="new-password"
              showPasswordLabel="Show token"
              hidePasswordLabel="Hide token"
              helperText={repo?.hasToken ? 'A token is stored encrypted for this repository. Enter a new one to replace it.' : 'Only needed for private repositories. Stored encrypted, never logged.'}
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
            {validation && (
              <InlineNotification kind="success" lowContrast hideCloseButton title="Repository validated" subtitle={`${validation.owner}/${validation.name} · branch ${validation.branch} · ${validation.commit.slice(0, 12)}`} />
            )}
            <div className="actions">
              <Button kind="secondary" renderIcon={Checkmark} disabled={busy || !hasUrl} onClick={() => validate.mutate()}>
                Validate repository
              </Button>
              <Button renderIcon={Download} disabled={busy || !hasUrl} onClick={() => clone.mutate()}>
                Clone repository
              </Button>
              <Button kind="tertiary" renderIcon={Renew} disabled={busy || !repo} onClick={() => reclone.mutate()}>
                Re-clone repository
              </Button>
              <Button kind="danger--ghost" renderIcon={TrashCan} disabled={busy || !repo} onClick={() => remove.mutate()}>
                Remove workspace
              </Button>
            </div>
          </div>
        </Card>

        <Card title="Repository details">
          {!repo ? (
            <Tile>No repository configured yet. Enter a GitHub URL and clone it.</Tile>
          ) : (
            <div className="form-stack">
              <div className="row">
                <StatusTag status={repo.status} />
                {cloning && <InlineLoading description="Cloning in progress" />}
              </div>
              {repo.status === 'failed' && repo.error && <InlineNotification kind="error" lowContrast hideCloseButton title="Clone failed" subtitle={repo.error} />}
              <KeyValues
                rows={[
                  ['Repository name', `${repo.owner}/${repo.name}`],
                  ['Repository URL', repo.url],
                  ['Branch', repo.branch],
                  ['Clone status', repo.status],
                  ['Workspace', repo.workspaceLabel && <code>{repo.workspaceLabel}</code>],
                  ['Commit', repo.commit && <code>{repo.commit.slice(0, 12)}</code>],
                  ['Last cloned', formatDate(repo.lastClonedAt)],
                  ['Files', repo.fileCount ?? 'Not available'],
                  ['Access token', repo.hasToken ? 'Stored (encrypted)' : 'None']
                ]}
              />
              {repo.progress.length > 0 && (
                <div className="progress-lines" role="log" aria-label="Clone progress">
                  {repo.progress.map((l, i) => (
                    <div key={i}>{l}</div>
                  ))}
                </div>
              )}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
