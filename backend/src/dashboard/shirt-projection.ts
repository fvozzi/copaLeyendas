import ExcelJS from 'exceljs';
import type { distributeShirts } from './shirt-distribution';

type ShirtDistribution = ReturnType<typeof distributeShirts>;

export interface ShirtProjectionRow {
  name: string;
  sizes: Record<string, number>;
  total: number;
}

export interface ShirtProjection {
  sizes: string[];
  models: ShirtProjectionRow[];
  totals: Record<string, number>;
  total: number;
  targetPerModel: number;
}

export function projectShirts(distribution: ShirtDistribution, targetPerModel = 50): ShirtProjection {
  if (!Number.isInteger(targetPerModel) || targetPerModel < 1) throw new Error('La cantidad por modelo debe ser un entero positivo.');
  const overall = distribution.sizes.map((size) => distribution.totals[size] ?? 0);
  const overallTotal = overall.reduce((sum, count) => sum + count, 0);
  if (!overallTotal) throw new Error('No hay una distribución actual de talles para proyectar.');

  const models = distribution.models.map((model) => {
    const current = distribution.sizes.map((size) => model.sizes[size] ?? 0);
    const source = current.reduce((sum, count) => sum + count, 0) ? current : overall;
    const projected = allocateProportionally(source, targetPerModel);
    return {
      name: model.name,
      sizes: Object.fromEntries(distribution.sizes.map((size, index) => [size, projected[index]])),
      total: projected.reduce((sum, count) => sum + count, 0),
    };
  });
  const totals = Object.fromEntries(distribution.sizes.map((size) => [size, models.reduce((sum, model) => sum + model.sizes[size], 0)]));
  return { sizes: distribution.sizes, models, totals, total: models.reduce((sum, model) => sum + model.total, 0), targetPerModel };
}

export async function buildShirtProjectionWorkbook(distribution: ShirtDistribution, targetPerModel = 50) {
  const projection = projectShirts(distribution, targetPerModel);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Copa Leyendas';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.subject = 'Proyección de camisetas por modelo y talle';

  addDistributionSheet(workbook, 'Proyección 200', 'Proyección de camisetas para envío', projection, {
    subtitle: `${projection.total} camisetas · ${projection.targetPerModel} por modelo · talles según la tendencia actual de cada modelo`,
    note: 'Los valores enteros se calcularon por proporción y método de mayores restos. Si un modelo no tenía asignaciones, se usó la tendencia general.',
  });
  addDistributionSheet(workbook, 'Base actual', 'Asignación actual usada como base', distribution, {
    subtitle: `${distribution.total} camisetas solicitadas en las inscripciones recibidas`,
    note: 'Esta hoja reproduce los datos visibles en el Resumen al momento de la descarga.',
  });

  const content = await workbook.xlsx.writeBuffer();
  return Buffer.from(content);
}

function allocateProportionally(counts: number[], target: number) {
  const total = counts.reduce((sum, count) => sum + count, 0);
  const exact = counts.map((count) => count * target / total);
  const allocated = exact.map(Math.floor);
  let remaining = target - allocated.reduce((sum, count) => sum + count, 0);
  const order = exact.map((value, index) => ({ index, remainder: value - allocated[index] }))
    .sort((left, right) => right.remainder - left.remainder || left.index - right.index);
  for (let index = 0; index < remaining; index++) allocated[order[index].index]++;
  return allocated;
}

