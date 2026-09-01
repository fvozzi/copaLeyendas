import type { ReactNode } from 'react';

interface AdminDialogProps { title: string; children: ReactNode; onClose: () => void; }

export function AdminDialog({ title, children, onClose }: AdminDialogProps) {
  return (
    <div className="admin-dialog-backdrop" role="presentation" onMouseDown={onClose}>
      <section className="admin-dialog" role="dialog" aria-modal="true" aria-label={title} onMouseDown={(event) => event.stopPropagation()}>
        <div className="admin-dialog-header"><h2>{title}</h2><button type="button" className="ghost-button dialog-close" onClick={onClose}>Cerrar</button></div>
        {children}
      </section>
    </div>
  );
}
