import { FormEvent, useMemo, useState } from "react";

import {
  exportAnalyticsQuery,
  exportRating,
  getAnalyticsFields,
  getMe,
  getRating,
  login,
  runAnalyticsQuery,
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
import { REPORT_PRESETS } from "./presets";
import type {
  Aggregation,
  AnalyticsField,
  AnalyticsQueryRequest,
  AnalyticsQueryResponse,
  ChartType,
  CurrentUser,
  FilterOperator,
  RatingRow,
  ReportPreset,
} from "./types";

function App() {
  const [loginValue, setLoginValue] = useState("admin");
  const [password, setPassword] = useState("admin");
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [fields, setFields] = useState<AnalyticsField[]>([]);
  const [metricField, setMetricField] = useState("student_count");
  const [aggregation, setAggregation] = useState<Aggregation>("count");
  const [dimension, setDimension] = useState("military_specialty");
  const [filterField, setFilterField] = useState("status");
  const [filterOperator, setFilterOperator] = useState<FilterOperator>("eq");
  const [filterValue, setFilterValue] = useState("ENROLLED");
  const [result, setResult] = useState<AnalyticsQueryResponse | null>(null);
  const [lastQuery, setLastQuery] = useState<AnalyticsQueryRequest | null>(null);
  const [ratingRows, setRatingRows] = useState<RatingRow[]>([]);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
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

  const selectedMetric = metricFields.find((field) => field.id === metricField);
  const selectedFilter = filterFields.find((field) => field.id === filterField);
  const availableAggregations = selectedMetric?.aggregations ?? [];
  const availableFilterOperators = getOperatorsForField(selectedFilter);
  const queryDescription = buildQueryDescription({
    aggregation,
    dimension,
    fields,
    filterField,
    filterOperator,
    filterValue,
    metricField,
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
        setMetricField(firstMetric.id);
        setAggregation(firstMetric.aggregations[0]);
      }
      if (firstDimension) {
        setDimension(firstDimension.id);
      }
      if (firstFilter) {
        setFilterField(firstFilter.id);
        setFilterOperator(getOperatorsForField(firstFilter)[0]);
        setFilterValue(firstFilter.id === "status" ? "ENROLLED" : "");
      }
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
    applyQueryToBuilder(preset.query);
    await runQuery(preset.query, preset.chartType);
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
    if (!token || !lastQuery) {
      setError("Сначала построй отчет");
      return;
    }
    const blob = await exportAnalyticsQuery(token, lastQuery);
    downloadBlob(blob, "analytics-report.xlsx");
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
    const metricKey =
      aggregation === "count" ? metricField : `${aggregation}_${metricField}`;
    return {
      metrics: [{ field: metricField, aggregation }],
      dimensions: dimension ? [dimension] : [],
      filters: filterValue.trim()
        ? [
            {
              field: filterField,
              operator: filterOperator,
              value: normalizeFilterValue(filterValue, selectedFilter),
            },
          ]
        : [],
      sort: [{ field: metricKey, direction: "desc" }],
      limit: 100,
    };
  }

  function applyQueryToBuilder(query: AnalyticsQueryRequest) {
    const metric = query.metrics[0];
    if (metric) {
      setMetricField(metric.field);
      setAggregation(metric.aggregation);
    }
    setDimension(query.dimensions[0] ?? "");

    const filter = query.filters[0];
    if (filter) {
      setFilterField(filter.field);
      setFilterOperator(filter.operator);
      setFilterValue(String(filter.value ?? ""));
    } else {
      setFilterValue("");
    }
  }

  function handleMetricChange(nextMetricField: string) {
    setMetricField(nextMetricField);
    const nextMetric = metricFields.find((field) => field.id === nextMetricField);
    setAggregation(nextMetric?.aggregations[0] ?? "count");
  }

  function handleFilterFieldChange(nextFilterField: string) {
    const nextFilter = filterFields.find((field) => field.id === nextFilterField);
    setFilterField(nextFilterField);
    setFilterOperator(getOperatorsForField(nextFilter)[0]);
    setFilterValue(nextFilterField === "status" ? "ENROLLED" : "");
  }

  function resetFilter() {
    setFilterValue("");
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
            <TabsTrigger value="builder">Конструктор</TabsTrigger>
            <TabsTrigger value="rating">Рейтинг</TabsTrigger>
          </TabsList>

          <TabsContent value="presets">
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {REPORT_PRESETS.map((preset) => (
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
          </TabsContent>

          <TabsContent value="builder">
            <Card>
              <CardHeader>
                <CardTitle>Конструктор отчета</CardTitle>
                <CardDescription>{queryDescription}</CardDescription>
              </CardHeader>
              <CardContent>
                <form className="grid gap-4 lg:grid-cols-4" onSubmit={handleQuery}>
                  <Field label="Метрика">
                    <Select
                      value={metricField}
                      onChange={(event) => handleMetricChange(event.target.value)}
                    >
                      {metricFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Агрегация">
                    <Select
                      value={aggregation}
                      onChange={(event) =>
                        setAggregation(event.target.value as Aggregation)
                      }
                    >
                      {availableAggregations.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Группировка">
                    <Select
                      value={dimension}
                      onChange={(event) => setDimension(event.target.value)}
                    >
                      {dimensionFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Тип графика">
                    <Select
                      value={chartType}
                      onChange={(event) => setChartType(event.target.value as ChartType)}
                    >
                      <option value="bar">bar</option>
                      <option value="line">line</option>
                      <option value="pie">pie</option>
                    </Select>
                  </Field>

                  <Field label="Фильтр">
                    <Select
                      value={filterField}
                      onChange={(event) => handleFilterFieldChange(event.target.value)}
                    >
                      {filterFields.map((field) => (
                        <option key={field.id} value={field.id}>
                          {field.label}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Оператор">
                    <Select
                      value={filterOperator}
                      onChange={(event) =>
                        setFilterOperator(event.target.value as FilterOperator)
                      }
                    >
                      {availableFilterOperators.map((operator) => (
                        <option key={operator} value={operator}>
                          {operator}
                        </option>
                      ))}
                    </Select>
                  </Field>

                  <Field label="Значение">
                    <Input
                      placeholder="Пусто = без фильтра"
                      value={filterValue}
                      onChange={(event) => setFilterValue(event.target.value)}
                    />
                  </Field>

                  <div className="flex items-end gap-2">
                    <Button disabled={isLoading} type="submit">
                      Построить
                    </Button>
                    <Button onClick={resetFilter} type="button" variant="outline">
                      Сбросить
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
          onExport={() => void handleReportExport()}
          result={result}
        />
      )}
    </main>
  );
}

function ResultView({
  chartType,
  onExport,
  result,
}: {
  chartType: ChartType;
  onExport: () => void;
  result: AnalyticsQueryResponse;
}) {
  return (
    <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
      <Card>
        <CardHeader>
          <CardTitle>Таблица</CardTitle>
          <CardDescription className="flex flex-wrap items-center justify-between gap-3">
            <span>Строк: {result.rows.length}</span>
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
          <DataTable result={result} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>График</CardTitle>
          <CardDescription>Тип визуализации: {chartType}</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartView chartType={chartType} result={result} />
        </CardContent>
      </Card>
    </section>
  );
}

export default App;

function getOperatorsForField(field?: AnalyticsField): FilterOperator[] {
  if (!field) {
    return ["eq"];
  }
  if (field.type === "string") {
    return ["eq", "contains"];
  }
  return ["eq", "gte", "lte"];
}

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

function buildQueryDescription({
  aggregation,
  dimension,
  fields,
  filterField,
  filterOperator,
  filterValue,
  metricField,
}: {
  aggregation: Aggregation;
  dimension: string;
  fields: AnalyticsField[];
  filterField: string;
  filterOperator: FilterOperator;
  filterValue: string;
  metricField: string;
}) {
  const metricLabel = fields.find((field) => field.id === metricField)?.label ?? metricField;
  const dimensionLabel =
    fields.find((field) => field.id === dimension)?.label ?? dimension;
  const filterLabel =
    fields.find((field) => field.id === filterField)?.label ?? filterField;
  const filterPart = filterValue.trim()
    ? `, фильтр: ${filterLabel} ${filterOperator} ${filterValue}`
    : ", без фильтра";

  return `${aggregation}(${metricLabel}) по ${dimensionLabel}${filterPart}`;
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
