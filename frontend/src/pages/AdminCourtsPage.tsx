import { useEffect, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { createVenue, deleteVenue, getUsers, getVenues, updateVenue, updateVenueLeaders } from '../lib/api';
import type { AdminUser, Venue, VenuePayload } from '../types';

const initial: VenuePayload = { name: '', address: '', city: 'Ciudad de Buenos Aires', provinceName: 'Buenos Aires', startsAt: '10:00', matchDurationMinutes: 40, matchesPerDay: 16, active: true };

export function AdminCourtsPage() {
  const [items, setItems] = useState<Venue[]>([]);
  const [leaders, setLeaders] = useState<AdminUser[]>([]);
  const [leaderIds, setLeaderIds] = useState<number[]>([]);
  const [form, setForm] = useState<VenuePayload>(initial);
  const [editing, setEditing] = useState<Venue | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => getVenues().then(setItems).catch((reason: Error) => setError(reason.message));

  useEffect(() => {
    load();
    getUsers().then((users) => setLeaders(users.filter((user) => user.role === 'COURT_LEADER' || user.role === 'ASSISTANT'))).catch((reason: Error) => setError(reason.message));
  }, []);

  const close = (force = false) => {
    if (saving && !force) return;
    setOpen(false); setEditing(null); setForm(initial); setLeaderIds([]); setModalError(null);
  };
  const edit = (item: Venue) => {
    setModalError(null); setEditing(item); setLeaderIds(item.leaderIds ?? []);
    setForm({ name: item.name, address: item.address ?? '', city: item.city ?? '', provinceName: item.provinceName ?? '', startsAt: item.startsAt.slice(0, 5), matchDurationMinutes: item.matchDurationMinutes, matchesPerDay: item.matchesPerDay, active: item.active });
    setOpen(true);
  };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setModalError(null); setSaving(true);
    try {
      const saved = editing ? await updateVenue(editing.id, form) : await createVenue(form);
      await updateVenueLeaders(saved.id, leaderIds);
      close(true); await load();
    } catch (reason) {
      setModalError(reason instanceof Error ? reason.message : 'No se pudo guardar la sede.');
    } finally {
      setSaving(false);
    }
  };
  const remove = async (item: Venue) => {
    if (!window.confirm(`Se eliminará ${item.name}.`)) return;
    try { await deleteVenue(item.id); load(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la sede.'); }
  };

  return <div className="admin-panel">
    <div className="panel-header"><div><p className="eyebrow">ABM</p><h1>Sedes</h1></div><button className="primary-button" onClick={() => { setModalError(null); setForm(initial); setLeaderIds([]); setOpen(true); }}>Agregar sede</button></div>
    <p className="field-hint">Cada sede puede tener uno o más líderes responsables de todas sus canchas y partidos.</p>
    {error && <div className="inline-state">{error}</div>}
    <section className="data-card"><AdminDataGrid rows={items} emptyMessage="No hay sedes cargadas." columns={[
      { label: 'Sede', render: (item) => <strong>{item.name}</strong> },
      { label: 'Líderes', render: (item) => item.leaders?.map((leader) => leader.name).join(', ') || 'Sin asignar' },
      { label: 'Horario inicial', render: (item) => item.startsAt.slice(0, 5) },
      { label: 'Duración', render: (item) => `${item.matchDurationMinutes} min.` },
      { label: 'Partidos por cancha/día', render: (item) => item.matchesPerDay },
      { label: 'Ciudad', render: (item) => item.city ?? '-' },
      { label: 'Estado', render: (item) => <span className={`status-chip ${item.active ? 'status-live' : 'status-draft'}`}>{item.active ? 'Activa' : 'Inactiva'}</span> },
    ]} renderActions={(item) => <><button className="inline-link" onClick={() => edit(item)}>Editar</button><button className="danger-link" onClick={() => remove(item)}>Eliminar</button></>} /></section>
    {open && <AdminDialog title={editing ? 'Editar sede' : 'Nueva sede'} onClose={close}><form className="editor-form" onSubmit={save}>
      {modalError && <div className="inline-state span-2" role="alert">{modalError}</div>}
      <label>Nombre de la sede<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
      <label>Horario de inicio<input type="time" value={form.startsAt ?? '10:00'} onChange={(event) => setForm({ ...form, startsAt: event.target.value })} required /></label>
      <label>Duración por partido (minutos)<input type="number" min="1" max="240" value={form.matchDurationMinutes ?? 40} onChange={(event) => setForm({ ...form, matchDurationMinutes: Number(event.target.value) })} required /></label>
      <label>Partidos por cancha/día<input type="number" min="1" max="200" value={form.matchesPerDay ?? 16} onChange={(event) => setForm({ ...form, matchesPerDay: Number(event.target.value) })} required /></label>
      <small className="field-hint span-2">El Programa usará estos valores para calcular los horarios de cada cancha de esta sede en cada día de juego.</small>
      <label>Dirección<input value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label>
      <label>Ciudad<input value={form.city ?? ''} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label>
      <label>Provincia<input value={form.provinceName ?? ''} onChange={(event) => setForm({ ...form, provinceName: event.target.value })} /></label>
      <fieldset className="span-2 court-leader-field"><legend>Líderes responsables de la sede</legend>{leaders.length ? leaders.map((leader) => <label className="checkbox-row" key={leader.id}><input type="checkbox" checked={leaderIds.includes(leader.id)} onChange={(event) => setLeaderIds((current) => event.target.checked ? [...current, leader.id] : current.filter((id) => id !== leader.id))} />{leader.name} · {leader.email}</label>) : <p className="field-hint">Primero creá usuarios con perfil Líder de sede.</p>}</fieldset>
      <label className="checkbox-row"><input type="checkbox" checked={form.active ?? true} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Sede activa</label>
      <div className="span-2 form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Guardar sede'}</button></div>
    </form></AdminDialog>}
  </div>;
}
