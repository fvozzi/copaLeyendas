import { useEffect, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { createUser, deleteUser, getUsers, updateUser } from '../lib/api';
import type { AdminUser, AdminUserPayload } from '../types';

const initialForm: AdminUserPayload = { name: '', email: '', password: '', role: 'COURT_LEADER' };

export function AdminUsersPage() {
  const [items, setItems] = useState<AdminUser[]>([]);
  const [form, setForm] = useState<AdminUserPayload>(initialForm);
  const [editing, setEditing] = useState<AdminUser | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalError, setModalError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const load = () => getUsers().then(setItems).catch((reason: Error) => setError(reason.message));
  useEffect(() => { load(); }, []);
  const close = (force = false) => { if (saving && !force) return; setOpen(false); setEditing(null); setForm(initialForm); setModalError(null); };
  const edit = (item: AdminUser) => { setEditing(item); setForm({ name: item.name, email: item.email, password: '', role: item.role === 'DIRECTOR' ? 'DIRECTOR' : 'COURT_LEADER' }); setModalError(null); setOpen(true); };
  const save = async (event: React.FormEvent) => {
    event.preventDefault(); setSaving(true); setModalError(null);
    try {
      const payload = editing && !form.password ? { ...form, password: undefined } : form;
      if (editing) await updateUser(editing.id, payload); else await createUser(payload);
      close(true); await load();
    } catch (reason) { setModalError(reason instanceof Error ? reason.message : 'No se pudo guardar el usuario.'); }
    finally { setSaving(false); }
  };
  const remove = async (item: AdminUser) => { if (!window.confirm(`Se eliminará el usuario ${item.name}.`)) return; try { await deleteUser(item.id); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar el usuario.'); } };
  return <div className="admin-panel"><div className="panel-header"><div><p className="eyebrow">ACCESOS</p><h1>Usuarios</h1></div><button className="primary-button" onClick={() => { setForm(initialForm); setModalError(null); setOpen(true); }}>Agregar usuario</button></div>{error && <div className="inline-state">{error}</div>}<section className="data-card"><AdminDataGrid rows={items} onEdit={edit} onDelete={remove} emptyMessage="No hay usuarios cargados." columns={[{ label: 'Nombre', render: (item) => <strong>{item.name}</strong> }, { label: 'Email', render: (item) => item.email }, { label: 'Rol', render: (item) => <span className={`status-chip ${item.role === 'DIRECTOR' ? 'status-live' : 'status-draft'}`}>{item.role === 'DIRECTOR' ? 'Director' : 'Líder de cancha'}</span> }]} /></section>{open && <AdminDialog title={editing ? 'Editar usuario' : 'Nuevo usuario'} onClose={() => close()}><form className="editor-form" onSubmit={save}>{modalError && <div className="inline-state span-2" role="alert">{modalError}</div>}<label>Nombre<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label><label>Email<input type="email" value={form.email} onChange={(event) => setForm({ ...form, email: event.target.value })} required /></label><label>Rol<select value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value as AdminUserPayload['role'] })}><option value="COURT_LEADER">Líder de cancha</option><option value="DIRECTOR">Director</option></select></label><label>Contraseña<input type="password" minLength={8} value={form.password ?? ''} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!editing} placeholder={editing ? 'Dejar vacío para conservarla' : ''} /></label><div className="span-2 form-actions"><button className="primary-button" disabled={saving}>{saving ? 'Guardando...' : 'Guardar'}</button></div></form></AdminDialog>}</div>;
}
