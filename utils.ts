import * as XLSX from 'xlsx';
import {
  AggregatedChartRow,
  ApplicationRow,
  DeterminedPlanting,
  EnrichedApplication,
  PlanItem,
  PlantingRow,
  ProductMetric,
} from './types';

const DATE_PATTERN = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/;

export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value).trim();
}

export function normalizeText(value: unknown): string {
  return safeString(value).toUpperCase().replace(/\s+/g, ' ').trim();
}

export function numberFromBrazilian(value: unknown): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  const text = safeString(value);
  if (!text) return 0;

  const cleaned = text.replace(/\./g, '').replace(',', '.');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function parseExcelDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value);
    if (!parsed) return null;
    return new Date(parsed.y, parsed.m - 1, parsed.d);
  }

  const text = safeString(value);
  if (!text) return null;

  const direct = new Date(text);
  if (!Number.isNaN(direct.getTime())) {
    return new Date(direct.getFullYear(), direct.getMonth(), direct.getDate());
  }

  const match = text.match(DATE_PATTERN);
  if (!match) return null;
  const [, day, month, year] = match;
  return new Date(Number(year), Number(month) - 1, Number(day));
}

export function formatDate(value?: Date | null): string {
  if (!value) return '-';
  return new Intl.DateTimeFormat('pt-BR').format(value);
}

export function addDays(date: Date, days: number): Date {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

export function diffDays(later: Date, earlier: Date): number {
  const msPerDay = 24 * 60 * 60 * 1000;
  const laterUtc = Date.UTC(later.getFullYear(), later.getMonth(), later.getDate());
  const earlierUtc = Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate());
  return Math.round((laterUtc - earlierUtc) / msPerDay);
}

export function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

export function stdDev(values: number[]): number {
  if (values.length <= 1) return 0;
  const avg = mean(values);
  const variance = mean(values.map((value) => (value - avg) ** 2));
  return Math.sqrt(variance);
}

export async function parsePlantingFile(file: File): Promise<PlantingRow[]> {
  const rows = await parseWorkbook(file);

  return rows
    .map<PlantingRow | null>((row) => {
      const dataPlantio = parseExcelDate(row['Data Plantio']);
      if (!dataPlantio) return null;

      return {
        divisao: safeString(row['Divisão']),
        safra: safeString(row['Safra']),
        anoAgricola: safeString(row['Ano Agrícola']),
        cultura: safeString(row['Cultura']),
        fazenda: safeString(row['Fazenda']),
        talhao: safeString(row['Talhão']),
        variedade: safeString(row['Variedade']),
        dataPlantio,
        espacamento: numberFromBrazilian(row['Espaçamento']) || null,
        stand: numberFromBrazilian(row['Stand']) || null,
        areaTotalHa: numberFromBrazilian(row['Área Total(ha)']),
        areaPlantadaHa: numberFromBrazilian(row['Área Plantada(ha)']),
      };
    })
    .filter((row): row is PlantingRow => row !== null);
}

export async function parseApplicationFile(file: File): Promise<ApplicationRow[]> {
  const rows = await parseWorkbook(file);

  return rows
    .map((row) => {
      const dataAplicacao = parseExcelDate(row['Data Plantio']);
      if (!dataAplicacao) return null;

      return {
        divisao: safeString(row['Divisão']),
        safra: safeString(row['Safra']),
        produto: safeString(row['PRODUTO']),
        cultura: safeString(row['Cultura']),
        fazenda: safeString(row['Fazenda']),
        talhao: safeString(row['Talhão']),
        variedade: safeString(row['Variedade']),
        dataAplicacao,
      } satisfies ApplicationRow;
    })
    .filter((row): row is ApplicationRow => Boolean(row));
}

async function parseWorkbook(file: File): Promise<Record<string, unknown>[]> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: 'array', cellDates: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return XLSX.utils.sheet_to_json(sheet, {
    raw: false,
    defval: '',
    blankrows: false,
  });
}

export function makeFieldKey(params: {
  divisao: string;
  safra: string;
  cultura: string;
  fazenda: string;
  talhao: string;
  variedade: string;
}): string {
  return [
    normalizeText(params.divisao),
    normalizeText(params.safra),
    normalizeText(params.cultura),
    normalizeText(params.fazenda),
    normalizeText(params.talhao),
    normalizeText(params.variedade),
  ].join('|');
}

export function computeDeterminedPlanting(rows: PlantingRow[]): DeterminedPlanting[] {
  const grouped = new Map<string, PlantingRow[]>();

  rows.forEach((row) => {
    const key = makeFieldKey(row);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(row);
  });

  const result: DeterminedPlanting[] = [];

  grouped.forEach((groupRows, key) => {
    const sorted = [...groupRows].sort((a, b) => a.dataPlantio.getTime() - b.dataPlantio.getTime());
    const areaTotalHa = sorted[0]?.areaTotalHa ?? 0;
    let cumulativeArea = 0;
    let matched: DeterminedPlanting | null = null;

    for (const row of sorted) {
      cumulativeArea += row.areaPlantadaHa;
      const percent = areaTotalHa > 0 ? (cumulativeArea / areaTotalHa) * 100 : 0;
      if (percent >= 70) {
        matched = {
          key,
          divisao: row.divisao,
          safra: row.safra,
          cultura: row.cultura,
          fazenda: row.fazenda,
          talhao: row.talhao,
          variedade: row.variedade,
          areaTotalHa,
          cumulativeAreaAtThreshold: cumulativeArea,
          cumulativePercentAtThreshold: percent,
          determinedPlantingDate: row.dataPlantio,
          daeStartDate: addDays(row.dataPlantio, 5),
        };
        break;
      }
    }

    if (matched) {
      result.push(matched);
    }
  });

  return result.sort((a, b) => a.determinedPlantingDate.getTime() - b.determinedPlantingDate.getTime());
}

