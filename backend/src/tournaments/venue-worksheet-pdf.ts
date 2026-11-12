import PDFDocument from 'pdfkit';

export interface VenueWorksheetTeam {
  seed: number;
  name: string;
  players: string;
  played: number;
  wins: number;
  pointsFor: number;
  pointsAgainst: number;
}

export interface VenueWorksheetMatch {
  sequence: number;
  matchOrder: number;
  home: string;
  away: string;
  homeSource: string;
  awaySource: string;
  homeScore: number | null;
  awayScore: number | null;
  court: string;
  venue: string;
  scheduledAt: Date | null;
  atWorksheetVenue: boolean;
}

export interface VenueWorksheetZone {
  name: string;
  teams: VenueWorksheetTeam[];
  matches: VenueWorksheetMatch[];
}

export interface VenueWorksheetCategory {
  name: string;
  zones: VenueWorksheetZone[];
  knockout: Record<'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL', VenueWorksheetMatch[]>;
}

export interface VenueWorksheetData {
  tournamentName: string;
  venueName: string;
  venueAddress: string;
  generatedAt: Date;
  categories: VenueWorksheetCategory[];
}

const colors = {
  ink: '#14262a',
  muted: '#5f7073',
  line: '#cfd9d7',
  paper: '#ffffff',
  pale: '#f2f6f4',
  orange: '#d95f3d',
  orangePale: '#fbece6',
  teal: '#16869a',
  tealPale: '#e5f4f6',
};

function fitText(doc: PDFKit.PDFDocument, value: string, width: number, size: number) {
  doc.fontSize(size);
  if (doc.widthOfString(value) <= width) return value;
  let text = value;
  while (text.length > 2 && doc.widthOfString(`${text}…`) > width) text = text.slice(0, -1);
  return `${text.trimEnd()}…`;
}

function formatDate(value: Date | null) {
  if (!value) return 'Horario a definir';
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(value);
}

function formatGeneratedAt(value: Date) {
  return new Intl.DateTimeFormat('es-AR', {
    timeZone: 'America/Argentina/Buenos_Aires', dateStyle: 'short', timeStyle: 'short', hour12: false,
  }).format(value);
}

function pageHeader(doc: PDFKit.PDFDocument, data: VenueWorksheetData, logoPath?: string) {
  const margin = doc.page.margins.left;
  const width = doc.page.width - margin - doc.page.margins.right;
  doc.save().rect(0, 0, doc.page.width, 88).fill(colors.ink).restore();
  if (logoPath) {
    try { doc.image(logoPath, margin, 15, { fit: [58, 58], align: 'center', valign: 'center' }); } catch { /* The title remains usable if the logo asset is unavailable. */ }
  }
  const titleX = margin + 72;
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(22).text(data.tournamentName, titleX, 17, { width: width - 390, height: 28, ellipsis: true });
  doc.font('Helvetica').fontSize(10).fillColor('#d9e5e2').text(`PLANILLA DE SEDE · ${data.venueName}`, titleX, 52, { width: width - 390 });
  doc.font('Helvetica-Bold').fontSize(10).fillColor('#ffffff').text('FORMATO A3 · CONTROL EN PAPEL', doc.page.width - margin - 265, 22, { width: 265, align: 'right' });
  doc.font('Helvetica').fontSize(8).fillColor('#d9e5e2').text(data.venueAddress || 'Dirección no informada', doc.page.width - margin - 265, 43, { width: 265, align: 'right' });
  doc.text(`Generado: ${formatGeneratedAt(data.generatedAt)}`, doc.page.width - margin - 265, 59, { width: 265, align: 'right' });
}

function addPage(doc: PDFKit.PDFDocument) {
  doc.addPage({ size: 'A3', layout: 'landscape', margins: { top: 28, right: 34, bottom: 34, left: 34 } });
}

function sectionTitle(doc: PDFKit.PDFDocument, title: string, subtitle: string) {
  doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(17).text(title, 34, 101, { width: doc.page.width - 68 });
  doc.fillColor(colors.muted).font('Helvetica').fontSize(8.5).text(subtitle, 34, 125, { width: doc.page.width - 68 });
}

