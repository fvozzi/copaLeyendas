import type { DashboardSummary } from '../types';
import { useState } from 'react';
import { AdminDialog } from './AdminDialog';

export function ShirtDistribution({ distribution }: { distribution: DashboardSummary['registrations']['shirtDistribution'] }) {
  const [selected, setSelected] = useState<string | null>(null);
  const selectedModels = distribution?.models.filter(model => selected === '__all__' || model.name === selected) ?? [];
  const players = selectedModels.flatMap(model => (model.players ?? []).map(player => ({ ...player, model: model.name })))
    .sort((a, b) => (distribution?.sizes.indexOf(a.size) ?? 0) - (distribution?.sizes.indexOf(b.size) ?? 0) || a.name.localeCompare(b.name, 'es'));
  return <section className="data-card shirt-distribution">
    <h2>Camisetas por modelo y talle</h2>
    <p className="field-hint">Las integrantes de una pareja reciben el mismo color, salvo que tengan acuerdos con marcas distintas. En cada zona se priorizan colores diferentes para posibles rivales y la misma marca en los partidos iniciales. Los acuerdos de marca siempre se respetan; “Otra” no restringe el reparto.</p>
    {distribution ? <table className="shirt-distribution-table" aria-label="Camisetas por modelo y talle">
      <thead><tr><th scope="col">Modelo</th>{distribution.sizes.map(size => <th scope="col" key={size}>{size}</th>)}<th scope="col">Total</th></tr></thead>
      <tbody>{distribution.models.map(model => <tr key={model.name} onDoubleClick={() => setSelected(model.name)} title="Doble clic para ver las jugadoras">
        <th scope="row"><button type="button" className="inline-link shirt-detail-button" onClick={() => setSelected(model.name)} aria-label={`Ver jugadoras de ${model.name}`}>{model.name}</button></th>
        {distribution.sizes.map(size => <td data-label={size} key={size}>{model.sizes[size] ?? 0}</td>)}
        <td data-label="Total" className="shirt-model-total">{model.total}</td>
      </tr>)}</tbody>
      <tfoot><tr onDoubleClick={() => setSelected('__all__')} title="Doble clic para ver todas las jugadoras"><th scope="row"><button type="button" className="inline-link shirt-detail-button" onClick={() => setSelected('__all__')}>Total solicitado</button></th>{distribution.sizes.map(size => <td data-label={size} key={size}>{distribution.totals[size] ?? 0}</td>)}<td data-label="Total" className="shirt-model-total">{distribution.total}</td></tr></tfoot>
    </table> : <p className="inline-state">La distribución por modelo todavía no está disponible.</p>}
    <p className="field-hint">Reparto estimado sobre las inscripciones recibidas, incluidas las suplentes cargadas. Los totales conservan la cantidad solicitada de cada talle.</p>
    <p className="field-hint">Hacé doble clic en una fila o tocá el nombre del modelo para ver las jugadoras.</p>
    {selected !== null && <AdminDialog title={selected === '__all__' ? 'Todas las camisetas' : selected} onClose={() => setSelected(null)} className="shirt-players-dialog">
      <p>{players.length} jugadoras en este reparto.</p>
      {selectedModels.some(model => !model.players) ? <p>Actualizá el resumen para cargar el detalle de las jugadoras.</p> : players.length ? <table className="shirt-players-table" aria-label="Jugadoras del reparto">
        <thead><tr><th>Jugadora</th><th>Talle</th><th>Equipo / categoría</th><th>Zona</th><th>Marca declarada</th></tr></thead>
        <tbody>{players.map(player => <tr key={`${player.registrationId}-${player.position}`}>
          <th scope="row">{player.name}{player.position === 'playerThree' && <small className="admin-grid-detail">Suplente</small>}{selected === '__all__' && <small className="admin-grid-detail">{player.model}</small>}</th>
          <td data-label="Talle">{player.size}</td><td data-label="Equipo / categoría">{player.team}<small className="admin-grid-detail">{player.category}</small></td><td data-label="Zona">{player.zone || 'Sin asignar'}</td><td data-label="Marca declarada">{player.brand || 'Sin acuerdo'}</td>
        </tr>)}</tbody>
      </table> : <p>No hay jugadoras asignadas a este modelo.</p>}
    </AdminDialog>}
  </section>;
}
