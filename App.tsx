import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Calculator, FileSpreadsheet, Filter, FlaskConical, Sprout, Upload, X } from 'lucide-react';
import {
  aggregateForChart,
  computeDeterminedPlanting,
  computeProductMetrics,
  enrichApplications,
  normalizeText,
  parseApplicationFile,
  parsePlantingFile,
  uniqueSorted,
} from './utils';
import type { AggregatedChartRow, ApplicationRow, DeterminedPlanting, PlanItem, PlantingRow, ProductMetric } from './types';

const STORAGE_KEYS = {
  planning: 'fertilizante-monitor:planning',
};

type ViewMode = 'talhao' | 'fazenda';

type UploadStatus = {
  plantingFileName?: string;
  applicationFileName?: string;
  message?: string;
  error?: string;
};

function App() {
  const [plantingRows, setPlantingRows] = useState<PlantingRow[]>([]);
  const [applicationRows, setApplicationRows] = useState<ApplicationRow[]>([]);
  const [planItems, setPlanItems] = useState<PlanItem[]>([]);
  const [newProduct, setNewProduct] = useState('');
  const [newDae, setNewDae] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('talhao');
  const [selectedFarms, setSelectedFarms] = useState<string[]>([]);
  const [selectedFields, setSelectedFields] = useState<string[]>([]);
  const [selectedProducts, setSelectedProducts] = useState<string[]>([]);
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>({});
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const savedPlanning = localStorage.getItem(STORAGE_KEYS.planning);
    if (savedPlanning) {
      try {
        const parsed = JSON.parse(savedPlanning) as PlanItem[];
        setPlanItems(parsed);
      } catch {
        localStorage.removeItem(STORAGE_KEYS.planning);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.planning, JSON.stringify(planItems));
  }, [planItems]);

  const determinedPlantings = useMemo<DeterminedPlanting[]>(
    () => computeDeterminedPlanting(plantingRows),
    [plantingRows],
  );

  const productOptions = useMemo(() => uniqueSorted(applicationRows.map((row) => row.produto)), [applicationRows]);
  const farmOptions = useMemo(
    () => uniqueSorted([...plantingRows.map((row) => row.fazenda), ...applicationRows.map((row) => row.fazenda)]),
    [plantingRows, applicationRows],
  );
  const fieldOptions = useMemo(
    () => uniqueSorted([...plantingRows.map((row) => row.talhao), ...applicationRows.map((row) => row.talhao)]),
    [plantingRows, applicationRows],
  );

  const enrichedApplications = useMemo(
    () => enrichApplications(applicationRows, determinedPlantings, planItems),
    [applicationRows, determinedPlantings, planItems],
  );

  const filteredApplications = useMemo(() => {
    return enrichedApplications.filter((row) => {
      const farmPass = !selectedFarms.length || selectedFarms.includes(row.fazenda);
      const fieldPass = !selectedFields.length || selectedFields.includes(row.talhao);
      const productPass = !selectedProducts.length || selectedProducts.includes(row.produto);
      return farmPass && fieldPass && productPass;
    });
  }, [enrichedApplications, selectedFarms, selectedFields, selectedProducts]);

  const chartData = useMemo<AggregatedChartRow[]>(() => aggregateForChart(filteredApplications, viewMode), [filteredApplications, viewMode]);
  const productMetrics = useMemo<ProductMetric[]>(() => computeProductMetrics(filteredApplications), [filteredApplications]);

  const unplannedProducts = useMemo(() => {
    const plannedSet = new Set(planItems.map((item) => normalizeText(item.produto)));
    return productOptions.filter((product) => !plannedSet.has(normalizeText(product)));
  }, [planItems, productOptions]);

  const summary = useMemo(() => {
    const validApplications = filteredApplications.filter(
      (row) => row.plannedDae !== undefined && row.actualDae !== undefined && row.variationDays !== undefined,
    );

    return {
      plantingRecords: plantingRows.length,
      applicationRecords: applicationRows.length,
      determinedFields: determinedPlantings.length,
      validApplications: validApplications.length,
    };
  }, [filteredApplications, plantingRows.length, applicationRows.length, determinedPlantings.length]);

  async function handlePlantingUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const rows = await parsePlantingFile(file);
      setPlantingRows(rows);
      setUploadStatus((current) => ({
        ...current,
        plantingFileName: file.name,
        message: `Planilha de plantio carregada com ${rows.length} linha(s).`,
        error: undefined,
      }));
    } catch (error) {
      setUploadStatus((current) => ({
        ...current,
        error: `Não foi possível ler a planilha de plantio. ${error instanceof Error ? error.message : ''}`,
      }));
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  async function handleApplicationUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setLoading(true);
      const rows = await parseApplicationFile(file);
      setApplicationRows(rows);
      setUploadStatus((current) => ({
        ...current,
        applicationFileName: file.name,
        message: `Planilha de aplicações carregada com ${rows.length} linha(s).`,
        error: undefined,
      }));
    } catch (error) {
      setUploadStatus((current) => ({
        ...current,
        error: `Não foi possível ler a planilha de aplicações. ${error instanceof Error ? error.message : ''}`,
      }));
    } finally {
      setLoading(false);
      event.target.value = '';
    }
  }

  function addPlanningItem() {
    const daePrevisto = Number(newDae);
    if (!newProduct || !Number.isFinite(daePrevisto)) return;

    const normalizedProduct = normalizeText(newProduct);
    const filtered = planItems.filter((item) => normalizeText(item.produto) !== normalizedProduct);
    const nextItem: PlanItem = {
      id: `${normalizedProduct}-${Date.now()}`,
      produto: newProduct,
      daePrevisto,
    };

    setPlanItems([...filtered, nextItem].sort((a, b) => a.produto.localeCompare(b.produto)));
    setNewProduct('');
    setNewDae('');
  }

  function removePlanningItem(id: string) {
    setPlanItems((current) => current.filter((item) => item.id !== id));
  }

  function toggleSelection(value: string, selected: string[], setter: (values: string[]) => void) {
    if (selected.includes(value)) {
      setter(selected.filter((item) => item !== value));
      return;
    }

    setter([...selected, value]);
  }

  function clearFilters() {
    setSelectedFarms([]);
    setSelectedFields([]);
    setSelectedProducts([]);
  }

  return (
    <div className="page-shell">
      <header className="hero-card">
        <div>
          <p className="eyebrow">Painel web para GitHub + Vercel</p>
          <h1>Monitor de Aplicação de Fertilizantes</h1>
          <p className="hero-copy">
            Faça upload das planilhas, defina o planejamento em DAE e acompanhe a diferença entre a aplicação prevista e a realizada por fazenda ou por talhão.
          </p>
        </div>
        <div className="hero-note">
          <p><strong>Regra de plantio:</strong> data determinada quando a área acumulada atinge 70% do total.</p>
          <p><strong>Regra do DAE:</strong> a contagem começa 5 dias após essa data.</p>
        </div>
      </header>

      <section className="grid-two">
        <article className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Upload size={18} />
              <h2>1. Upload das planilhas</h2>
            </div>
          </div>

          <div className="upload-grid">
            <label className="upload-box">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handlePlantingUpload} />
              <FileSpreadsheet size={22} />
              <span>Planilha 1 - Plantio</span>
              <small>Data de plantio, área total e área plantada.</small>
            </label>

            <label className="upload-box">
              <input type="file" accept=".xlsx,.xls,.csv" onChange={handleApplicationUpload} />
              <FileSpreadsheet size={22} />
              <span>Planilha 2 - Aplicações</span>
              <small>Produtos e datas de aplicação.</small>
            </label>
          </div>

          <div className="status-area">
            {loading && <p className="info-text">Lendo arquivo...</p>}
            {uploadStatus.message && <p className="success-text">{uploadStatus.message}</p>}
            {uploadStatus.error && <p className="error-text">{uploadStatus.error}</p>}
            <div className="file-list">
              <span><strong>Plantio:</strong> {uploadStatus.plantingFileName ?? 'nenhum arquivo enviado'}</span>
              <span><strong>Aplicações:</strong> {uploadStatus.applicationFileName ?? 'nenhum arquivo enviado'}</span>
            </div>
          </div>
        </article>

        <article className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Sprout size={18} />
              <h2>2. Planejamento</h2>
            </div>
          </div>

          <div className="planner-grid">
            <div className="form-control">
              <label>Produto</label>
              <select value={newProduct} onChange={(event) => setNewProduct(event.target.value)}>
                <option value="">Selecione</option>
                {productOptions.map((product) => (
                  <option key={product} value={product}>
                    {product}
                  </option>
                ))}
              </select>
            </div>
            <div className="form-control">
              <label>DAE previsto</label>
              <input
                type="number"
                min={0}
                step={1}
                placeholder="Ex.: 3"
                value={newDae}
                onChange={(event) => setNewDae(event.target.value)}
              />
            </div>
            <button className="primary-button" type="button" onClick={addPlanningItem}>
              <Calculator size={18} />
              Adicionar planejamento
            </button>
          </div>

          <div className="chips-row muted">
            <span>Produtos sem planejamento:</span>
            {unplannedProducts.length ? (
              unplannedProducts.map((product) => (
                <span key={product} className="small-chip muted-chip">
                  {product}
                </span>
              ))
            ) : (
              <span className="small-chip success-chip">Todos os produtos já possuem DAE previsto.</span>
            )}
          </div>

          <div className="planning-list">
            {planItems.length === 0 ? (
              <p className="empty-state">Cadastre pelo menos um produto com DAE previsto para liberar a comparação do gráfico.</p>
            ) : (
              planItems.map((item) => (
                <div key={item.id} className="planning-item">
                  <div>
                    <strong>{item.produto}</strong>
                    <span>{item.daePrevisto} DAE</span>
                  </div>
                  <button type="button" className="icon-button" onClick={() => removePlanningItem(item.id)}>
                    <X size={16} />
                  </button>
                </div>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="panel-card">
        <div className="panel-header between">
          <div className="panel-title">
            <Filter size={18} />
            <h2>3. Filtros e resultado</h2>
          </div>
          <button className="secondary-button" type="button" onClick={clearFilters}>
            Limpar filtros
          </button>
        </div>

        <div className="filter-section">
          <div className="form-control">
            <label>1º filtro - Visualização</label>
            <div className="segmented-control">
              <button
                className={viewMode === 'talhao' ? 'active' : ''}
                type="button"
                onClick={() => setViewMode('talhao')}
              >
                Por talhão
              </button>
              <button
                className={viewMode === 'fazenda' ? 'active' : ''}
                type="button"
                onClick={() => setViewMode('fazenda')}
              >
                Por fazenda
              </button>
            </div>
          </div>

          <FilterChips
            label="2º filtro - Fazendas"
            values={farmOptions}
            selected={selectedFarms}
            onToggle={(value) => toggleSelection(value, selectedFarms, setSelectedFarms)}
          />

          <FilterChips
            label="3º filtro - Talhões"
            values={fieldOptions}
            selected={selectedFields}
            onToggle={(value) => toggleSelection(value, selectedFields, setSelectedFields)}
          />

          <FilterChips
            label="4º filtro - Produtos"
            values={productOptions}
            selected={selectedProducts}
            onToggle={(value) => toggleSelection(value, selectedProducts, setSelectedProducts)}
          />
        </div>

        <div className="kpi-grid">
          <KpiCard label="Linhas de plantio" value={summary.plantingRecords} help="Registros importados da planilha 1." />
          <KpiCard label="Linhas de aplicação" value={summary.applicationRecords} help="Registros importados da planilha 2." />
          <KpiCard label="Talhões com data definida" value={summary.determinedFields} help="Talhões que alcançaram 70% da área acumulada." />
          <KpiCard label="Aplicações comparáveis" value={summary.validApplications} help="Registros com planejamento e data de plantio calculada." />
        </div>

        <div className="metrics-grid">
          {productMetrics.length === 0 ? (
            <div className="empty-box">
              <FlaskConical size={18} />
              <p>Envie as duas planilhas e cadastre o DAE previsto para começar a analisar.</p>
            </div>
          ) : (
            productMetrics.map((metric) => (
              <article className="metric-card" key={metric.produto}>
                <span className="metric-product">{metric.produto}</span>
                <strong className="metric-value">CV: {metric.cvPercent.toFixed(1)}%</strong>
                <span className="metric-secondary">Variação média: {metric.avgVariationDays.toFixed(1)} dia(s)</span>
                <small>
                  Previsto médio: {metric.avgPlannedDae.toFixed(1)} DAE | Realizado médio: {metric.avgActualDae.toFixed(1)} DAE | {metric.count} aplicação(ões)
                </small>
              </article>
            ))
          )}
        </div>

        <div className="chart-shell">
          {chartData.length === 0 ? (
            <div className="empty-chart">
              <p>Nenhum dado disponível para o gráfico com os filtros atuais.</p>
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={520}>
              <BarChart data={chartData} margin={{ top: 40, right: 20, left: 0, bottom: 95 }} barCategoryGap={24}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="id"
                  interval={0}
                  height={100}
                  tick={<CustomTick data={chartData} viewMode={viewMode} />}
                />
                <YAxis allowDecimals={false} label={{ value: 'DAE', angle: -90, position: 'insideLeft' }} />
                <Tooltip content={<CustomTooltip viewMode={viewMode} />} />
                <Legend />
                <Bar dataKey="plannedDae" name="DAE Previsto" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={`planned-${entry.id}`} fill="#155e75" />
                  ))}
                  <LabelList dataKey="plannedDae" position="top" formatter={(value: number) => `${Math.round(value)} DAE`} />
                </Bar>
                <Bar dataKey="actualDae" name="DAE Aplicado" radius={[8, 8, 0, 0]}>
                  {chartData.map((entry) => (
                    <Cell key={`actual-${entry.id}`} fill="#ea6a2a" />
                  ))}
                  <LabelList dataKey="actualDae" position="top" formatter={(value: number) => `${Math.round(value)} DAE`} />
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <p className="chart-note">
          <strong>Fórmula do CV no painel:</strong> desvio padrão da variação em dias ÷ média do DAE previsto × 100.{' '}
          <strong>Variação média:</strong> DAE realizado - DAE previsto.
        </p>
      </section>

      <section className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Sprout size={18} />
            <h2>4. Tabela de apoio</h2>
          </div>
        </div>

        <div className="table-wrapper">
          <table>
            <thead>
              <tr>
                <th>{viewMode === 'fazenda' ? 'Fazenda' : 'Talhão'}</th>
                <th>Produto</th>
                <th>DAE previsto</th>
                <th>DAE realizado</th>
                <th>Variação (dias)</th>
                <th>Data prevista</th>
                <th>Data realizada</th>
              </tr>
            </thead>
            <tbody>
              {chartData.length === 0 ? (
                <tr>
                  <td colSpan={7} className="empty-table">Nenhum registro para exibir.</td>
                </tr>
              ) : (
                chartData.map((row) => (
                  <tr key={row.id}>
                    <td>{row.scopeName}</td>
                    <td>{row.produto}</td>
                    <td>{row.plannedDae.toFixed(1)}</td>
                    <td>{row.actualDae.toFixed(1)}</td>
                    <td>{row.avgVariationDays.toFixed(1)}</td>
                    <td>{row.plannedDateLabel}</td>
                    <td>{row.actualDateLabel}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function KpiCard({ label, value, help }: { label: string; value: number; help: string }) {
  return (
    <article className="kpi-card">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{help}</small>
    </article>
  );
}

function FilterChips({
  label,
  values,
  selected,
  onToggle,
}: {
  label: string;
  values: string[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  return (
    <div className="form-control">
      <label>{label}</label>
      <div className="chips-row">
        {values.length === 0 ? (
          <span className="small-chip disabled-chip">Envie as planilhas para liberar opções.</span>
        ) : (
          values.map((value) => {
            const active = selected.includes(value);
            return (
              <button
                key={value}
                type="button"
                className={`chip-button ${active ? 'active' : ''}`}
                onClick={() => onToggle(value)}
              >
                {value}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

function CustomTick({
  x,
  y,
  payload,
  data,
  viewMode,
}: {
  x?: number;
  y?: number;
  payload?: { value: string };
  data: AggregatedChartRow[];
  viewMode: ViewMode;
}) {
  const row = data.find((item) => item.id === payload?.value);
  if (!row || x === undefined || y === undefined) return null;

  return (
    <g transform={`translate(${x},${y})`}>
      <text x={0} y={12} textAnchor="middle" fill="#1f2937" fontSize={12} fontWeight={700}>
        {row.scopeName}
      </text>
      <text x={0} y={28} textAnchor="middle" fill="#475569" fontSize={11}>
        {row.produto}
      </text>
      <text x={0} y={44} textAnchor="middle" fill="#64748b" fontSize={10}>
        Prev.: {row.plannedDateLabel}
      </text>
      <text x={0} y={58} textAnchor="middle" fill="#64748b" fontSize={10}>
        Real.: {row.actualDateLabel}
      </text>
      {viewMode === 'fazenda' ? (
        <text x={0} y={72} textAnchor="middle" fill="#94a3b8" fontSize={10}>
          média da fazenda
        </text>
      ) : null}
    </g>
  );
}

function CustomTooltip({ active, payload, viewMode }: { active?: boolean; payload?: Array<{ payload: AggregatedChartRow }>; viewMode: ViewMode }) {
  if (!active || !payload?.length) return null;

  const data = payload[0].payload;

  return (
    <div className="tooltip-card">
      <strong>{viewMode === 'fazenda' ? `Fazenda ${data.scopeName}` : `Talhão ${data.scopeName}`}</strong>
      <span>Produto: {data.produto}</span>
      <span>{data.tooltipSummary}</span>
      <span>DAE previsto: {data.plannedDae.toFixed(1)}</span>
      <span>DAE aplicado: {data.actualDae.toFixed(1)}</span>
      <span>Variação média: {data.avgVariationDays.toFixed(1)} dia(s)</span>
      <span>Data prevista: {data.plannedDateLabel}</span>
      <span>Data realizada: {data.actualDateLabel}</span>
    </div>
  );
}

export default App;
