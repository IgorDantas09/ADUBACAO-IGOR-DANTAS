export type PlantingRow = {
  divisao: string;
  safra: string;
  anoAgricola: string;
  cultura: string;
  fazenda: string;
  talhao: string;
  variedade: string;
  dataPlantio: Date;
  espacamento?: number | null;
  stand?: number | null;
  areaTotalHa: number;
  areaPlantadaHa: number;
};

export type ApplicationRow = {
  divisao: string;
  safra: string;
  produto: string;
  cultura: string;
  fazenda: string;
  talhao: string;
  variedade: string;
  dataAplicacao: Date;
};

export type PlanItem = {
  id: string;
  produto: string;
  daePrevisto: number;
};

export type DeterminedPlanting = {
  key: string;
  divisao: string;
  safra: string;
  cultura: string;
  fazenda: string;
  talhao: string;
  variedade: string;
  areaTotalHa: number;
  cumulativeAreaAtThreshold: number;
  cumulativePercentAtThreshold: number;
  determinedPlantingDate: Date;
  daeStartDate: Date;
};

export type EnrichedApplication = ApplicationRow & {
  key: string;
  determinedPlantingDate?: Date;
  daeStartDate?: Date;
  actualDae?: number;
  plannedDae?: number;
  plannedDate?: Date;
  variationDays?: number;
};

export type AggregatedChartRow = {
  id: string;
  scopeName: string;
  fazenda: string;
  talhao?: string;
  produto: string;
  count: number;
  plannedDae: number;
  actualDae: number;
  avgVariationDays: number;
  plannedDateLabel: string;
  actualDateLabel: string;
  tooltipSummary: string;
};

export type ProductMetric = {
  produto: string;
  count: number;
  avgVariationDays: number;
  cvPercent: number;
  avgActualDae: number;
  avgPlannedDae: number;
};
