import { useEffect, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { createLocality, deleteLocality, getCategories, getLocalities, updateLocality } from '../lib/api';
import type { Category, Locality, LocalityPayload } from '../types';

const initialForm: LocalityPayload = { name: '', provinceName: '', active: true };

export function AdminLocalitiesPage() {
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<LocalityPayload>(initialForm);
  const [editing, setEditing] = useState<Locality | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = () => getLocalities(search || undefined).then(setLocalities).catch((reason: Error) => setError(reason.message));
  useEffect(() => { load(); getCategories().then(setCategories).catch((reason: Error) => setError(reason.message)); }, []);
  const openCreate = () => { setEditing(null); setForm(initialForm); setError(null); setDialogOpen(true); };
  const openEdit = (locality: Locality) => { setEditing(locality); setForm({ name: locality.name, provinceName: locality.provinceName, active: locality.active, categoryId: locality.categoryId }); setError(null); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(initialForm); };
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(null); try { if (editing) await updateLocality(editing.id, form); else await createLocality(form); closeDialog(); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la localidad.'); } };
  const remove = async (locality: Locality) => { if (!window.confirm(`Se eliminara ${locality.name}. Las jugadoras quedaran sin localidad asignada.`)) return; try { await deleteLocality(locality.id); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la localidad.'); } };

  return <div className="admin-panel">
    <div className="panel-header"><div><p className="eyebrow">ABM</p><h1>Localidades y equipos</h1></div><button type="button" className="primary-button" onClick={openCreate}>Agregar localidad</button></div>
    <div className="toolbar"><input placeholder="Buscar por localidad o provincia" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="button" className="secondary-button" onClick={load}>Buscar</button></div>
    {error ? <div className="inline-state">{error}</div> : null}
    <section className="data-card"><AdminDataGrid columns={[
      { label: 'Localidad / equipo', render: (item) => <strong>{item.name}</strong> },
      { label: 'Provincia', render: (item) => item.provinceName },
      { label: 'Categoria', render: (item) => item.category?.name ?? 'Sin asignar' },
      { label: 'Estado', render: (item) => <span className={`status-chip ${item.active ? 'status-live' : 'status-draft'}`}>{item.active ? 'Activa' : 'Inactiva'}</span> },
    ]} rows={localities} onEdit={openEdit} onDelete={remove} emptyMessage="No hay localidades cargadas." /></section>
    {dialogOpen ? <AdminDialog title={editing ? 'Editar localidad' : 'Nueva localidad'} onClose={closeDialog}><form className="editor-form" onSubmit={save}>
      <label>Localidad / equipo<input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></label>
      <label>Provincia<input value={form.provinceName} onChange={(event) => setForm({ ...form, provinceName: event.target.value })} required /></label>
      <label className="span-2">Categoria<select value={form.categoryId ?? ''} onChange={(event) => setForm({ ...form, categoryId: event.target.value ? Number(event.target.value) : null })} required><option value="">Seleccionar categoria</option>{categories.filter((category) => category.active).map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}</select></label>
      <label className="checkbox-row span-2"><input type="checkbox" checked={form.active ?? true} onChange={(event) => setForm({ ...form, active: event.target.checked })} />Localidad activa</label>
      <div className="form-actions span-2"><button type="submit" className="primary-button">Guardar</button></div>
    </form></AdminDialog> : null}
  </div>;
}
