import { FormEvent, useMemo, useState } from "react";

import {
  getAnalyticsFields,
  getMe,
  login,
  runAnalyticsQuery,
} from "./api";
import type {
  Aggregation,
  AnalyticsField,
  AnalyticsQueryResponse,
  CurrentUser,
  FilterOperator,
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

  async function handleQuery(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      setError("Login is required");
      return;
    }

    setError(null);
    setIsLoading(true);

    try {
      const metricKey =
        aggregation === "count" ? metricField : `${aggregation}_${metricField}`;
      const queryResult = await runAnalyticsQuery(token, {
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
      });
      setResult(queryResult);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Query failed");
    } finally {
      setIsLoading(false);
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

  return (
    <main className="page">
      <section className="hero">
        <div>
          <p className="eyebrow">ВУЦ ЯГТУ</p>
          <h1>Аналитический модуль</h1>
          <p>
            MVP интерфейс для проверки backend: авторизация, каталог полей,
            аналитический запрос, таблица и простая визуализация.
          </p>
        </div>
        {user && (
          <div className="user-card">
            <span>Пользователь</span>
            <strong>{user.login}</strong>
            <small>{user.role}</small>
          </div>
        )}
      </section>

      {error && <div className="error">{error}</div>}

      {!token ? (
        <form className="panel form-grid" onSubmit={handleLogin}>
          <label>
            Логин
            <input
              value={loginValue}
              onChange={(event) => setLoginValue(event.target.value)}
            />
          </label>
          <label>
            Пароль
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <button disabled={isLoading} type="submit">
            Войти
          </button>
        </form>
      ) : (
        <form className="panel query-grid" onSubmit={handleQuery}>
          <label>
            Метрика
            <select
              value={metricField}
              onChange={(event) => handleMetricChange(event.target.value)}
            >
              {metricFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Агрегация
            <select
              value={aggregation}
              onChange={(event) => setAggregation(event.target.value as Aggregation)}
            >
              {availableAggregations.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
          </label>

          <label>
            Группировка
            <select
              value={dimension}
              onChange={(event) => setDimension(event.target.value)}
            >
              {dimensionFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Фильтр
            <select
              value={filterField}
              onChange={(event) => handleFilterFieldChange(event.target.value)}
            >
              {filterFields.map((field) => (
                <option key={field.id} value={field.id}>
                  {field.label}
                </option>
              ))}
            </select>
          </label>

          <label>
            Оператор
            <select
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
            </select>
          </label>

          <label>
            Значение
            <input
              placeholder="Пусто = без фильтра"
              value={filterValue}
              onChange={(event) => setFilterValue(event.target.value)}
            />
          </label>

          <button disabled={isLoading} type="submit">
            Построить
          </button>
        </form>
      )}

      {result && <ResultView result={result} />}
    </main>
  );
}

function ResultView({ result }: { result: AnalyticsQueryResponse }) {
  const dimensionColumn = result.columns[0];
  const metricColumn = result.columns[1] ?? result.columns[0];
  const maxValue = Math.max(
    ...result.rows.map((row) => Number(row[metricColumn.key] ?? 0)),
    1,
  );

  return (
    <section className="result-grid">
      <div className="panel">
        <h2>Таблица</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {result.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, index) => (
                <tr key={index}>
                  {result.columns.map((column) => (
                    <td key={column.key}>{row[column.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="panel">
        <h2>График</h2>
        <div className="chart">
          {result.rows.map((row, index) => {
            const value = Number(row[metricColumn.key] ?? 0);
            const width = `${Math.max(4, (value / maxValue) * 100)}%`;
            return (
              <div className="bar-row" key={index}>
                <span>{row[dimensionColumn.key] ?? "Итого"}</span>
                <div className="bar-track">
                  <div className="bar" style={{ width }} />
                </div>
                <strong>{value}</strong>
              </div>
            );
          })}
        </div>
      </div>
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
