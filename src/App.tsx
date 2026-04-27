import { FormEvent, useMemo, useState } from "react";

import {
  exportAnalyticsQuery,
  exportDetailQuery,
  exportRating,
  getAnalyticsFields,
  getFieldValues,
  getMe,
  getRating,
  login,
  runAnalyticsQuery,
  runDetailQuery,
} from "./api";
import { ChartView } from "./ChartView";
import { Alert } from "./components/ui/alert";
import { Badge } from "./components/ui/badge";
import { Button } from "./components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "./components/ui/card";
import { Input } from "./components/ui/input";
import { Label } from "./components/ui/label";
import { Select } from "./components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./components/ui/tabs";
import { DataTable } from "./DataTable";
import { FilterBuilder, getOperatorsForField } from "./FilterBuilder";
import { DETAIL_PRESETS, SUMMARY_PRESETS } from "./presets";
import type {
  Aggregation,
  AnalyticsField,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  ChartType,
  CurrentUser,
  DetailPreset,
  DetailQueryRequest,
  FilterDraft,
  FilterOperator,
  MetricRequest,
  RatingRow,
  ReportPreset,
  SortDirection,
} from "./types";

function App() {
  const [loginValue, setLoginValue] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [fields, setFields] = useState<AnalyticsField[]>([]);
  const [summaryMetrics, setSummaryMetrics] = useState<MetricRequest[]>([
    { field: "student_count", aggregation: "count" },
  ]);
  const [summaryDimensions, setSummaryDimensions] = useState<string[]>([
    "military_specialty",
  ]);
  const [summaryFilters, setSummaryFilters] = useState<FilterDraft[]>([
    {
      id: createDraftId(),
      field: "status",
      operator: "in",
      value: "",
      values: ["ENROLLED"],
    },
  ]);
  const [result, setResult] = useState<AnalyticsQueryResponse | null>(null);
  const [lastQuery, setLastQuery] = useState<AnalyticsQueryRequest | null>(null);
  const [lastDetailQuery, setLastDetailQuery] = useState<DetailQueryRequest | null>(null);
  const [resultMode, setResultMode] = useState<"summary" | "detail">("summary");
  const [ratingRows, setRatingRows] = useState<RatingRow[]>([]);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [activeDetailPresetId, setActiveDetailPresetId] = useState<string | null>(null);
  const [detailColumns, setDetailColumns] = useState<string[]>([
    "full_name",
    "platoon",
    "military_commissariat",
    "military_specialty",
    "final_result",
  ]);
  const [detailFilters, setDetailFilters] = useState<FilterDraft[]>([
    {
      id: createDraftId(),
      field: "platoon",
      operator: "in",
      value: "",
      values: [],
    },
  ]);
  const [detailSortField, setDetailSortField] = useState("final_result");
  const [detailSortDirection, setDetailSortDirection] = useState<SortDirection>("desc");
  const [fieldValues, setFieldValues] = useState<Record<string, Array<string | number>>>({});
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const metricFields = useMemo(
    () => fields.filter((field) => field.aggregations.length > 0),
    [fields],
  );
  const dimensionFields = useMemo(
    () => fields.filter((field) => field.groupable),
    [fields],
  );
  const filterFields = useMemo(
    () => fields.filter((field) => field.filterable),
    [fields],
  );
  const displayFields = useMemo(
    () => fields.filter((field) => field.displayable),
    [fields],
  );

  const queryDescription = buildQueryDescription({
    dimensions: summaryDimensions,
    fields,
    filters: summaryFilters,
    metrics: summaryMetrics,
  });

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const loginResponse = await login(loginValue, password);
      const currentUser = await getMe(loginResponse.access_token);
      const analyticsFields = await getAnalyticsFields(loginResponse.access_token);

      setToken(loginResponse.access_token);
      setUser(currentUser);
      setFields(analyticsFields);

      const firstMetric =
        analyticsFields.find((field) => field.id === "student_count") ??
        analyticsFields.find((field) => field.aggregations.length > 0);
      const firstDimension =
        analyticsFields.find((field) => field.id === "military_specialty") ??
        analyticsFields.find((field) => field.groupable);
      const firstFilter =
        analyticsFields.find((field) => field.id === "status") ??
        analyticsFields.find((field) => field.filterable);

      if (firstMetric) {
        setSummaryMetrics([
          { field: firstMetric.id, aggregation: firstMetric.aggregations[0] },
        ]);
      }
      if (firstDimension) {
        setSummaryDimensions([firstDimension.id]);
      }
      if (firstFilter) {
        setSummaryFilters([
          {
            id: createDraftId(),
            field: firstFilter.id,
            operator: getOperatorsForField(firstFilter)[0],
              value: "",
              values: firstFilter.id === "status" ? ["ENROLLED"] : [],
          },
        ]);
      }

      const availableDisplayIds = analyticsFields
        .filter((field) => field.displayable)
        .map((field) => field.id);
      const defaultDetailColumns = [
        "full_name",
        "platoon",
        "military_commissariat",
        "military_specialty",
        "final_result",
      ].filter((fieldId) => availableDisplayIds.includes(fieldId));
      setDetailColumns(defaultDetailColumns.length ? defaultDetailColumns : availableDisplayIds.slice(0, 5));
      setDetailFilters([
        {
          id: createDraftId(),
          field: availableDisplayIds.includes("platoon") ? "platoon" : firstFilter?.id ?? "",
          operator: "in",
          value: "",
          values: [],
        },
      ]);
      setDetailSortField(
        availableDisplayIds.includes("final_result")
          ? "final_result"
          : defaultDetailColumns[0] ?? availableDisplayIds[0] ?? "",
      );
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Login failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function runQuery(payload: AnalyticsQueryRequest, nextChartType: ChartType) {
    if (!token) {
      setError("Login is required");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const queryResult = await runAnalyticsQuery(token, payload);
      setResult(queryResult);
      setLastQuery(payload);
      setLastDetailQuery(null);
      setResultMode("summary");
      setChartType(nextChartType);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Query failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActivePresetId(null);
    await runQuery(buildBuilderQuery(), chartType);
  }

  async function handlePresetClick(preset: ReportPreset) {
    setActivePresetId(preset.id);
    setActiveDetailPresetId(null);
    applyQueryToBuilder(preset.query);
    await runQuery(preset.query, preset.chartType);
  }

  async function handleDetailQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setActiveDetailPresetId(null);
    await runDetail(buildDetailQuery());
  }

  async function handleDetailPresetClick(preset: DetailPreset) {
    setActiveDetailPresetId(preset.id);
    setActivePresetId(null);
    applyDetailQueryToBuilder(preset.query);
    await runDetail(preset.query);
  }

  async function runDetail(payload: DetailQueryRequest) {
    if (!token) {
      setError("Login is required");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const queryResult = await runDetailQuery(token, payload);
      setResult(queryResult);
      setLastDetailQuery(payload);
      setLastQuery(null);
      setResultMode("detail");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Detail query failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleRatingLoad() {
    if (!token) {
      setError("Login is required");
      return;
    }
    setError(null);
    setIsLoading(true);
    try {
      const rating = await getRating(token);
      setRatingRows(rating.rows);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Rating failed");
    } finally {
      setIsLoading(false);
    }
  }

  async function handleReportExport() {
    if (!token) {
      setError("Сначала построй отчет");
      return;
    }
    if (resultMode === "detail" && lastDetailQuery) {
      const blob = await exportDetailQuery(token, lastDetailQuery);
      downloadBlob(blob, "detail-report.xlsx");
      return;
    }
    if (lastQuery) {
      const blob = await exportAnalyticsQuery(token, lastQuery);
      downloadBlob(blob, "summary-report.xlsx");
      return;
    }
    setError("Сначала построй отчет");
  }

  async function handleRatingExport() {
    if (!token) {
      setError("Login is required");
      return;
    }
    const blob = await exportRating(token);
    downloadBlob(blob, "rating.xlsx");
  }

  function buildBuilderQuery(): AnalyticsQueryRequest {
    const firstMetric = summaryMetrics[0];
    const metricKey = firstMetric
      ? getMetricKey(firstMetric)
      : summaryDimensions[0] ?? "";
    return {
      metrics: summaryMetrics,
      dimensions: summaryDimensions,
      filters: buildFilterRequests(summaryFilters, filterFields),
      sort: metricKey ? [{ field: metricKey, direction: "desc" }] : [],
      limit: 100,
    };
  }

  function buildDetailQuery(): DetailQueryRequest {
    return {
      columns: detailColumns,
      filters: buildFilterRequests(detailFilters, filterFields),
      sort: detailSortField
        ? [{ field: detailSortField, direction: detailSortDirection }]
        : [],
      limit: 100,
    };
  }

  function applyDetailQueryToBuilder(query: DetailQueryRequest) {
    setDetailColumns(query.columns);
    setDetailFilters(filtersToDrafts(query.filters, filterFields));
    const sort = query.sort[0];
    if (sort) {
      setDetailSortField(sort.field);
      setDetailSortDirection(sort.direction);
    }
  }

  function applyQueryToBuilder(query: AnalyticsQueryRequest) {
    setSummaryMetrics(query.metrics);
    setSummaryDimensions(query.dimensions);
    setSummaryFilters(filtersToDrafts(query.filters, filterFields));
  }

  function updateSummaryMetric(index: number, nextMetric: MetricRequest) {
    setSummaryMetrics((currentMetrics) =>
      currentMetrics.map((metric, currentIndex) =>
        currentIndex === index ? nextMetric : metric,
      ),
    );
  }

  function addSummaryMetric() {
    const nextField = metricFields[0];
    if (!nextField || summaryMetrics.length >= 3) {
      return;
    }
    setSummaryMetrics((currentMetrics) => [
      ...currentMetrics,
      { field: nextField.id, aggregation: nextField.aggregations[0] },
    ]);
  }

  function removeSummaryMetric(index: number) {
    setSummaryMetrics((currentMetrics) =>
      currentMetrics.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function updateSummaryDimension(index: number, fieldId: string) {
    setSummaryDimensions((currentDimensions) =>
      currentDimensions.map((dimensionItem, currentIndex) =>
        currentIndex === index ? fieldId : dimensionItem,
      ),
    );
  }

  function addSummaryDimension() {
    const nextDimension = dimensionFields.find(
      (field) => !summaryDimensions.includes(field.id),
    );
    if (!nextDimension || summaryDimensions.length >= 3) {
      return;
    }
    setSummaryDimensions((currentDimensions) => [
      ...currentDimensions,
      nextDimension.id,
    ]);
  }

  function removeSummaryDimension(index: number) {
    setSummaryDimensions((currentDimensions) =>
      currentDimensions.filter((_, currentIndex) => currentIndex !== index),
    );
  }

  function updateSummaryFilter(nextFilter: FilterDraft) {
    setSummaryFilters((currentFilters) =>
      currentFilters.map((filter) =>
        filter.id === nextFilter.id ? nextFilter : filter,
      ),
    );
  }

  function updateDetailFilter(nextFilter: FilterDraft) {
    setDetailFilters((currentFilters) =>
      currentFilters.map((filter) =>
        filter.id === nextFilter.id ? nextFilter : filter,
      ),
    );
  }

  function addSummaryFilter() {
    const firstFilter = filterFields[0];
    if (!firstFilter) {
      return;
    }
    setSummaryFilters((currentFilters) => [
      ...currentFilters,
      {
        id: createDraftId(),
        field: firstFilter.id,
        operator: getOperatorsForField(firstFilter)[0],
        value: "",
        values: [],
      },
    ]);
  }

  function addDetailFilter() {
    const firstFilter = filterFields[0];
    if (!firstFilter) {
      return;
    }
    setDetailFilters((currentFilters) => [
      ...currentFilters,
      {
        id: createDraftId(),
        field: firstFilter.id,
        operator: getOperatorsForField(firstFilter)[0],
        value: "",
        values: [],
      },
    ]);
  }

  function removeSummaryFilter(filterId: string) {
    setSummaryFilters((currentFilters) =>
      currentFilters.filter((filter) => filter.id !== filterId),
    );
  }

  function removeDetailFilter(filterId: string) {
    setDetailFilters((currentFilters) =>
      currentFilters.filter((filter) => filter.id !== filterId),
    );
  }

  async function ensureFieldValues(fieldId: string) {
    if (!token || !fieldId || fieldValues[fieldId]) {
      return;
    }
    try {
      const response = await getFieldValues(token, fieldId);
      setFieldValues((currentValues) => ({
        ...currentValues,
        [fieldId]: response.values,
      }));
    } catch {
      // Value hints are optional; the query builder still works with manual input.
    }
  }

  async function handleSummaryDrillDown(row: Record<string, string | number | null>) {
    if (!lastQuery) {
      return;
    }

    const drillFilters = [
      ...lastQuery.filters,
      ...lastQuery.dimensions
        .filter((dimensionItem) => row[dimensionItem] !== null && row[dimensionItem] !== undefined)
        .map((dimensionItem) => ({
          field: dimensionItem,
          operator: "eq" as FilterOperator,
          value: row[dimensionItem],
        })),
    ];
    const drillColumns = uniqueStrings(
      [
        "full_name",
        ...lastQuery.dimensions,
        "study_group",
        "platoon",
        "military_commissariat",
        "military_specialty",
        "final_result",
      ].filter((fieldId) => displayFields.some((field) => field.id === fieldId)),
    );
    const detailQuery: DetailQueryRequest = {
      columns: drillColumns,
      filters: drillFilters,
      sort: displayFields.some((field) => field.id === "final_result")
        ? [{ field: "final_result", direction: "desc" }]
        : [],
      limit: 100,
    };

    applyDetailQueryToBuilder(detailQuery);
    await runDetail(detailQuery);
  }

  function toggleDetailColumn(fieldId: string) {
    setDetailColumns((currentColumns) => {
      if (currentColumns.includes(fieldId)) {
        return currentColumns.filter((column) => column !== fieldId);
      }
      return [...currentColumns, fieldId];
    });
  }

  return (
    <main className="mx-auto grid max-w-7xl gap-6 px-6 py-8">
      <section className="flex flex-col gap-4 rounded-3xl bg-slate-950 p-8 text-white shadow-xl lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-300">
            ВУЦ ЯГТУ
          </p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">
            Аналитический модуль
          </h1>
          <p className="mt-3 max-w-2xl text-slate-300">
            Готовые отчеты, конструктор аналитических запросов, таблицы и
            интерактивные графики поверх семантического слоя backend.
          </p>
        </div>
        {user && (
          <div className="rounded-2xl border border-white/10 bg-white/10 px-5 py-4">
            <span className="text-sm text-slate-300">Пользователь</span>
            <strong className="mt-1 block text-lg">{user.login}</strong>
            <Badge className="mt-2 bg-blue-400/20 text-blue-100">{user.role}</Badge>
          </div>
        )}
      </section>

      {error && <Alert>{error}</Alert>}

      {!token ? (
        <Card className="max-w-2xl">
          <CardHeader>
            <CardTitle>Вход</CardTitle>
            <CardDescription>
              Используй demo-доступ `admin` / `admin` после применения seed-данных.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form className="grid gap-4 md:grid-cols-[1fr_1fr_auto]" onSubmit={handleLogin}>
              <Field label="Логин">
                <Input
                  value={loginValue}
                  onChange={(event) => setLoginValue(event.target.value)}
                />
              </Field>
              <Field label="Пароль">
                <Input
                  type="password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
              </Field>
              <Button className="self-end" disabled={isLoading} type="submit">
                Войти
              </Button>
            </form>
          </CardContent>
        </Card>
      ) : (
        <Tabs defaultValue="presets">
          <TabsList>
            <TabsTrigger value="presets">Готовые отчеты</TabsTrigger>
            <TabsTrigger value="summary">Сводный отчет</TabsTrigger>
            <TabsTrigger value="detail">Детальная выборка</TabsTrigger>
            <TabsTrigger value="rating">Рейтинг</TabsTrigger>
          </TabsList>

          <TabsContent value="presets">
            <div className="mb-4">
              <h2 className="text-xl font-semibold">Сводные отчеты</h2>
              <p className="text-sm text-slate-500">
                Для графиков, распределений и агрегированных таблиц.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {SUMMARY_PRESETS.map((preset) => (
                <Card
                  className={
                    activePresetId === preset.id
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : ""
                  }
                  key={preset.id}
                >
                  <CardHeader>
                    <CardTitle>{preset.title}</CardTitle>
                    <CardDescription>{preset.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <Badge>{preset.chartType}</Badge>
                    <Button
                      disabled={isLoading}
                      onClick={() => void handlePresetClick(preset)}
                      type="button"
                    >
                      Построить
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
            <div className="mb-4 mt-8">
              <h2 className="text-xl font-semibold">Детальные выборки</h2>
              <p className="text-sm text-slate-500">
                Для списков людей и полезного XLSX-экспорта.
              </p>
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {DETAIL_PRESETS.map((preset) => (
                <Card
                  className={
                    activeDetailPresetId === preset.id
                      ? "border-blue-400 ring-2 ring-blue-100"
                      : ""
                  }
                  key={preset.id}
                >
                  <CardHeader>
                    <CardTitle>{preset.title}</CardTitle>
                    <CardDescription>{preset.description}</CardDescription>
                  </CardHeader>
                  <CardContent className="flex items-center justify-between gap-3">
                    <Badge>detail</Badge>
                    <Button
                      disabled={isLoading}
                      onClick={() => void handleDetailPresetClick(preset)}
                      type="button"
                    >
                      Открыть список
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </TabsContent>

          <TabsContent value="summary">
            <Card>
              <CardHeader>
                <CardTitle>Сводный отчет</CardTitle>
                <CardDescription>{queryDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-5" onSubmit={handleQuery}>
                  <MetricBuilder
                    fields={metricFields}
                    metrics={summaryMetrics}
                    onAdd={addSummaryMetric}
                    onChange={updateSummaryMetric}
                    onRemove={removeSummaryMetric}
                  />

                  <DimensionBuilder
                    dimensions={summaryDimensions}
                    fields={dimensionFields}
                    onAdd={addSummaryDimension}
                    onChange={updateSummaryDimension}
                    onRemove={removeSummaryDimension}
                  />

                  <Field label="Тип графика">
                    <Select
                      className="max-w-xs"
                      value={chartType}
                      onChange={(event) => setChartType(event.target.value as ChartType)}
                    >
                      <option value="bar">bar</option>
                      <option value="line">line</option>
                      <option value="pie">pie</option>
                    </Select>
                  </Field>

                  <FilterBuilder
                    fieldValues={fieldValues}
                    fields={filterFields}
                    filters={summaryFilters}
                    onAdd={addSummaryFilter}
                    onChange={updateSummaryFilter}
                    onLoadValues={(fieldId) => void ensureFieldValues(fieldId)}
                    onRemove={removeSummaryFilter}
                  />

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isLoading} type="submit">
                      Построить
                    </Button>
                    <Button
                      onClick={() => setSummaryFilters([])}
                      type="button"
                      variant="outline"
                    >
                      Сбросить фильтры
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="detail">
            <Card>
              <CardHeader>
                <CardTitle>Детальная выборка</CardTitle>
                <CardDescription>
                  Выбери колонки, фильтр и сортировку, чтобы получить список людей для
                  просмотра или XLSX-экспорта.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-5" onSubmit={handleDetailQuery}>
                  <Field label="Колонки">
                    <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                      {displayFields.map((field) => (
                        <label
                          className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-sm"
                          key={field.id}
                        >
                          <input
                            checked={detailColumns.includes(field.id)}
                            onChange={() => toggleDetailColumn(field.id)}
                            type="checkbox"
                          />
                          {field.label}
                        </label>
                      ))}
                    </div>
                  </Field>

                  <FilterBuilder
                    fieldValues={fieldValues}
                    fields={filterFields}
                    filters={detailFilters}
                    onAdd={addDetailFilter}
                    onChange={updateDetailFilter}
                    onLoadValues={(fieldId) => void ensureFieldValues(fieldId)}
                    onRemove={removeDetailFilter}
                  />

                  <div className="grid gap-4 lg:grid-cols-2">
                    <Field label="Сортировка">
                      <Select
                        value={detailSortField}
                        onChange={(event) => setDetailSortField(event.target.value)}
                      >
                        {displayFields.map((field) => (
                          <option key={field.id} value={field.id}>
                            {field.label}
                          </option>
                        ))}
                      </Select>
                    </Field>

                    <Field label="Направление">
                      <Select
                        value={detailSortDirection}
                        onChange={(event) =>
                          setDetailSortDirection(event.target.value as SortDirection)
                        }
                      >
                        <option value="asc">asc</option>
                        <option value="desc">desc</option>
                      </Select>
                    </Field>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Button disabled={isLoading || !detailColumns.length} type="submit">
                      Получить список
                    </Button>
                    <Button
                      onClick={() => setDetailFilters([])}
                      type="button"
                      variant="outline"
                    >
                      Сбросить фильтры
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rating">
            <Card>
              <CardHeader>
                <CardTitle>Рейтинговый список</CardTitle>
                <CardDescription>
                  Список кандидатов и курсантов, отсортированный по итоговому баллу.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <Button
                    disabled={isLoading}
                    onClick={() => void handleRatingLoad()}
                    type="button"
                  >
                    Загрузить рейтинг
                  </Button>
                  <Button
                    onClick={() => void handleRatingExport()}
                    type="button"
                    variant="outline"
                  >
                    Экспорт XLSX
                  </Button>
                </div>
                <DataTable result={ratingToTable(ratingRows)} />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      {result && (
        <ResultView
          chartType={chartType}
          onDrillDown={
            resultMode === "summary"
              ? (row) => void handleSummaryDrillDown(row)
              : undefined
          }
          onExport={() => void handleReportExport()}
          result={result}
          showChart={resultMode === "summary"}
        />
      )}
    </main>
  );
}

function ResultView({
  chartType,
  onDrillDown,
  onExport,
  result,
  showChart,
}: {
  chartType: ChartType;
  onDrillDown?: (row: Record<string, string | number | null>) => void;
  onExport: () => void;
  result: AnalyticsQueryResponse;
  showChart: boolean;
}) {
  return (
    <section
      className={
        showChart
          ? "grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
          : "grid gap-6"
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Таблица</CardTitle>
          <CardDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>
              Строк: {result.rows.length}
              {onDrillDown ? ", клик по строке откроет список людей" : ""}
            </span>
            <Button
              disabled={!result.rows.length}
              onClick={onExport}
              type="button"
              variant="outline"
            >
              Экспорт XLSX
            </Button>
          </CardDescription>
        </CardHeader>
        <CardContent>
          <DataTable onRowClick={onDrillDown} result={result} />
        </CardContent>
      </Card>

      {showChart && (
        <Card>
          <CardHeader>
            <CardTitle>График</CardTitle>
            <CardDescription>Тип визуализации: {chartType}</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartView chartType={chartType} result={result} />
          </CardContent>
        </Card>
      )}
    </section>
  );
}

export default App;

function normalizeFilterValue(value: string, field?: AnalyticsField): string | number {
  if (field?.type === "number") {
    return Number(value);
  }
  return value;
}

function Field({
  children,
  label,
}: {
  children: React.ReactNode;
  label: string;
}) {
  return (
    <div className="grid gap-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}

function MetricBuilder({
  fields,
  metrics,
  onAdd,
  onChange,
  onRemove,
}: {
  fields: AnalyticsField[];
  metrics: MetricRequest[];
  onAdd: () => void;
  onChange: (index: number, metric: MetricRequest) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <Field label="Метрики">
      <div className="grid gap-3">
        {metrics.map((metric, index) => {
          const selectedField = fields.find((field) => field.id === metric.field);
          const aggregations = selectedField?.aggregations ?? [];
          return (
            <div
              className="grid gap-3 rounded-2xl border border-slate-200 p-3 md:grid-cols-[1fr_180px_auto]"
              key={`${metric.field}-${metric.aggregation}-${index}`}
            >
              <Select
                value={metric.field}
                onChange={(event) => {
                  const nextField = fields.find(
                    (field) => field.id === event.target.value,
                  );
                  onChange(index, {
                    field: event.target.value,
                    aggregation: nextField?.aggregations[0] ?? "count",
                  });
                }}
              >
                {fields.map((field) => (
                  <option key={field.id} value={field.id}>
                    {field.label}
                  </option>
                ))}
              </Select>
              <Select
                value={metric.aggregation}
                onChange={(event) =>
                  onChange(index, {
                    ...metric,
                    aggregation: event.target.value as Aggregation,
                  })
                }
              >
                {aggregations.map((aggregationItem) => (
                  <option key={aggregationItem} value={aggregationItem}>
                    {aggregationItem}
                  </option>
                ))}
              </Select>
              <Button
                disabled={metrics.length <= 1}
                onClick={() => onRemove(index)}
                type="button"
                variant="outline"
              >
                Удалить
              </Button>
            </div>
          );
        })}
        <Button
          className="w-fit"
          disabled={metrics.length >= 3}
          onClick={onAdd}
          type="button"
          variant="outline"
        >
          + Добавить метрику
        </Button>
      </div>
    </Field>
  );
}

function DimensionBuilder({
  dimensions,
  fields,
  onAdd,
  onChange,
  onRemove,
}: {
  dimensions: string[];
  fields: AnalyticsField[];
  onAdd: () => void;
  onChange: (index: number, fieldId: string) => void;
  onRemove: (index: number) => void;
}) {
  return (
    <Field label="Группировки">
      <div className="grid gap-3">
        {dimensions.map((dimensionItem, index) => (
          <div
            className="grid gap-3 rounded-2xl border border-slate-200 p-3 md:grid-cols-[1fr_auto]"
            key={`${dimensionItem}-${index}`}
          >
            <Select
              value={dimensionItem}
              onChange={(event) => onChange(index, event.target.value)}
            >
              {fields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </Select>
            <Button
              disabled={dimensions.length <= 1}
              onClick={() => onRemove(index)}
              type="button"
              variant="outline"
            >
              Удалить
            </Button>
          </div>
        ))}
        <Button
          className="w-fit"
          disabled={dimensions.length >= 3}
          onClick={onAdd}
          type="button"
          variant="outline"
        >
          + Добавить группировку
        </Button>
      </div>
    </Field>
  );
}

function buildQueryDescription({
  dimensions,
  fields,
  filters,
  metrics,
}: {
  dimensions: string[];
  fields: AnalyticsField[];
  filters: FilterDraft[];
  metrics: MetricRequest[];
}) {
  const metricLabels = metrics.map((metric) => {
    const fieldLabel = fields.find((field) => field.id === metric.field)?.label ?? metric.field;
    return `${metric.aggregation}(${fieldLabel})`;
  });
  const dimensionLabels = dimensions.map(
    (dimension) => fields.find((field) => field.id === dimension)?.label ?? dimension,
  );
  const activeFilters = filters.filter(hasFilterValue);
  const filterPart = activeFilters.length
    ? `, фильтров: ${activeFilters.length}`
    : ", без фильтров";

  return `${metricLabels.join(", ")} по ${dimensionLabels.join(" + ")}${filterPart}`;
}

function buildFilterRequests(filters: FilterDraft[], fields: AnalyticsField[]) {
  return filters
    .filter((filter) => filter.field && hasFilterValue(filter))
    .map((filter) => {
      const field = fields.find((fieldItem) => fieldItem.id === filter.field);
      const values = filter.values.map((value) => normalizeFilterValue(value, field));
      return {
        field: filter.field,
        operator: filter.operator,
        value:
          filter.operator === "in"
            ? values.length > 0
              ? values
              : filter.value
                  .split(",")
                  .map((value) => normalizeFilterValue(value.trim(), field))
                  .filter((value) => value !== "")
            : normalizeFilterValue(filter.value, field),
      };
    });
}

function filtersToDrafts(
  filters: Array<{ field: string; operator: FilterOperator; value: unknown }>,
  fields: AnalyticsField[],
): FilterDraft[] {
  if (!filters.length) {
    return [];
  }
  return filters.map((filter) => {
    const field = fields.find((fieldItem) => fieldItem.id === filter.field);
    const rawValues = Array.isArray(filter.value) ? filter.value : [];
    return {
      id: createDraftId(),
      field: filter.field,
      operator: filter.operator,
      value: Array.isArray(filter.value)
        ? ""
        : String(filter.value ?? (field?.id === "status" ? "ENROLLED" : "")),
      values: rawValues.map((value) => String(value)),
    };
  });
}

function hasFilterValue(filter: FilterDraft) {
  return filter.values.length > 0 || filter.value.trim().length > 0;
}

function getMetricKey(metric: MetricRequest) {
  return metric.aggregation === "count"
    ? metric.field
    : `${metric.aggregation}_${metric.field}`;
}

function uniqueStrings(values: string[]) {
  return Array.from(new Set(values));
}

function createDraftId() {
  return crypto.randomUUID();
}

function ratingToTable(rows: RatingRow[]): AnalyticsQueryResponse {
  return {
    columns: [
      { key: "full_name", label: "ФИО", type: "string" },
      { key: "study_group", label: "Группа", type: "string" },
      { key: "military_specialty", label: "ВУС", type: "string" },
      { key: "status", label: "Статус", type: "string" },
      { key: "fitness_category", label: "Годность", type: "string" },
      { key: "psycho_category", label: "Профпригодность", type: "string" },
      { key: "grade100", label: "Успеваемость", type: "number" },
      { key: "total_points", label: "Физподготовка", type: "number" },
      { key: "final_result", label: "Итог", type: "number" },
    ],
    rows: rows.map((row) => ({ ...row })),
  };
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