export function enrichApplications(
  applications: ApplicationRow[],
  determinedPlantings: DeterminedPlanting[],
  planItems: PlanItem[],
): EnrichedApplication[] {
  const determinedMap = new Map(determinedPlantings.map((item) => [item.key, item]));
  const planMap = new Map(planItems.map((item) => [normalizeText(item.produto), item]));

  return applications.map((row) => {
    const key = makeFieldKey(row);
    const determined = determinedMap.get(key);
    const plan = planMap.get(normalizeText(row.produto));
    const actualDae = determined ? diffDays(row.dataAplicacao, determined.daeStartDate) : undefined;
    const plannedDate = determined && plan ? addDays(determined.daeStartDate, plan.daePrevisto) : undefined;
    const variationDays = actualDae !== undefined && plan ? actualDae - plan.daePrevisto : undefined;

    return {
      ...row,
      key,
      determinedPlantingDate: determined?.determinedPlantingDate,
      daeStartDate: determined?.daeStartDate,
      actualDae,
      plannedDae: plan?.daePrevisto,
      plannedDate,
      variationDays,
    } satisfies EnrichedApplication;
  });
}

export function aggregateForChart(
  rows: EnrichedApplication[],
  viewMode: 'talhao' | 'fazenda',
): AggregatedChartRow[] {
  const validRows = rows.filter(
    (row) => row.plannedDae !== undefined && row.actualDae !== undefined && row.variationDays !== undefined,
  );

  const grouped = new Map<string, EnrichedApplication[]>();

  validRows.forEach((row) => {
    const scopeName = viewMode === 'fazenda' ? row.fazenda : row.talhao;
    const key = [normalizeText(scopeName), normalizeText(row.produto)].join('|');
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(row);
  });

  const data: AggregatedChartRow[] = [];

  grouped.forEach((groupRows, id) => {
    const first = groupRows[0];
    const planned = mean(groupRows.map((item) => item.plannedDae ?? 0));
    const actual = mean(groupRows.map((item) => item.actualDae ?? 0));
    const avgVariation = mean(groupRows.map((item) => item.variationDays ?? 0));
    const plannedDates = groupRows.map((item) => item.plannedDate).filter((value): value is Date => Boolean(value));
    const actualDates = groupRows.map((item) => item.dataAplicacao);

    data.push({
      id,
      scopeName: viewMode === 'fazenda' ? first.fazenda : first.talhao,
      fazenda: first.fazenda,
      talhao: first.talhao,
      produto: first.produto,
      count: groupRows.length,
      plannedDae: Number(planned.toFixed(2)),
      actualDae: Number(actual.toFixed(2)),
      avgVariationDays: Number(avgVariation.toFixed(2)),
      plannedDateLabel: plannedDates.length ? formatDate(plannedDates.sort((a, b) => a.getTime() - b.getTime())[0]) : '-',
      actualDateLabel: actualDates.length ? formatDate(actualDates.sort((a, b) => a.getTime() - b.getTime())[0]) : '-',
      tooltipSummary:
        viewMode === 'fazenda'
          ? `Média de ${groupRows.length} aplicação(ões) na fazenda ${first.fazenda}`
          : `Talhão ${first.talhao} com ${groupRows.length} aplicação(ões)`,
    });
  });

  return data.sort((a, b) => a.scopeName.localeCompare(b.scopeName) || a.produto.localeCompare(b.produto));
}

export function computeProductMetrics(rows: EnrichedApplication[]): ProductMetric[] {
  const validRows = rows.filter(
    (row) => row.plannedDae !== undefined && row.actualDae !== undefined && row.variationDays !== undefined,
  );
  const grouped = new Map<string, EnrichedApplication[]>();

  validRows.forEach((row) => {
    const key = normalizeText(row.produto);
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)?.push(row);
  });

  const metrics: ProductMetric[] = [];

  grouped.forEach((groupRows) => {
    const first = groupRows[0];
    const variations = groupRows.map((item) => item.variationDays ?? 0);
    const plannedDaeValues = groupRows.map((item) => item.plannedDae ?? 0);
    const actualDaeValues = groupRows.map((item) => item.actualDae ?? 0);
    const avgPlannedDae = mean(plannedDaeValues);
    const variationStdDev = stdDev(variations);
    const cvPercent = avgPlannedDae > 0 ? (variationStdDev / avgPlannedDae) * 100 : 0;

    metrics.push({
      produto: first.produto,
      count: groupRows.length,
      avgVariationDays: Number(mean(variations).toFixed(2)),
      cvPercent: Number(cvPercent.toFixed(2)),
      avgActualDae: Number(mean(actualDaeValues).toFixed(2)),
      avgPlannedDae: Number(avgPlannedDae.toFixed(2)),
    });
  });

  return metrics.sort((a, b) => a.produto.localeCompare(b.produto));
}

export function uniqueSorted(values: string[]): string[] {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b));
}