function cell(doc: PDFKit.PDFDocument, x: number, y: number, w: number, h: number, text: string, options: { bold?: boolean; align?: 'left' | 'center' | 'right'; fill?: string; color?: string; size?: number } = {}) {
  if (options.fill) doc.save().rect(x, y, w, h).fill(options.fill).restore();
  doc.save().rect(x, y, w, h).strokeColor(colors.line).lineWidth(0.55).stroke().restore();
  const size = options.size ?? 7.4;
  doc.fillColor(options.color ?? colors.ink).font(options.bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(size)
    .text(fitText(doc, text, w - 8, size), x + 4, y + Math.max(3, (h - size) / 2 - 1), { width: w - 8, align: options.align ?? 'left', lineBreak: false });
}

function drawZoneCard(doc: PDFKit.PDFDocument, zone: VenueWorksheetZone, category: string, x: number, y: number, w: number, h: number) {
  doc.save().roundedRect(x, y, w, h, 7).fillAndStroke(colors.paper, colors.line).restore();
  doc.save().roundedRect(x, y, w, 38, 7).fill(colors.ink).restore();
  doc.fillColor('#ffffff').font('Helvetica-Bold').fontSize(12).text(zone.name, x + 12, y + 9, { width: w * 0.45 });
  doc.fillColor('#d9e5e2').font('Helvetica').fontSize(8).text(category, x + w * 0.43, y + 12, { width: w * 0.53 - 12, align: 'right' });

  const innerX = x + 12;
  const innerW = w - 24;
  let cursor = y + 49;
  doc.fillColor(colors.orange).font('Helvetica-Bold').fontSize(8).text('POSICIONES DE LA ZONA', innerX, cursor);
  doc.fillColor(colors.muted).font('Helvetica').fontSize(6.8).text('Orden: partidos ganados, diferencia de tantos y tantos a favor.', innerX + 150, cursor + 1, { width: innerW - 150, align: 'right' });
  cursor += 15;

  const numeric = [28, 28, 30, 30, 34, 32];
  const teamW = innerW - numeric.reduce((sum, value) => sum + value, 0);
  const headers = [['PAREJA / EQUIPO', teamW], ['PJ', numeric[0]], ['PG', numeric[1]], ['TF', numeric[2]], ['TC', numeric[3]], ['DIF', numeric[4]], ['POS', numeric[5]]] as const;
  let columnX = innerX;
  for (const [label, width] of headers) { cell(doc, columnX, cursor, width, 18, label, { bold: true, align: label === 'PAREJA / EQUIPO' ? 'left' : 'center', fill: colors.pale, size: 6.8 }); columnX += width; }
  cursor += 18;
  for (const team of zone.teams) {
    columnX = innerX;
    const difference = team.pointsFor - team.pointsAgainst;
    const values = [`${team.seed}. ${team.name}`, team.played ? String(team.played) : '', team.played ? String(team.wins) : '', team.played ? String(team.pointsFor) : '', team.played ? String(team.pointsAgainst) : '', team.played ? String(difference) : '', ''];
    headers.forEach(([, width], index) => { cell(doc, columnX, cursor, width, 20, values[index], { bold: index === 0, align: index === 0 ? 'left' : 'center', size: index === 0 ? 6.8 : 7.2 }); columnX += width; });
    cursor += 20;
  }

  cursor += 10;
  doc.fillColor(colors.teal).font('Helvetica-Bold').fontSize(8).text('PARTIDOS Y RESULTADOS', innerX, cursor);
  cursor += 14;
  for (const match of zone.matches) {
    const rowHeight = 30;
    doc.save().rect(innerX, cursor, innerW, rowHeight).fillAndStroke(colors.paper, colors.line).restore();
    doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(7).text(`P${match.sequence}`, innerX + 5, cursor + 4, { width: 32 });
    doc.font('Helvetica').fontSize(5.4).text(`${formatDate(match.scheduledAt)} · ${match.court || 'Cancha a definir'}`, innerX + 5, cursor + 17, { width: 128 });
    const nameX = innerX + 136;
    const scoreW = 30;
    const nameW = (innerW - 136 - scoreW * 2 - 18) / 2;
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(6.8).text(fitText(doc, match.home, nameW - 6, 6.8), nameX, cursor + 7, { width: nameW, lineBreak: false });
    cell(doc, nameX + nameW, cursor + 4, scoreW, 22, match.homeScore === null ? '' : String(match.homeScore), { bold: true, align: 'center', fill: colors.orangePale, size: 9 });
    doc.fillColor(colors.muted).font('Helvetica-Bold').fontSize(8).text('-', nameX + nameW + scoreW + 4, cursor + 11, { width: 10, align: 'center' });
    cell(doc, nameX + nameW + scoreW + 18, cursor + 4, scoreW, 22, match.awayScore === null ? '' : String(match.awayScore), { bold: true, align: 'center', fill: colors.tealPale, size: 9 });
    doc.fillColor(colors.ink).font('Helvetica-Bold').fontSize(6.8).text(fitText(doc, match.away, nameW - 6, 6.8), nameX + nameW + scoreW * 2 + 24, cursor + 7, { width: nameW, lineBreak: false });
    cursor += rowHeight + 2;
  }
}

function drawZonePages(doc: PDFKit.PDFDocument, data: VenueWorksheetData, category: VenueWorksheetCategory, logoPath?: string) {
  for (let start = 0; start < category.zones.length; start += 4) {
    const zones = category.zones.slice(start, start + 4);
    addPage(doc);
    sectionTitle(doc, `${category.name} · Zonas`, `Sede ${data.venueName} · completar resultados y posición final de cada zona.`);
    const top = 150;
    const gap = 14;
    const cardW = (doc.page.width - 68 - gap) / 2;
    const rows = Math.ceil(zones.length / 2);
    const cardH = rows === 1 ? 620 : 323;
    zones.forEach((zone, index) => drawZoneCard(doc, zone, category.name, 34 + (index % 2) * (cardW + gap), top + Math.floor(index / 2) * (cardH + gap), cardW, cardH));
  }
}

const stageTitle: Record<'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL', string> = { QUARTERFINAL: 'CUARTOS DE FINAL', SEMIFINAL: 'SEMIFINALES', FINAL: 'FINAL' };

function drawBracketMatch(doc: PDFKit.PDFDocument, match: VenueWorksheetMatch, x: number, y: number, w: number, h: number) {
  const highlighted = match.atWorksheetVenue;
  doc.save().roundedRect(x, y, w, h, 7).fillAndStroke(highlighted ? colors.orangePale : colors.paper, highlighted ? colors.orange : colors.line).restore();
  doc.fillColor(highlighted ? colors.orange : colors.muted).font('Helvetica-Bold').fontSize(8).text(`P${match.sequence}`, x + 10, y + 8, { width: 45 });
  doc.fillColor(colors.muted).font('Helvetica').fontSize(6.7).text(`${formatDate(match.scheduledAt)} · ${match.venue || 'Sede a definir'} · ${match.court || 'Cancha a definir'}`, x + 55, y + 9, { width: w - 65, align: 'right' });
  const lineX = x + 10;
  const lineW = w - 56;
  const scoreX = x + w - 38;
  const firstY = y + 34;
  [
    { source: match.homeSource, score: match.homeScore, y: firstY },
    { source: match.awaySource, score: match.awayScore, y: firstY + 36 },
  ].forEach((side) => {
    doc.fillColor(colors.muted).font('Helvetica').fontSize(6.5).text(fitText(doc, side.source, lineW, 6.5), lineX, side.y, { width: lineW, lineBreak: false });
    doc.save().moveTo(lineX, side.y + 21).lineTo(lineX + lineW, side.y + 21).strokeColor(colors.ink).lineWidth(0.8).stroke().restore();
    cell(doc, scoreX, side.y + 1, 27, 25, side.score === null ? '' : String(side.score), { bold: true, align: 'center', fill: colors.paper, size: 10 });
  });
}

function drawBracketPage(doc: PDFKit.PDFDocument, data: VenueWorksheetData, category: VenueWorksheetCategory, logoPath?: string) {
  const stages = (['QUARTERFINAL', 'SEMIFINAL', 'FINAL'] as const).filter((stage) => category.knockout[stage].length);
  if (!stages.length) return;
  addPage(doc);
  sectionTitle(doc, `${category.name} · Cuadro final`, 'Escribir a mano las parejas clasificadas. Los partidos resaltados se juegan en esta sede.');
  const pageW = doc.page.width;
  const columnW = 300;
  const stageX: Record<'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL', number> = { QUARTERFINAL: 45, SEMIFINAL: (pageW - columnW) / 2, FINAL: pageW - 45 - columnW };
  const positions: Record<'QUARTERFINAL' | 'SEMIFINAL' | 'FINAL', number[]> = {
    QUARTERFINAL: [190, 330, 470, 610],
    SEMIFINAL: [260, 540],
    FINAL: [400],
  };
  for (const stage of stages) {
    doc.fillColor(stage === 'FINAL' ? colors.orange : colors.teal).font('Helvetica-Bold').fontSize(10).text(stageTitle[stage], stageX[stage], 155, { width: columnW, align: 'center' });
    category.knockout[stage].forEach((match, index) => drawBracketMatch(doc, match, stageX[stage], positions[stage][index] ?? 190 + index * 125, columnW, 104));
  }
  const connect = (fromStage: 'QUARTERFINAL' | 'SEMIFINAL', toStage: 'SEMIFINAL' | 'FINAL') => {
    const from = category.knockout[fromStage]; const to = category.knockout[toStage];
    if (!from.length || !to.length) return;
    from.forEach((_, index) => {
      const targetIndex = Math.floor(index / 2);
      if (!to[targetIndex]) return;
      const x1 = stageX[fromStage] + columnW; const y1 = (positions[fromStage][index] ?? 190) + 52;
      const x2 = stageX[toStage]; const y2 = (positions[toStage][targetIndex] ?? 190) + 52;
      const mid = (x1 + x2) / 2;
      doc.save().moveTo(x1, y1).lineTo(mid, y1).lineTo(mid, y2).lineTo(x2, y2).strokeColor(colors.line).lineWidth(1.1).stroke().restore();
    });
  };
  connect('QUARTERFINAL', 'SEMIFINAL'); connect('SEMIFINAL', 'FINAL');
}

function finalizePages(doc: PDFKit.PDFDocument, data: VenueWorksheetData, logoPath?: string) {
  const range = doc.bufferedPageRange();
  for (let index = range.start; index < range.start + range.count; index += 1) {
    doc.switchToPage(index);
    pageHeader(doc, data, logoPath);
    doc.fillColor('#d9e5e2').font('Helvetica').fontSize(6.5).text(`Página ${index - range.start + 1} de ${range.count}`, doc.page.width - doc.page.margins.right - 265, 72, { width: 265, align: 'right', lineBreak: false });
  }
}

export function renderVenueWorksheetPdf(data: VenueWorksheetData, logoPath?: string) {
  return new Promise<Buffer>((resolve, reject) => {
    const doc = new PDFDocument({ autoFirstPage: false, bufferPages: true, compress: true, info: { Title: `${data.tournamentName} - ${data.venueName}`, Author: 'Copa Leyendas Femme', Subject: 'Planilla A3 de seguimiento por sede' } });
    const chunks: Buffer[] = [];
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    try {
      for (const category of data.categories) {
        if (category.zones.length) drawZonePages(doc, data, category, logoPath);
        drawBracketPage(doc, data, category, logoPath);
      }
      finalizePages(doc, data, logoPath);
      doc.end();
    } catch (error) {
      doc.end();
      reject(error);
    }
  });
}
