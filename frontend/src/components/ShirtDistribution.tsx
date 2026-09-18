import type { DashboardSummary } from '../types';

export function ShirtDistribution({ distribution }: { distribution: DashboardSummary['registrations']['shirtDistribution'] }) {
  return <section className="data-card shirt-distribution">
    <h2>Camisetas por modelo y talle</h2>
    <p className="field-hint">Distribución proporcional por talle. Las jugadoras con acuerdo Guastavino o Dabber reciben esa marca; el resto se reparte entre los cuatro modelos.</p>
    {distribution ? <table className="shirt-distribution-table" aria-label="Camisetas por modelo y talle">
      <thead><tr><th scope="col">Modelo</th>{distribution.sizes.map(size => <th scope="col" key={size}>{size}</th>)}<th scope="col">Total</th></tr></thead>
      <tbody>{distribution.models.map(model => <tr key={model.name}>
        <th scope="row">{model.name}</th>
        {distribution.sizes.map(size => <td data-label={size} key={size}>{model.sizes[size] ?? 0}</td>)}
        <td data-label="Total" className="shirt-model-total">{model.total}</td>
      </tr>)}</tbody>
      <tfoot><tr><th scope="row">Total solicitado</th>{distribution.sizes.map(size => <td data-label={size} key={size}>{distribution.totals[size] ?? 0}</td>)}<td data-label="Total" className="shirt-model-total">{distribution.total}</td></tr></tfoot>
    </table> : <p className="inline-state">La distribución por modelo todavía no está disponible.</p>}
    <p className="field-hint">Reparto estimado sobre las inscripciones recibidas, incluidas las suplentes cargadas. Los totales conservan la cantidad solicitada de cada talle.</p>
  </section>;
}
