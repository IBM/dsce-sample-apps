import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Button, InlineNotification, Modal, PasswordInput, Tag, Tile } from '@carbon/react';
import { Card, KeyValues, PageHeader } from '../components/PageHeader';
import { keys, useInvalidate, useMutation, useSettings } from '../hooks/queries';
import { useNotify } from '../hooks/useNotify';
import { api } from '../services/api';
import { formatBytes, formatDuration } from '../services/format';
import { useSession } from '../stores/session';

export function SettingsPage() {
  const user = useSession((s) => s.user);
  const setSession = useSession((s) => s.setSession);
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { data: s } = useSettings();
  const notify = useNotify();
  const invalidate = useInvalidate();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [rotateOpen, setRotateOpen] = useState(false);

  const mismatch = confirm.length > 0 && next !== confirm;
  const change = useMutation({
    mutationFn: () => api.auth.changePassword(current, next),
    onSuccess: () => {
      setCurrent('');
      setNext('');
      setConfirm('');
      // The server revokes every session of this user, including this one.
      setSession(null, null);
      qc.clear();
      navigate('/login', { replace: true });
      notify.success('Password changed', 'All sessions were signed out. Sign in with the new password.');
    },
    onError: (e) => notify.error(e, 'Could not change password')
  });
  const rotate = useMutation({
    mutationFn: api.settings.rotateSecrets,
    onSuccess: (r) => {
      setRotateOpen(false);
      invalidate(keys.settings);
      notify.success('Secrets re-encrypted', `Active key ${r.activeKeyId}; Bob key ${r.bobApiKeyReencrypted ? 'rotated' : 'not stored'}; ${r.repositoryTokensReencrypted} repository token(s).`);
    },
    onError: (e) => {
      setRotateOpen(false);
      notify.error(e, 'Rotation failed');
    }
  });

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (current && next.length >= 12 && !mismatch) change.mutate();
  };

  return (
    <div>
      <PageHeader title="Settings" subtitle="Effective server configuration (read-only; set through environment variables) and account security." />
      <div className="grid-2">
        <Card title="Server configuration" help="Values come from the backend environment. Internal paths are not shown.">
          {!s ? (
            <Tile>Loading…</Tile>
          ) : (
            <KeyValues
              rows={[
                ['Version', s.version],
                ['Execution strategy', s.executionStrategy],
                ['Prompt limit', `${s.limits.maxPromptChars.toLocaleString()} characters`],
                ['Execution timeout', formatDuration(s.limits.executionTimeoutMs)],
                ['Concurrent executions', s.limits.maxConcurrentExecutions],
                ['Allowed Git hosts', s.githubAllowedHosts.join(', ')],
                ['Session lifetime', `${s.session.ttlMinutes} min (idle ${s.session.idleMinutes} min)`],
                ['Encryption key ID', s.encryptionKeyId],
                ['Stream mode', s.streamMode === 'mock' ? <Tag key="m" type="magenta">mock — demo, recorded data</Tag> : <Tag key="m" type="green">realtime — live Headless Bob</Tag>]
              ]}
            />
          )}
        </Card>

        <Card title="Shared execution environment" help="Headless Bob cannot see the Workbench filesystem. These shared volumes are mounted in both containers.">
          {s?.sharedMounts.length ? (
            <KeyValues rows={s.sharedMounts.map((m) => [m.label, <code key={m.label}>{m.bobPath}</code>] as [string, React.ReactNode])} />
          ) : (
            <Tile>No shared mounts configured.</Tile>
          )}
          <p className="step-source" style={{ marginTop: '1rem' }}>
            Paths shown are as seen from the Headless Bob container.
          </p>
        </Card>
      </div>

      <div className="section" />
      <div className="grid-2">
        <Card title="Change password" help={`Signed in as ${user?.username} (${user?.role}).`}>
          <form className="form-stack" onSubmit={onSubmit} aria-label="Change password">
            <PasswordInput id="pw-current" labelText="Current password" autoComplete="current-password" value={current} onChange={(e) => setCurrent(e.target.value)} />
            <PasswordInput id="pw-new" labelText="New password" autoComplete="new-password" helperText="At least 12 characters." value={next} onChange={(e) => setNext(e.target.value)} />
            <PasswordInput id="pw-confirm" labelText="Confirm new password" autoComplete="new-password" invalid={mismatch} invalidText="Passwords do not match." value={confirm} onChange={(e) => setConfirm(e.target.value)} />
            <Button type="submit" disabled={change.isPending || !current || next.length < 12 || next !== confirm}>
              {change.isPending ? 'Changing…' : 'Change password'}
            </Button>
          </form>
        </Card>

        <Card title="Credential rotation" help="Re-encrypts the stored Bob API key and repository tokens with the active encryption key (SECRETS_KEYS).">
          {user?.role === 'admin' ? (
            <>
              <p className="step-source">
                To rotate: add a new key to <code>SECRETS_KEYS</code> as the first entry, restart the backend, then run this. Replace the Bob API key itself on the Bob Connection page.
              </p>
              <div className="actions">
                <Button kind="tertiary" onClick={() => setRotateOpen(true)}>
                  Re-encrypt stored secrets
                </Button>
              </div>
            </>
          ) : (
            <InlineNotification kind="info" lowContrast hideCloseButton title="Administrator only" subtitle="Ask an administrator to rotate stored credentials." />
          )}
        </Card>
      </div>

      <Modal
        open={rotateOpen}
        modalHeading="Re-encrypt stored secrets?"
        primaryButtonText={rotate.isPending ? 'Working…' : 'Re-encrypt'}
        secondaryButtonText="Cancel"
        primaryButtonDisabled={rotate.isPending}
        onRequestClose={() => setRotateOpen(false)}
        onRequestSubmit={() => rotate.mutate()}
      >
        <p>All stored credentials will be decrypted and re-encrypted with the active key. No secret values are displayed.</p>
      </Modal>
    </div>
  );
}