function addDistributionSheet(
  workbook: ExcelJS.Workbook,
  sheetName: string,
  title: string,
  distribution: Pick<ShirtProjection, 'sizes' | 'models' | 'totals' | 'total'>,
  copy: { subtitle: string; note: string },
) {
  const sheet = workbook.addWorksheet(sheetName, { views: [{ state: 'frozen', ySplit: 4, xSplit: 1 }] });
  const lastColumn = distribution.sizes.length + 2;
  const lastColumnLetter = sheet.getColumn(lastColumn).letter;
  sheet.mergeCells(`A1:${lastColumnLetter}1`);
  sheet.getCell('A1').value = title;
  sheet.getCell('A1').font = { name: 'Aptos Display', size: 18, bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getCell('A1').fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF173F39' } };
  sheet.getCell('A1').alignment = { vertical: 'middle', horizontal: 'left' };
  sheet.getRow(1).height = 30;
  sheet.mergeCells(`A2:${lastColumnLetter}2`);
  sheet.getCell('A2').value = copy.subtitle;
  sheet.getCell('A2').font = { name: 'Aptos', size: 11, italic: true, color: { argb: 'FF4B5D61' } };
  sheet.getRow(2).height = 22;
  sheet.addRow([]);

  const headerRow = sheet.addRow(['Modelo', ...distribution.sizes, 'Total']);
  headerRow.font = { name: 'Aptos', bold: true, color: { argb: 'FFFFFFFF' } };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFCF6448' } };
  headerRow.alignment = { vertical: 'middle', horizontal: 'center' };
  headerRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  headerRow.height = 24;

  const firstDataRow = headerRow.number + 1;
  for (const model of distribution.models) {
    const row = sheet.addRow([model.name, ...distribution.sizes.map((size) => model.sizes[size] ?? 0), model.total]);
    row.getCell(1).font = { name: 'Aptos', bold: true, color: { argb: 'FF173F39' } };
    row.alignment = { vertical: 'middle', horizontal: 'center' };
    row.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
    row.getCell(lastColumn).value = { formula: `SUM(B${row.number}:${sheet.getColumn(lastColumn - 1).letter}${row.number})`, result: model.total };
    row.height = 22;
  }
  const lastDataRow = sheet.lastRow!.number;
  const totalRow = sheet.addRow(['Total', ...distribution.sizes.map((size) => distribution.totals[size] ?? 0), distribution.total]);
  totalRow.font = { name: 'Aptos', bold: true, color: { argb: 'FF122328' } };
  totalRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE6ECE6' } };
  totalRow.alignment = { vertical: 'middle', horizontal: 'center' };
  totalRow.getCell(1).alignment = { vertical: 'middle', horizontal: 'left' };
  for (let column = 2; column <= lastColumn; column++) {
    const letter = sheet.getColumn(column).letter;
    const result = column === lastColumn ? distribution.total : distribution.totals[distribution.sizes[column - 2]] ?? 0;
    totalRow.getCell(column).value = { formula: `SUM(${letter}${firstDataRow}:${letter}${lastDataRow})`, result };
  }
  totalRow.height = 24;

  const noteRow = totalRow.number + 2;
  sheet.mergeCells(`A${noteRow}:${lastColumnLetter}${noteRow}`);
  sheet.getCell(noteRow, 1).value = copy.note;
  sheet.getCell(noteRow, 1).font = { name: 'Aptos', size: 10, color: { argb: 'FF4B5D61' } };
  sheet.getCell(noteRow, 1).alignment = { wrapText: true, vertical: 'top' };
  sheet.getRow(noteRow).height = 34;

  sheet.getColumn(1).width = 28;
  for (let column = 2; column < lastColumn; column++) sheet.getColumn(column).width = Math.max(9, distribution.sizes[column - 2].length + 3);
  sheet.getColumn(lastColumn).width = 11;
  sheet.autoFilter = { from: { row: headerRow.number, column: 1 }, to: { row: lastDataRow, column: lastColumn } };
  sheet.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 1, paperSize: 9, printArea: `A1:${lastColumnLetter}${noteRow}` };

  for (let row = headerRow.number; row <= totalRow.number; row++) {
    for (let column = 1; column <= lastColumn; column++) {
      sheet.getCell(row, column).border = {
        bottom: { style: 'thin', color: { argb: 'FFD7DEDA' } },
      };
      sheet.getCell(row, column).numFmt = '0';
    }
  }
}
