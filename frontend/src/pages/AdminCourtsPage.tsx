import { useEffect, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { createCourt, deleteCourt, getCourts, getUsers, updateCourt, updateCourtAssistants } from '../lib/api';
import type { AdminUser, Court, CourtPayload } from '../types';

const initial: CourtPayload = { name: '', address: '', city: 'Ciudad de Buenos Aires', provinceName: 'Buenos Aires', active: true };

export function AdminCourtsPage() {
  const [items, setItems] = useState<Court[]>([]);
  const [assistants, setAssistants] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<CourtPayload>(initial);
  const [assistantIds, setAssistantIds] = useState<number[]>([]);
  const [editing, setEditing] = useState<Court | null>(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const load = () => getCourts(search || undefined).then(setItems).catch((reason: Error) => setError(reason.message));

  useEffect(() => { load(); getUsers().then((users) => setAssistants(users.filter((user) => user.role === 'ASSISTANT'))).catch((reason: Error) => setError(reason.message)); }, []);
  const close = () => { setOpen(false); setEditing(null); setForm(initial); setAssistantIds([]); };
  const edit = (item: Court) => { setEditing(item); setForm({ name: item.name, address: item.address ?? '', city: item.city ?? '', provinceName: item.provinceName ?? '', active: item.active }); setAssistantIds(item.assistantIds ?? []); setOpen(true); };
  const toggleAssistant = (id: number) => setAssistantIds((current) => current.includes(id) ? current.filter((value) => value !== id) : [...current, id]);
  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    try {
      const court = editing ? await updateCourt(editing.id, form) : await createCourt(form);
      await updateCourtAssistants(court.id, assistantIds);
      close();
      load();
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la cancha.'); }
  };
  const remove = async (item: Court) => { if (!window.confirm(`Se eliminara ${item.name}.`)) return; try { await deleteCourt(item.id); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la cancha.'); } };

  return <div className="admin-panel"><div className="panel-header"><div><p className="eyebrow">ABM</p><h1>Canchas</h1></div><button className="primary-button" onClick={() => { setForm(initial); setAssistantIds([]); setOpen(true); }}>Agregar cancha</button></div><div className="toolbar"><input placeholder="Buscar cancha o ciudad" value={search} onChange={(event) => setSearch(event.target.value)} /><button className="secondary-button" onClick={load}>Buscar</button></div>{error && <div className="inline-state">{error}</div>}<section className="data-card"><AdminDataGrid rows={items} onEdit={edit} onDelete={remove} emptyMessage="No hay canchas cargadas." columns={[{ label: 'Cancha', render: (item) => <strong>{item.name}</strong> }, { label: 'Direccion', render: (item) => item.address ?? '-' }, { label: 'Ciudad', render: (item) => item.city ?? '-' }, { label: 'Asistentes', render: (item) => item.assistants?.length ? item.assistants.map((assistant) => assistant.name).join(', ') : '-' }, { label: 'Estado', render: (item) => <span className={`status-chip ${item.active ? 'status-live' : 'status-draft'}`}>{item.active ? 'Activa' : 'Inactiva'}</span> }]} /></section>{open && <AdminDialog title={editing ? 'Editar cancha' : 'Nueva cancha'} onClose={close}><form className="editor-form" onSubmit={save}><label>Nombre<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Direccion<input value={form.address ?? ''} onChange={(event) => setForm({ ...form, address: event.target.value })} /></label><label>Ciudad<input value={form.city ?? ''} onChange={(event) => setForm({ ...form, city: event.target.value })} /></label><label>Provincia<input value={form.provinceName ?? ''} onChange={(event) => setForm({ ...form, provinceName: event.target.value })} /></label><div className="span-2"><span className="field-label">Encargados / asistentes asignados</span><div className="checkbox-list">{assistants.length ? assistants.map((assistant) => <label className="checkbox-row" key={assistant.id}><input type="checkbox" checked={assistantIds.includes(assistant.id)} onChange={() => toggleAssistant(assistant.id)} />{assistant.name} <span>({assistant.email})</span></label>) : <p className="field-hint">Primero crea usuarios con el rol Encargado / Asistente.</p>}</div></div><label className="checkbox-row span-2"><input type="checkbox" checked={form.active ?? true} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Cancha activa</label><div className="span-2 form-actions"><button className="primary-button">Guardar</button></div></form></AdminDialog>}</div>;
}
