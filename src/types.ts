export type FieldType = "string" | "number" | "date";
export type Aggregation = "count" | "avg" | "sum" | "min" | "max";
export type FilterOperator = "eq" | "in" | "gte" | "lte" | "contains";
export type SortDirection = "asc" | "desc";
export type ChartType = "bar" | "line" | "pie";

export interface AnalyticsField {
  id: string;
  label: string;
  type: FieldType;
  displayable: boolean;
  groupable: boolean;
  filterable: boolean;
  aggregations: Aggregation[];
}

export interface MetricRequest {
  field: string;
  aggregation: Aggregation;
}

export interface FilterRequest {
  field: string;
  operator: FilterOperator;
  value: unknown;
}

export interface FilterDraft {
  id: string;
  field: string;
  operator: FilterOperator;
  value: string;
  values: string[];
}

export interface SortRequest {
  field: string;
  direction: SortDirection;
}

export interface AnalyticsQueryRequest {
  metrics: MetricRequest[];
  dimensions: string[];
  filters: FilterRequest[];
  sort: SortRequest[];
  limit: number;
}

export interface DetailQueryRequest {
  columns: string[];
  filters: FilterRequest[];
  sort: SortRequest[];
  limit: number;
}

export interface AnalyticsColumn {
  key: string;
  label: string;
  type: FieldType;
}

export interface AnalyticsQueryResponse {
  columns: AnalyticsColumn[];
  rows: Record<string, string | number | null>[];
}

export interface LoginResponse {
  access_token: string;
  token_type: string;
}

export interface CurrentUser {
  id: number;
  login: string;
  role: "admin" | "operator" | "observer";
}

export interface ReportPreset {
  id: string;
  title: string;
  description: string;
  chartType: ChartType;
  query: AnalyticsQueryRequest;
}

export interface DetailPreset {
  id: string;
  title: string;
  description: string;
  columns: string[];
  query: DetailQueryRequest;
}

export interface RatingRow {
  full_name?: string;
  study_group: string | null;
  military_specialty: string | null;
  status: string | null;
  fitness_category: string | null;
  psycho_category: string | null;
  grade100: number | null;
  total_points: number | null;
  final_result: number | null;
}

export interface FieldValuesResponse {
  field: string;
  values: Array<string | number>;
}
