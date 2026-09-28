import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { buildShirtProjectionWorkbook, projectShirts } from './shirt-projection';

const sizes = ['S', 'M', 'L', 'XL', 'XXL', 'XXXL', 'XXXXL', 'XXXXXL'];
const distribution = {
  sizes,
  totals: { S: 17, M: 22, L: 16, XL: 8, XXL: 4, XXXL: 5, XXXXL: 1, XXXXXL: 0 },
  total: 73,
  models: [
    { name: 'Guastavino Color 1', sizes: { S: 5, M: 6, L: 5, XL: 1, XXL: 1, XXXL: 2, XXXXL: 0, XXXXXL: 0 }, total: 20, players: [] },
    { name: 'Guastavino Color 2', sizes: { S: 5, M: 5, L: 5, XL: 1, XXL: 1, XXXL: 0, XXXXL: 0, XXXXXL: 0 }, total: 17, players: [] },
    { name: 'Dabber Color 3', sizes: { S: 3, M: 6, L: 2, XL: 3, XXL: 1, XXXL: 1, XXXXL: 0, XXXXXL: 0 }, total: 16, players: [] },
    { name: 'Dabber Color 4', sizes: { S: 4, M: 5, L: 4, XL: 3, XXL: 1, XXXL: 2, XXXXL: 1, XXXXXL: 0 }, total: 20, players: [] },
  ],
};

describe('shirt projection', () => {
  it('projects exactly 50 shirts per model and 200 in total using current model trends', () => {
    const result = projectShirts(distribution as never);
    expect(result.models.map((model) => model.total)).toEqual([50, 50, 50, 50]);
    expect(result.models.map((model) => sizes.map((size) => model.sizes[size]))).toEqual([
      [13, 15, 13, 2, 2, 5, 0, 0],
      [15, 15, 14, 3, 3, 0, 0, 0],
      [10, 19, 6, 9, 3, 3, 0, 0],
      [10, 13, 10, 8, 2, 5, 2, 0],
    ]);
    expect(result.totals).toEqual({ S: 48, M: 62, L: 43, XL: 22, XXL: 10, XXXL: 13, XXXXL: 2, XXXXXL: 0 });
    expect(result.total).toBe(200);
  });

  it('uses the overall size trend when a model has no current assignments', () => {
    const withEmptyModel = structuredClone(distribution);
    withEmptyModel.models[0].sizes = Object.fromEntries(sizes.map((size) => [size, 0])) as typeof withEmptyModel.models[0]['sizes'];
    withEmptyModel.models[0].total = 0;
    const result = projectShirts(withEmptyModel as never);
    expect(result.models[0].total).toBe(50);
    expect(result.models[0].sizes.M).toBeGreaterThan(result.models[0].sizes.XXL);
  });

  it('creates a readable workbook with projected and source sheets', async () => {
    const content = await buildShirtProjectionWorkbook(distribution as never);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Uint8Array.from(content).buffer);
    expect(workbook.worksheets.map((sheet) => sheet.name)).toEqual(['Proyección 200', 'Base actual']);
    const projected = workbook.getWorksheet('Proyección 200')!;
    expect(projected.getCell('A1').value).toBe('Proyección de camisetas para envío');
    expect(projected.getCell('A5').value).toBe('Guastavino Color 1');
    expect(projected.getCell('J5').value).toEqual({ formula: 'SUM(B5:I5)', result: 50 });
    expect(projected.getCell('J9').value).toEqual({ formula: 'SUM(J5:J8)', result: 200 });
    expect(projected.getCell('A1').fill).toMatchObject({ pattern: 'solid', fgColor: { argb: 'FF173F39' } });
    expect(projected.getColumn(1).width).toBe(28);
    expect(projected.views[0]).toMatchObject({ state: 'frozen', xSplit: 1, ySplit: 4 });
    expect(projected.autoFilter).toBe('A4:J8');
    expect(workbook.getWorksheet('Base actual')!.getCell('J9').value).toEqual({ formula: 'SUM(J5:J8)', result: 73 });
  });
});
