import { isValidElement, useState, type ReactNode } from 'react';

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

type Direction = 'asc' | 'desc';

export function AdminDataGrid<Row extends { id: number }>({ columns, rows, onEdit, onDelete, renderActions, emptyMessage }: AdminDataGridProps<Row>) {
  const [sort, setSort] = useState<{ column: number; direction: Direction } | null>(null);
  if (!rows.length) return <div className="inline-state">{emptyMessage}</div>;
  const sortedRows = sort ? [...rows].sort((left, right) => compare(cellText(columns[sort.column].render(left)), cellText(columns[sort.column].render(right))) * (sort.direction === 'asc' ? 1 : -1)) : rows;
  const toggleSort = (column: number) => setSort((current) => current?.column === column ? { column, direction: current.direction === 'asc' ? 'desc' : 'asc' } : { column, direction: 'asc' });

  return <div className="admin-data-grid-wrap"><table className="admin-data-grid"><thead><tr>{columns.map((column, index) => <th key={column.label} aria-sort={sort?.column === index ? (sort.direction === 'asc' ? 'ascending' : 'descending') : 'none'}><button type="button" className="admin-grid-sort" onClick={() => toggleSort(index)}>{column.label}<span aria-hidden="true">{sort?.column === index ? (sort.direction === 'asc' ? ' ↑' : ' ↓') : ' ↕'}</span></button></th>)}{(renderActions || onEdit || onDelete) && <th aria-label="Acciones" />}</tr></thead><tbody>{sortedRows.map((row) => <tr key={row.id}>{columns.map((column) => <td key={column.label} data-label={column.label}>{column.render(row)}</td>)}{(renderActions || onEdit || onDelete) && <td className="admin-data-grid-actions" data-label="Acciones">{renderActions ? renderActions(row) : <>{onEdit && <button type="button" className="inline-link" onClick={() => onEdit(row)}>Editar</button>}{onDelete && <button type="button" className="danger-link" onClick={() => onDelete(row)}>Eliminar</button>}</>}</td>}</tr>)}</tbody></table></div>;
}

function cellText(value: ReactNode): string {
  if (value === null || value === undefined || typeof value === 'boolean') return '';
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  if (Array.isArray(value)) return value.map(cellText).join(' ');
  return isValidElement<{ children?: ReactNode }>(value) ? cellText(value.props.children) : '';
}

function compare(left: string, right: string) {
  const leftNumeric = left.replace(/[^0-9,.-]/g, '').replace(',', '.');
  const rightNumeric = right.replace(/[^0-9,.-]/g, '').replace(',', '.');
  if (leftNumeric !== '' && rightNumeric !== '' && Number.isFinite(Number(leftNumeric)) && Number.isFinite(Number(rightNumeric))) return Number(leftNumeric) - Number(rightNumeric);
  return left.localeCompare(right, 'es', { numeric: true, sensitivity: 'base' });
}
