import type { ReactNode } from 'react';

export interface AdminGridColumn<Row> {
  label: string;
  render: (row: Row) => ReactNode;
}

interface AdminDataGridProps<Row extends { id: number }> {
  columns: AdminGridColumn<Row>[];
  rows: Row[];
  onEdit?: (row: Row) => void;
  onDelete?: (row: Row) => void;
  renderActions?: (row: Row) => ReactNode;
  emptyMessage: string;
}

export function AdminDataGrid<Row extends { id: number }>({ columns, rows, onEdit, onDelete, renderActions, emptyMessage }: AdminDataGridProps<Row>) {
  if (!rows.length) return <div className="inline-state">{emptyMessage}</div>;

  return (
    <div className="admin-data-grid-wrap">
      <table className="admin-data-grid">
        <thead><tr>{columns.map((column) => <th key={column.label}>{column.label}</th>)}{(renderActions || onEdit || onDelete) && <th aria-label="Acciones" />}</tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}>
          {columns.map((column) => <td key={column.label} data-label={column.label}>{column.render(row)}</td>)}
          {(renderActions || onEdit || onDelete) && <td className="admin-data-grid-actions" data-label="Acciones">{renderActions ? renderActions(row) : <>{onEdit && <button type="button" className="inline-link" onClick={() => onEdit(row)}>Editar</button>}{onDelete && <button type="button" className="danger-link" onClick={() => onDelete(row)}>Eliminar</button>}</>}</td>}
        </tr>)}</tbody>
      </table>
    </div>
  );
}
