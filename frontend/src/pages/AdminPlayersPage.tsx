import { useEffect, useState } from 'react';
import { AdminDataGrid } from '../components/AdminDataGrid';
import { AdminDialog } from '../components/AdminDialog';
import { createPlayer, deletePlayer, getLocalities, getPlayers, updatePlayer } from '../lib/api';
import { shirtSizeLabels } from '../lib/content';
import type { Locality, Player, PlayerPayload } from '../types';

const initialForm: PlayerPayload = { fullName: '', dni: '', birthDate: '', phone: '', instagram: '', shirtSize: '', localityId: null };

export function AdminPlayersPage() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState<PlayerPayload>(initialForm);
  const [editing, setEditing] = useState<Player | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const load = () => getPlayers(search || undefined).then(setPlayers).catch((reason: Error) => setError(reason.message));
  useEffect(() => { load(); getLocalities().then(setLocalities).catch((reason: Error) => setError(reason.message)); }, []);
  const openCreate = () => { setEditing(null); setForm(initialForm); setError(null); setDialogOpen(true); };
  const openEdit = (player: Player) => { setEditing(player); setForm({ fullName: player.fullName, dni: player.dni, birthDate: player.birthDate ?? '', phone: player.phone ?? '', instagram: player.instagram ?? '', shirtSize: player.shirtSize ?? '', localityId: player.localityId }); setError(null); setDialogOpen(true); };
  const closeDialog = () => { setDialogOpen(false); setEditing(null); setForm(initialForm); };
  const toPayload = (): PlayerPayload => ({ ...form, birthDate: form.birthDate || undefined, phone: form.phone || undefined, instagram: form.instagram || undefined, shirtSize: form.shirtSize || undefined });
  const save = async (event: React.FormEvent<HTMLFormElement>) => { event.preventDefault(); setError(null); try { if (editing) await updatePlayer(editing.id, toPayload()); else await createPlayer(toPayload()); closeDialog(); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo guardar la jugadora.'); } };
  const remove = async (player: Player) => { if (!window.confirm(`Se eliminara la ficha de ${player.fullName}.`)) return; try { await deletePlayer(player.id); load(); } catch (reason) { setError(reason instanceof Error ? reason.message : 'No se pudo eliminar la jugadora.'); } };

  return <div className="admin-panel">
    <div className="panel-header"><div><p className="eyebrow">ABM</p><h1>Jugadores y jugadoras</h1></div><button type="button" className="primary-button" onClick={openCreate}>Agregar jugadora</button></div>
    <div className="toolbar"><input placeholder="Buscar por nombre, DNI o localidad" value={search} onChange={(event) => setSearch(event.target.value)} /><button type="button" className="secondary-button" onClick={load}>Buscar</button></div>
    {error ? <div className="inline-state">{error}</div> : null}
    <section className="data-card"><AdminDataGrid columns={[
      { label: 'Nombre y apellido', render: (item) => <strong>{item.fullName}</strong> },
      { label: 'DNI', render: (item) => item.dni },
      { label: 'Localidad / equipo', render: (item) => item.locality ? `${item.locality.name}, ${item.locality.provinceName}` : 'Sin asignar' },
      { label: 'Celular', render: (item) => item.phone ?? '-' },
      { label: 'Talle', render: (item) => item.shirtSize ?? '-' },
    ]} rows={players} onEdit={openEdit} onDelete={remove} emptyMessage="No hay jugadoras cargadas." /></section>
    {dialogOpen ? <AdminDialog title={editing ? 'Editar jugadora' : 'Nueva jugadora'} onClose={closeDialog}><form className="editor-form" onSubmit={save}>
      <label>Nombre y apellido<input value={form.fullName} onChange={(event) => setForm({ ...form, fullName: event.target.value })} required /></label>
      <label>DNI<input value={form.dni} onChange={(event) => setForm({ ...form, dni: event.target.value })} required /></label>
      <label>Fecha de nacimiento<input type="date" value={form.birthDate ?? ''} onChange={(event) => setForm({ ...form, birthDate: event.target.value })} /></label>
      <label>Celular<input value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} /></label>
      <label>Instagram<input value={form.instagram ?? ''} onChange={(event) => setForm({ ...form, instagram: event.target.value })} /></label>
      <label>Localidad / equipo<select value={form.localityId ?? ''} onChange={(event) => setForm({ ...form, localityId: event.target.value ? Number(event.target.value) : null })}><option value="">Sin asignar</option>{localities.map((locality) => <option key={locality.id} value={locality.id}>{locality.name}, {locality.provinceName}</option>)}</select></label>
      <label>Talle de camiseta<select value={form.shirtSize ?? ''} onChange={(event) => setForm({ ...form, shirtSize: event.target.value as PlayerPayload['shirtSize'] })}><option value="">Sin definir</option>{shirtSizeLabels.map((size) => <option key={size} value={size}>{size}</option>)}</select></label>
      <div className="form-actions span-2"><button type="submit" className="primary-button">Guardar</button></div>
    </form></AdminDialog> : null}
  </div>;
}
