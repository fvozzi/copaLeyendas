import { useCallback, useEffect, useRef, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { createBackup, downloadBackup, getBackups, updateBackupSettings } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { BackupOverview, BackupSettings, DatabaseBackup } from '../types';

const dateTime = (value: string) => new Intl.DateTimeFormat('es-AR', { timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short' }).format(new Date(value));
const statusLabels = { RUNNING: 'En curso', SUCCESS: 'Completado', FAILED: 'Fallido' };

export function AdminBackupsPage() {
  const { user } = useAuth();
  const director = user?.role === 'DIRECTOR';
  const [overview, setOverview] = useState<BackupOverview | null>(null);
  const [draft, setDraft] = useState<BackupSettings>({ enabled: true, retentionCount: 30, scheduleHour: 3, scheduleMinute: 0 });
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const creatingRef = useRef(false);
  const load = useCallback(async (initialize = false) => {
    const result = await getBackups();
    setOverview(result);
    if (initialize) setDraft({ enabled: result.enabled, retentionCount: result.retentionCount, scheduleHour: result.scheduleHour, scheduleMinute: result.scheduleMinute });
  }, []);
  useEffect(() => {
    if (!director) return;
    void load(true).catch((reason: Error) => setError(reason.message));
    const timer = window.setInterval(() => { void load().catch((reason: Error) => setError(reason.message)); }, 5000);
    return () => window.clearInterval(timer);
  }, [director, load]);
  const running = creating || overview?.backups.some((backup) => backup.status === 'RUNNING');

  const run = async () => {
    if (creatingRef.current || running) return;
    creatingRef.current = true; setCreating(true); setError(null); setNotice(null);
    try { await createBackup(); setNotice('Backup iniciado. Podés seguir trabajando mientras se genera.'); await load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo iniciar el backup.'); }
    finally { creatingRef.current = false; setCreating(false); }
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setError(null); setNotice(null);
    try { setOverview(await updateBackupSettings(draft)); setNotice('Configuración guardada.'); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la configuración.'); }
    finally { setSaving(false); }
  };
  const download = async (backup: DatabaseBackup) => {
    setDownloading(backup.id); setError(null);
    try { await downloadBackup(backup); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo descargar el backup.'); }
    finally { setDownloading(null); }
  };
  if (!director) return <Navigate to="/app" replace />;

  return <div className="admin-panel">
    <div className="panel-header"><div><p className="eyebrow">Administración</p><h1>Backups</h1></div><button className="primary-button" disabled={!overview || Boolean(running)} onClick={() => void run()}>{running ? 'Backup en curso…' : 'Crear backup ahora'}</button></div>
    <p>Copias de la base de datos de Copa Leyendas. No incluyen los archivos de fotos ni los comprobantes.</p>
    {error ? <div className="inline-state" role="alert">{error}</div> : null}
    {notice ? <div className="inline-state" role="status">{notice}</div> : null}
    {!overview ? <p>Cargando configuración…</p> : <>
      <section className="data-card"><h2>Backup diario</h2><p>Horario de Argentina. Se conservan las últimas {overview.retentionCount} copias completadas; las anteriores se eliminan al completar un nuevo backup.</p>
        <form className="editor-form" onSubmit={save}>
          <label className="checkbox-row"><input type="checkbox" checked={draft.enabled} onChange={(event) => setDraft({ ...draft, enabled: event.target.checked })} />Activar backup diario</label>
          <label>Hora de ejecución<input type="time" required value={`${String(draft.scheduleHour).padStart(2, '0')}:${String(draft.scheduleMinute).padStart(2, '0')}`} onChange={(event) => { const [scheduleHour, scheduleMinute] = event.target.value.split(':').map(Number); setDraft({ ...draft, scheduleHour, scheduleMinute }); }} /></label>
          <label>Copias a conservar<input type="number" min="1" max="365" required value={draft.retentionCount} onChange={(event) => setDraft({ ...draft, retentionCount: Number(event.target.value) })} /></label>
          <div className="form-actions span-2"><button className="secondary-button" disabled={saving}>{saving ? 'Guardando…' : 'Guardar configuración'}</button></div>
        </form>
      </section>
      <section className="data-card"><h2>Historial de backups</h2><AdminDataGrid rows={overview.backups} emptyMessage="Todavía no hay backups. Podés crear el primero ahora." columns={[
        { label: 'Fecha y hora', render: (backup) => dateTime(backup.startedAt), sortValue: (backup) => new Date(backup.startedAt).getTime() },
        { label: 'Origen', render: (backup) => backup.triggerType === 'MANUAL' ? `Manual · ${backup.createdByName ?? 'Dirección'}` : 'Diario automático' },
        { label: 'Estado', render: (backup) => <div>{statusLabels[backup.status]}{backup.errorMessage ? <p className="field-error">{backup.errorMessage}</p> : null}</div> },
        { label: 'Tamaño', render: (backup) => backup.fileSizeBytes === null ? '—' : `${(backup.fileSizeBytes / 1024 / 1024).toFixed(2)} MB` },
      ]} renderActions={(backup) => <button className="inline-link" disabled={!backup.canDownload || downloading !== null} onClick={() => void download(backup)}>{downloading === backup.id ? 'Descargando…' : 'Descargar'}</button>} /></section>
    </>}
  </div>;
}
