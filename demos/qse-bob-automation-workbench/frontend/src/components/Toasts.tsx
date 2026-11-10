import { ToastNotification } from '@carbon/react';
import { useToasts } from '../stores/notifications';

export function Toasts() {
  const { toasts, dismiss } = useToasts();
  return (
    <div style={{ position: 'fixed', top: '3.5rem', right: '1rem', zIndex: 9100, display: 'grid', gap: '0.5rem' }} aria-live="polite">
      {toasts.map((t) => (
        <ToastNotification key={t.id} kind={t.kind} title={t.title} subtitle={t.subtitle} timeout={0} lowContrast onClose={() => { dismiss(t.id); return false; }} />
      ))}
    </div>
  );
}
